import { readdirSync, readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { getPlatformProxy } from "wrangler";
import { retryNotifications } from "../src/lib/server/notifications";
import type { ServiceEvent } from "../src/lib/server/security";
import {
  contact,
  manage,
  publicQuiz,
  publish,
  react,
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
    expect(r.questions.every((q) => q.stats.correctRate === 100)).toBe(true);
    const b = await submit(event(a.body), q.id);
    expect(b.id).toBe(a.id);
    expect((await respondents(event(), q.id)).items).toHaveLength(1);
    await expect(
      submit(event({ ...a.body, resultToken: "x".repeat(64) }), q.id),
    ).rejects.toMatchObject({ status: 409 });
  }
});
it("多数派が不正解の場合も正解を漏らさずリアクションし、削除後に再集計する", async () => {
  const q = await create(10, "B");
  const answers = [];
  for (let i = 0; i < 5; i++) answers.push(await answer(q, "A"));
  const qid = q.quiz.questions[0].id;
  expect(await react(event({ questionId: qid, choice: "A" }), q.id)).toEqual({
    reaction: "多数派！",
  });
  expect(await react(event({ questionId: qid, choice: "B" }), q.id)).toEqual({
    reaction: "レア！",
  });
  const r = await result(
    event(undefined, answers[0].token),
    q.id,
    answers[0].id,
  );
  expect(r.questions[0].stats).toMatchObject({ a: 5, b: 0, correctRate: 0 });
  await remove(event(undefined, q.token), q.id, answers[0].id);
  expect(await react(event({ questionId: qid, choice: "A" }), q.id)).toEqual({
    reaction: "まだ集計中！",
  });
  expect(
    (await result(event(undefined, answers[1].token), q.id, answers[1].id))
      .questions[0].stats.a,
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
it("50対50は割れてる、32件カーソルは同時刻でも重複せず新着順", async () => {
  const q = await create();
  for (let i = 0; i < 34; i++) await answer(q, i % 2 ? "A" : "B");
  const first = await respondents(event(), q.id);
  expect(first.items).toHaveLength(32);
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
  expect(
    await react(
      event({ questionId: q.quiz.questions[0].id, choice: "A" }),
      q.id,
    ),
  ).toEqual({ reaction: "割れてる！" });
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
