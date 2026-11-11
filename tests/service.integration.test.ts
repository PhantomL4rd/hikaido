import { readdirSync, readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { getPlatformProxy } from "wrangler";
import { retryNotifications } from "../src/lib/server/notifications";
import type { ServiceEvent } from "../src/lib/server/security";
import {
  beginAnswer,
  beginPublish,
  contact,
  creatorReaction,
  manage,
  publicQuiz,
  publish,
  remove,
  report,
  respondents,
  result,
  submit,
} from "../src/lib/server/service";
import {
  publicQuizCard,
  publicResultCard,
  shareResult,
} from "../src/lib/server/sharing";
import { templates } from "../src/lib/templates";

let proxy: Awaited<ReturnType<typeof getPlatformProxy<Env>>>;
let config: Env;
let serial = 0;
const waits: Promise<unknown>[] = [];
function event(body?: unknown, token?: string, search = ""): ServiceEvent {
  const url = new URL(`http://localhost/api/test${search}`);
  return {
    request: new Request(url, {
      method: body ? "POST" : "GET",
      headers: {
        "content-type": "application/json",
        "cf-connecting-ip": `test-${serial++}`,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    }),
    url,
    getClientAddress: () => "127.0.0.1",
    locals: { env: config, waitUntil: (p: Promise<unknown>) => waits.push(p) },
  };
}
beforeAll(async () => {
  proxy = await getPlatformProxy<Env>({ persist: false });
  config = { ...proxy.env, LOCAL_TEST_MODE: "true" };
  for (const file of readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const sql = readFileSync(`drizzle/${file}`, "utf8");
    if (!file.includes("response_guard"))
      await config.DB.batch(
        sql
          .split("--> statement-breakpoint")
          .filter((s) => s.trim())
          .map((s) => config.DB.prepare(s)),
      );
    else await config.DB.prepare(sql).run();
  }
}, 30000);
afterAll(async () => {
  await Promise.all(waits);
  await proxy?.dispose();
});
afterEach(() => vi.unstubAllGlobals());
async function create(n = 10, correct: "A" | "B" = "A") {
  const token = "m".repeat(64);
  const chosen = [
    ...templates.filter((t) => t.type === "diagnosis"),
    ...templates.filter((t) => t.type === "normal").slice(0, n - 4),
  ];
  const q = await publish(
    event({
      characterName: "ひろし",
      managementToken: token,
      ...(await beginPublish(event({ managementToken: token }))),
      questions: chosen.map((t) => ({ templateId: t.id, answer: correct })),
    }),
  );
  return { ...q, token, quiz: await publicQuiz(event(), q.id) };
}
async function answer(
  q: Awaited<ReturnType<typeof create>>,
  choice: "A" | "B" = "A",
  key = crypto.randomUUID(),
) {
  const token = "r".repeat(64);
  const body = {
    respondentName: `友達${serial}`,
    idempotencyKey: key,
    resultToken: token,
    ...(await beginAnswer(
      event({ idempotencyKey: key, resultToken: token }),
      q.id,
    )),
    answers: q.quiz.questions.map((x) => ({ questionId: x.id, choice })),
  };
  return { ...(await submit(event(body), q.id)), token, body };
}
it("公開スナップショットは正解とタイプを漏らさず、全問の一致で採点する", async () => {
  for (const n of [10, 25]) {
    const q = await create(n);
    expect(q.quiz.questions).toHaveLength(n);
    const payload = JSON.stringify(q.quiz);
    for (const field of [
      "correctChoice",
      "hikansenType",
      "managementTokenHash",
      "stats",
    ])
      expect(payload).not.toContain(field);
    const a = await answer(q);
    const r = await result(event(undefined, a.token), q.id, a.id);
    expect(r.response.correctCount).toBe(n);
    expect(r.type).toBe("battle");
    expect(r).not.toHaveProperty("questions");
    for (const field of [
      "correctChoice",
      "selectedChoice",
      "isCorrect",
      "stats",
      "correctRate",
      "percentA",
      "percentB",
    ])
      expect(JSON.stringify(r)).not.toContain(`"${field}"`);
    const b = await submit(event(a.body), q.id);
    expect(b.id).toBe(a.id);
    expect((await respondents(event(), q.id)).items).toHaveLength(1);
    await expect(
      submit(event({ ...a.body, resultToken: "x".repeat(64) }), q.id),
    ).rejects.toMatchObject({ status: 409 });
  }
});
it("作成者は全問題の正答率を確認でき、回答削除後は再集計される", async () => {
  const q = await create();
  const empty = await manage(event(undefined, q.token), q.id);
  expect(empty.questionStats).toHaveLength(10);
  expect(empty.questionStats[0]).toEqual({
    id: q.quiz.questions[0].id,
    question: q.quiz.questions[0].question,
    answer: q.quiz.questions[0].choiceA,
    total: 0,
    correctCount: 0,
    correctRate: null,
  });
  const a = await answer(q, "A");
  await answer(q, "B");
  const mixed = await manage(event(undefined, q.token), q.id);
  expect(
    mixed.questionStats.every(
      (s) => s.total === 2 && s.correctCount === 1 && s.correctRate === 50,
    ),
  ).toBe(true);
  const variedKey = crypto.randomUUID();
  const entry = await beginAnswer(
    event({ idempotencyKey: variedKey, resultToken: "s".repeat(64) }),
    q.id,
  );
  await submit(
    event({
      ...entry,
      respondentName: "問題ごとに違う回答",
      idempotencyKey: variedKey,
      resultToken: "s".repeat(64),
      answers: q.quiz.questions.map((question, i) => ({
        questionId: question.id,
        choice: i === 0 ? "B" : "A",
      })),
    }),
    q.id,
  );
  const varied = await manage(event(undefined, q.token), q.id);
  expect(varied.questionStats.map((s) => s.id)).toEqual(
    q.quiz.questions.map((question) => question.id),
  );
  expect(varied.questionStats.map((s) => s.correctRate)).toEqual([
    33,
    ...Array(9).fill(67),
  ]);
  await expect(manage(event(), q.id)).rejects.toMatchObject({ status: 403 });
  expect(await respondents(event(), q.id)).not.toHaveProperty("questionStats");
  await remove(event(undefined, q.token), q.id, a.id);
  const remaining = await manage(event(undefined, q.token), q.id);
  expect(
    remaining.questionStats.every(
      (s, i) =>
        s.total === 2 &&
        s.correctCount === (i === 0 ? 0 : 1) &&
        s.correctRate === (i === 0 ? 0 : 50),
    ),
  ).toBe(true);
});
it("作成者はBを選んだ問題も公開時の答えの内容を確認できる", async () => {
  const q = await create(10, "B");
  const managed = await manage(event(undefined, q.token), q.id);
  expect(managed.questionStats.map((s) => s.answer)).toEqual(
    q.quiz.questions.map((question) => question.choiceB),
  );
});
it("回答者の正答率は削除後に再集計する", async () => {
  const q = await create(10, "B");
  const answers = [];
  for (let i = 0; i < 5; i++) answers.push(await answer(q, "A"));
  const r = await result(
    event(undefined, answers[0].token),
    q.id,
    answers[0].id,
  );
  expect(r.response.correctCount).toBe(0);
  expect(
    (await manage(event(undefined, q.token), q.id)).questionStats[0],
  ).toMatchObject({ total: 5, correctRate: 0 });
  await remove(event(undefined, q.token), q.id, answers[0].id);
  expect(
    (await manage(event(undefined, q.token), q.id)).questionStats[0].total,
  ).toBe(4);
  await expect(
    result(event(undefined, answers[0].token), q.id, answers[0].id),
  ).rejects.toMatchObject({ status: 404 });
  expect(
    await config.DB.prepare(
      "SELECT count(*) n FROM response_answers WHERE response_id=?",
    )
      .bind(answers[0].id)
      .first("n"),
  ).toBe(0);
});
it("32件カーソルは同時刻でも重複せず新着順", async () => {
  const q = await create();
  for (let i = 0; i < 34; i++) await answer(q, i % 2 ? "A" : "B");
  const first = await respondents(event(), q.id);
  expect(first.items).toHaveLength(32);
  const stats = await manage(
    event(
      undefined,
      q.token,
      `?cursor=${encodeURIComponent(first.nextCursor ?? "")}`,
    ),
    q.id,
  );
  expect(
    stats.questionStats.every((s) => s.total === 34 && s.correctRate === 50),
  ).toBe(true);
  const second = await respondents(
    event(
      undefined,
      undefined,
      `?cursor=${encodeURIComponent(first.nextCursor!)}`,
    ),
    q.id,
  );
  expect(second.items).toHaveLength(2);
  expect(new Set([...first.items, ...second.items].map((r) => r.id)).size).toBe(
    34,
  );
  for (let i = 1; i < first.items.length; i++)
    expect(first.items[i - 1].createdAt).toBeGreaterThanOrEqual(
      first.items[i].createdAt,
    );
}, 30000);
it("不正トークンと他クイズの回答削除を拒み、全体削除で明細も消す", async () => {
  const q = await create(),
    other = await create();
  const a = await answer(q);
  await expect(manage(event(undefined, "wrong"), q.id)).rejects.toMatchObject({
    status: 403,
  });
  await expect(
    remove(event(undefined, "wrong"), q.id, a.id),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    remove(event(undefined, other.token), other.id, a.id),
  ).rejects.toMatchObject({ status: 404 });
  expect((await respondents(event(), q.id)).items).toHaveLength(1);
  await remove(event(undefined, q.token), q.id);
  await expect(publicQuiz(event(), q.id)).rejects.toMatchObject({
    status: 404,
  });
  expect(
    await config.DB.prepare("SELECT count(*) n FROM responses WHERE quiz_id=?")
      .bind(q.id)
      .first("n"),
  ).toBe(0);
  expect(
    await config.DB.prepare(
      "SELECT count(*) n FROM response_answers WHERE response_id=?",
    )
      .bind(a.id)
      .first("n"),
  ).toBe(0);
});
it("不完全・重複回答と診断問題の差し替えは受理しない", async () => {
  const q = await create();
  const a = await answer(q);
  await expect(
    submit(
      event({
        ...a.body,
        idempotencyKey: crypto.randomUUID(),
        answers: a.body.answers.slice(1),
      }),
      q.id,
    ),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    submit(
      event({
        ...a.body,
        idempotencyKey: crypto.randomUUID(),
        answers: a.body.answers.map(() => a.body.answers[0]),
      }),
      q.id,
    ),
  ).rejects.toMatchObject({ status: 400 });
  const chosen = templates.filter((t) => t.type === "normal").slice(0, 10);
  await expect(
    publish(
      event({
        characterName: "ひろし",
        managementToken: q.token,
        questions: chosen.map((t) => ({ templateId: t.id, answer: "A" })),
      }),
    ),
  ).rejects.toMatchObject({ status: 400 });
});
it("非表示への切り替え直後はDBでも新規回答登録を拒否する", async () => {
  const q = await create();
  await config.DB.prepare("UPDATE quizzes SET status='hidden' WHERE id=?")
    .bind(q.id)
    .run();
  await expect(
    config.DB.prepare(
      "INSERT INTO responses(id,quiz_id,respondent_name,correct_count,idempotency_key,result_access_token_hash,created_at) VALUES (?,?,?,?,?,?,?)",
    )
      .bind(
        crypto.randomUUID(),
        q.id,
        "友達",
        0,
        crypto.randomUUID(),
        "hash",
        Date.now(),
      )
      .run(),
  ).rejects.toThrow("quiz unavailable");
});
it("通報は名前の履歴を残し、受付とOutboxを保存してから通知する", async () => {
  const q = await create(),
    a = await answer(q);
  const r = await report(
    event({
      quizId: q.id,
      targetType: "response",
      targetId: a.id,
      reason: "不適切な名前",
    }),
  );
  await Promise.all(waits);
  await remove(event(undefined, q.token), q.id, a.id);
  expect(
    await config.DB.prepare(
      "SELECT target_name_snapshot FROM reports WHERE id=?",
    )
      .bind(r.id)
      .first("target_name_snapshot"),
  ).toMatch(/^友達/);
  expect(
    await config.DB.prepare(
      "SELECT status FROM notification_outbox WHERE reference_id=?",
    )
      .bind(r.id)
      .first("status"),
  ).toBe("pending");
  const c = await contact(
    event({ category: "不具合報告", message: "<!channel> @everyone" }),
  );
  expect(
    await config.DB.prepare("SELECT message FROM contacts WHERE id=?")
      .bind(c.id)
      .first("message"),
  ).toContain("<!channel>");
});
it("Slack失敗でも受付済みを維持し、再送成功後は重複送信しない", async () => {
  await config.DB.prepare("DELETE FROM notification_outbox").run();
  const c = await contact(
    event({ category: "その他", message: "<!channel> @everyone" }),
  );
  await Promise.all(waits);
  const send = vi
    .fn()
    .mockResolvedValue(new Response("error", { status: 500 }));
  vi.stubGlobal("fetch", send);
  const enabled = {
    ...config,
    SLACK_WEBHOOK_URL: "https://hooks.slack.test/local",
  };
  await retryNotifications(enabled);
  expect(
    await config.DB.prepare(
      "SELECT status FROM notification_outbox WHERE reference_id=?",
    )
      .bind(c.id)
      .first("status"),
  ).toBe("pending");
  expect(send).toHaveBeenCalledTimes(1);
  const payload = JSON.parse(send.mock.calls[0][1].body);
  expect(payload.text).toContain("&lt;!channel&gt; ＠everyone");
  expect(payload.mrkdwn).toBe(false);
  await config.DB.prepare(
    "UPDATE notification_outbox SET lease_until=NULL",
  ).run();
  send.mockResolvedValue(new Response("ok"));
  await retryNotifications(enabled);
  expect(
    await config.DB.prepare(
      "SELECT status FROM notification_outbox WHERE reference_id=?",
    )
      .bind(c.id)
      .first("status"),
  ).toBe("delivered");
  await retryNotifications(enabled);
  expect(send).toHaveBeenCalledTimes(2);
});

it("結果共有は本人だけが発行でき、公開値だけを返し、回答削除で失効する", async () => {
  const q = await create();
  const a = await answer(q);
  expect(Object.keys(await publicQuizCard(event(), q.id)).sort()).toEqual([
    "characterName",
    "id",
    "questionCount",
  ]);
  await expect(publicResultCard(event(), a.id)).rejects.toMatchObject({
    status: 404,
  });
  await expect(
    shareResult(event({}, "wrong"), q.id, a.id),
  ).rejects.toMatchObject({ status: 404 });
  const shared = await shareResult(event({}, a.token), q.id, a.id);
  expect(shared.id).not.toBe(a.id);
  expect((await shareResult(event({}, a.token), q.id, a.id)).id).toBe(
    shared.id,
  );
  const card = await publicResultCard(event(), shared.id);
  expect(card.score).toBe(100);
  for (const secret of [
    "selectedChoice",
    "correctChoice",
    "hikansenType",
    "respondentName",
    "resultAccessTokenHash",
    a.token,
    a.id,
  ])
    expect(JSON.stringify(card)).not.toContain(secret);
  await config.DB.prepare("UPDATE quizzes SET status='hidden' WHERE id=?")
    .bind(q.id)
    .run();
  await expect(publicResultCard(event(), shared.id)).rejects.toMatchObject({
    status: 404,
  });
  await config.DB.prepare("UPDATE quizzes SET status='published' WHERE id=?")
    .bind(q.id)
    .run();
  await remove(event(undefined, q.token), q.id, a.id);
  await expect(publicResultCard(event(), shared.id)).rejects.toMatchObject({
    status: 404,
  });
  expect(
    await config.DB.prepare("SELECT count(*) n FROM result_shares WHERE id=?")
      .bind(shared.id)
      .first("n"),
  ).toBe(0);
});

it("通常問題の回答も公開時の診断タイプに保存する", async () => {
  for (const [answer, expected] of [
    ["A", "battle"],
    ["B", "craft"],
  ] as const) {
    const { id } = await publish(
      event({
        characterName: "ひろし",
        managementToken: "m".repeat(64),
        ...(await beginPublish(event({ managementToken: "m".repeat(64) }))),
        questions: [
          "t001",
          "t002",
          "t003",
          "t004",
          "t029",
          "t034",
          "t005",
          "t059",
          "t065",
          "t015",
        ].map((templateId) => ({
          templateId,
          answer: templateId === "t005" ? answer : "A",
        })),
      }),
    );
    const saved = await config.DB.prepare(
      "SELECT hikansen_type FROM quizzes WHERE id = ?",
    )
      .bind(id)
      .first<{ hikansen_type: string }>();
    expect(saved?.hikansen_type).toBe(expected);
  }
});

it("文面移行は公開済みクイズの助詞だけを直し、再実行しても同じ状態になる", async () => {
  const q = await create();
  const id = q.quiz.questions[0].id;
  await config.DB.prepare(
    "UPDATE questions SET template_id='t107',question_snapshot=? WHERE id=?",
  )
    .bind("ひろし新エリアでまずしたいのは？", id)
    .run();
  const before = await config.DB.prepare("SELECT * FROM questions WHERE id=?")
    .bind(id)
    .first();
  const statements = readFileSync(
    "drizzle/0003_fix_question_particles.sql",
    "utf8",
  )
    .split("--> statement-breakpoint")
    .filter((s) => s.trim());
  for (let i = 0; i < 2; i++) {
    await config.DB.batch(statements.map((s) => config.DB.prepare(s)));
    expect(
      await config.DB.prepare("SELECT * FROM questions WHERE id=?")
        .bind(id)
        .first(),
    ).toEqual({
      ...before,
      question_snapshot: "ひろしが新エリアでまずしたいのは？",
    });
  }
});

it("出題者の回答傾向は同じ問題の公開クイズだけを集計する", async () => {
  const templateId = templates.find((t) => t.type === "diagnosis")!.id;
  const lookup = (choice: "A" | "B", id = templateId) =>
    creatorReaction(event({ templateId: id, choice }));
  await config.DB.prepare("UPDATE questions SET version=0 WHERE template_id=?")
    .bind(templateId)
    .run();
  expect(await lookup("A")).toEqual({ reaction: "まだ集計中！" });
  const seeds = [];
  for (let i = 0; i < 5; i++) seeds.push(await create(10, "A"));
  expect(await lookup("A")).toEqual({ reaction: "多数派！" });
  expect(await lookup("B")).toEqual({ reaction: "レア！" });
  for (let i = 0; i < 5; i++) await answer(seeds[0], "B");
  expect(await lookup("A")).toEqual({ reaction: "多数派！" });
  await config.DB.prepare("UPDATE quizzes SET status='hidden' WHERE id=?")
    .bind(seeds[1].id)
    .run();
  await remove(event(undefined, seeds[2].token), seeds[2].id);
  expect(await lookup("A")).toEqual({ reaction: "まだ集計中！" });
  await expect(lookup("A", "unknown")).rejects.toMatchObject({ status: 404 });
});

it("入口でTurnstileを検証し、署名付き許可なしの公開・回答送信を拒否する", async () => {
  const q = await create();
  const a = await answer(q);
  const entryEvent = (body: unknown) => {
    const e = event(body);
    e.locals.env = {
      ...config,
      LOCAL_TEST_MODE: "false",
      TURNSTILE_SECRET_KEY: "entry-test-secret",
      TURNSTILE_HOSTNAME: "hikaido.pl4rd.com",
    };
    return e;
  };
  const send = vi
    .fn()
    .mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ success: false }))),
    );
  vi.stubGlobal("fetch", send);
  const key = crypto.randomUUID();
  await expect(
    beginAnswer(
      entryEvent({
        idempotencyKey: key,
        resultToken: a.token,
        turnstile: "bad",
      }),
      q.id,
    ),
  ).rejects.toMatchObject({ status: 403 });
  send.mockImplementation(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          success: true,
          action: "answer",
          hostname: "hikaido.pl4rd.com",
        }),
      ),
    ),
  );
  const entry = await beginAnswer(
    entryEvent({
      idempotencyKey: key,
      resultToken: a.token,
      turnstile: "fresh",
    }),
    q.id,
  );
  const calls = send.mock.calls.length;
  const body = { ...a.body, idempotencyKey: key, ...entry };
  await expect(
    submit(entryEvent({ ...body, answerPermit: "" }), q.id),
  ).rejects.toMatchObject({ status: 403 });
  const submitted = await submit(entryEvent(body), q.id);
  expect(send.mock.calls).toHaveLength(calls);
  expect(await submit(entryEvent(body), q.id)).toEqual(submitted);
  send.mockImplementation(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          success: true,
          action: "publish",
          hostname: "hikaido.pl4rd.com",
        }),
      ),
    ),
  );
  const ownerEntry = await beginPublish(
    entryEvent({ managementToken: q.token, turnstile: "fresh" }),
  );
  const questions = templates
    .filter((t) => t.type === "diagnosis")
    .concat(templates.filter((t) => t.type === "normal").slice(0, 6))
    .map((t) => ({ templateId: t.id, answer: "A" }));
  const publishBody = {
    managementToken: q.token,
    characterName: "入口テスト",
    questions,
    ...ownerEntry,
  };
  await expect(
    publish(entryEvent({ ...publishBody, publishPermit: "" })),
  ).rejects.toMatchObject({ status: 403 });
  const published = await publish(entryEvent(publishBody));
  expect(await publish(entryEvent(publishBody))).toEqual(published);
});
