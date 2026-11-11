import { error } from "@sveltejs/kit";
import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as v from "valibot";
import { diagnose, reaction, statistics } from "#lib/domain";
import { origin } from "#lib/paths";
import { templates } from "#lib/templates";
import {
  answerSchema,
  contactSchema,
  publishSchema,
  reportSchema,
} from "#lib/validation";
import { retryNotifications } from "./notifications";
import {
  contacts,
  outbox,
  questions,
  quizzes,
  reports,
  responseAnswers,
  responses,
} from "./schema";
import type { ServiceEvent } from "./security";
import { bearer, env, hash, rate, read, turnstile, verify } from "./security";
export function database(e: ServiceEvent) {
  return drizzle(env(e).DB);
}
export async function publicQuiz(e: ServiceEvent, id: string) {
  const db = database(e);
  const [q] = await db
    .select({
      id: quizzes.id,
      characterName: quizzes.characterName,
      questionCount: quizzes.questionCount,
    })
    .from(quizzes)
    .where(and(eq(quizzes.id, id), eq(quizzes.status, "published")));
  if (!q) error(404, "クイズが見つかりません");
  const qs = await db
    .select({
      id: questions.id,
      position: questions.position,
      question: questions.question,
      choiceA: questions.choiceA,
      choiceB: questions.choiceB,
    })
    .from(questions)
    .where(eq(questions.quizId, id))
    .orderBy(questions.position);
  return { ...q, questions: qs };
}
async function owner(e: ServiceEvent, id: string) {
  const [q] = await database(e)
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, id));
  if (!q || !(await verify(bearer(e), q.managementTokenHash)))
    error(403, "管理権限がありません");
  return q;
}
export async function respondents(e: ServiceEvent, id: string) {
  await publicQuiz(e, id);
  const db = database(e);
  const cursor = e.url.searchParams.get("cursor");
  let condition = eq(responses.quizId, id);
  if (cursor) {
    let parsed: { t: number; id: string };
    try {
      parsed = JSON.parse(atob(cursor));
      if (!Number.isSafeInteger(parsed.t) || typeof parsed.id !== "string")
        throw new Error();
    } catch {
      error(400, "カーソルが不正です");
    }
    condition = and(
      condition,
      or(
        lt(responses.createdAt, parsed.t),
        and(eq(responses.createdAt, parsed.t), lt(responses.id, parsed.id)),
      ),
    )!;
  }
  const rows = await db
    .select({
      id: responses.id,
      name: responses.respondentName,
      correctCount: responses.correctCount,
      createdAt: responses.createdAt,
    })
    .from(responses)
    .where(condition)
    .orderBy(desc(responses.createdAt), desc(responses.id))
    .limit(33);
  const items = rows.slice(0, 32);
  const last = items.at(-1);
  const [summary] = await db
    .select({ total: sql<number>`count(*)` })
    .from(responses)
    .where(eq(responses.quizId, id));
  return {
    total: Number(summary.total),
    items,
    nextCursor:
      rows.length > 32 && last
        ? btoa(JSON.stringify({ t: last.createdAt, id: last.id }))
        : null,
  };
}
export async function publish(e: ServiceEvent) {
  await rate(e, "publish", 8, 3600);
  const data = await read(e, publishSchema);
  await turnstile(e, data.turnstile, "publish");
  const n = data.questions.length;
  if (n !== 10 && n !== 25) error(400, "10問または25問を選んでください");
  if (new Set(data.questions.map((q) => q.templateId)).size !== n)
    error(400, "問題が重複しています");
  const chosen = data.questions.map((q) => {
    const t = templates.find((t) => t.id === q.templateId);
    if (!t) error(400, "未登録の問題です");
    return { ...t, answer: q.answer };
  });
  const diagnostics = templates.filter((t) => t.type === "diagnosis");
  if (
    !diagnostics.every((q, i) => chosen[i]?.id === q.id) ||
    chosen.slice(4).some((q) => q.type === "diagnosis")
  )
    error(400, "診断問題が不正です");
  const id = crypto.randomUUID();
  const db = database(e);
  await db.batch([
    db.insert(quizzes).values({
      id,
      characterName: data.characterName,
      questionCount: n,
      hikansenType: diagnose(chosen),
      managementTokenHash: await hash(data.managementToken),
      createdAt: Date.now(),
    }),
    ...chosen.map((q, i) =>
      db.insert(questions).values({
        id: crypto.randomUUID(),
        quizId: id,
        templateId: q.id,
        version: q.version,
        position: i,
        isTypeQuestion: q.type === "diagnosis",
        question: q.question.replaceAll("{name}", data.characterName),
        choiceA: q.choiceA,
        choiceB: q.choiceB,
        correctChoice: q.answer,
      }),
    ),
  ]);
  return { id };
}
export async function submit(e: ServiceEvent, id: string) {
  await rate(e, "answer", 60, 3600);
  const data = await read(e, answerSchema);
  await publicQuiz(e, id);
  const db = database(e);
  const [existing] = await db
    .select()
    .from(responses)
    .where(
      and(
        eq(responses.quizId, id),
        eq(responses.idempotencyKey, data.idempotencyKey),
      ),
    );
  if (existing) {
    if (!(await verify(data.resultToken, existing.resultAccessTokenHash)))
      error(409, "再送の秘密情報が一致しません");
    return { id: existing.id };
  }
  await turnstile(e, data.turnstile, "answer");
  const qs = await db
    .select()
    .from(questions)
    .where(eq(questions.quizId, id))
    .orderBy(questions.position);
  if (
    data.answers.length !== qs.length ||
    new Set(data.answers.map((a) => a.questionId)).size !== qs.length ||
    !qs.every((q) => data.answers.some((a) => a.questionId === q.id))
  )
    error(400, "全問に回答してください");
  const rid = crypto.randomUUID();
  const answers = qs.map((q) => {
    const choice = data.answers.find((a) => a.questionId === q.id)!.choice;
    return {
      responseId: rid,
      questionId: q.id,
      selectedChoice: choice,
      isCorrect: choice === q.correctChoice,
    };
  });
  try {
    await db.batch([
      db.insert(responses).values({
        id: rid,
        quizId: id,
        respondentName: data.respondentName,
        correctCount: answers.filter((a) => a.isCorrect).length,
        idempotencyKey: data.idempotencyKey,
        resultAccessTokenHash: await hash(data.resultToken),
        createdAt: Date.now(),
      }),
      db.insert(responseAnswers).values(answers),
    ]);
  } catch (cause) {
    const [retry] = await db
      .select()
      .from(responses)
      .where(
        and(
          eq(responses.quizId, id),
          eq(responses.idempotencyKey, data.idempotencyKey),
        ),
      );
    if (retry && (await verify(data.resultToken, retry.resultAccessTokenHash)))
      return { id: retry.id };
    throw cause;
  }
  return { id: rid };
}
export async function react(e: ServiceEvent, id: string) {
  await rate(e, "reaction", 300);
  await publicQuiz(e, id);
  const data = await read(
    e,
    v.object({ questionId: v.string(), choice: v.picklist(["A", "B"]) }),
  );
  const db = database(e);
  const [q] = await db
    .select({ id: questions.id })
    .from(questions)
    .where(and(eq(questions.id, data.questionId), eq(questions.quizId, id)));
  if (!q) error(404, "問題が見つかりません");
  const rows = await db
    .select({
      choice: responseAnswers.selectedChoice,
      count: sql<number>`count(*)`,
    })
    .from(responseAnswers)
    .where(eq(responseAnswers.questionId, q.id))
    .groupBy(responseAnswers.selectedChoice);
  return {
    reaction: reaction(
      Number(rows.find((r) => r.choice === data.choice)?.count || 0),
      rows.reduce((n, r) => n + Number(r.count), 0),
    ),
  };
}
export async function result(e: ServiceEvent, id: string, rid: string) {
  const db = database(e);
  const quiz = await publicQuiz(e, id);
  const [r] = await db
    .select()
    .from(responses)
    .where(and(eq(responses.id, rid), eq(responses.quizId, id)));
  if (!r || !(await verify(bearer(e), r.resultAccessTokenHash)))
    error(404, "結果が見つかりません");
  const [q] = await db
    .select({ type: quizzes.hikansenType })
    .from(quizzes)
    .where(eq(quizzes.id, id));
  const answers = await db
    .select()
    .from(responseAnswers)
    .where(eq(responseAnswers.responseId, rid));
  const qs = await db
    .select()
    .from(questions)
    .where(eq(questions.quizId, id))
    .orderBy(questions.position);
  const grouped = await db
    .select({
      questionId: responseAnswers.questionId,
      choice: responseAnswers.selectedChoice,
      count: sql<number>`count(*)`,
    })
    .from(responseAnswers)
    .innerJoin(responses, eq(responses.id, responseAnswers.responseId))
    .where(eq(responses.quizId, id))
    .groupBy(responseAnswers.questionId, responseAnswers.selectedChoice);
  return {
    quiz,
    response: {
      id: r.id,
      name: r.respondentName,
      correctCount: r.correctCount,
    },
    type: q.type,
    questions: qs.map((q) => ({
      ...quiz.questions.find((x) => x.id === q.id)!,
      correctChoice: q.correctChoice,
      selectedChoice: answers.find((a) => a.questionId === q.id)!
        .selectedChoice,
      stats: statistics(
        Number(
          grouped.find((g) => g.questionId === q.id && g.choice === "A")
            ?.count || 0,
        ),
        Number(
          grouped.find((g) => g.questionId === q.id && g.choice === "B")
            ?.count || 0,
        ),
        q.correctChoice,
      ),
    })),
  };
}
export async function manage(e: ServiceEvent, id: string) {
  const q = await owner(e, id);
  const page = await respondents(e, id);
  return {
    id: q.id,
    characterName: q.characterName,
    questionCount: q.questionCount,
    ...page,
  };
}
export async function remove(e: ServiceEvent, id: string, rid?: string) {
  await owner(e, id);
  const db = database(e);
  if (rid) {
    const deleted = await db
      .delete(responses)
      .where(and(eq(responses.id, rid), eq(responses.quizId, id)))
      .returning({ id: responses.id });
    if (!deleted.length) error(404, "このクイズの回答が見つかりません");
  } else await db.delete(quizzes).where(eq(quizzes.id, id));
  return { ok: true };
}
export async function report(e: ServiceEvent) {
  await rate(e, "reports", 5, 3600);
  const d = await read(e, reportSchema);
  await turnstile(e, d.turnstile, "report");
  await publicQuiz(e, d.quizId);
  const db = database(e);
  let name: string;
  if (d.targetType === "quiz") {
    if (d.targetId !== d.quizId) error(400, "対象が不正です");
    const [q] = await db.select().from(quizzes).where(eq(quizzes.id, d.quizId));
    name = q.characterName;
  } else {
    const [r] = await db
      .select()
      .from(responses)
      .where(and(eq(responses.id, d.targetId), eq(responses.quizId, d.quizId)));
    if (!r) error(404, "対象が見つかりません");
    name = r.respondentName;
  }
  await rate(e, `target:${d.targetType}:${d.targetId}`, 1, 3600);
  const id = crypto.randomUUID(),
    now = Date.now();
  await db.batch([
    db.insert(reports).values({
      id,
      quizId: d.quizId,
      targetType: d.targetType,
      targetId: d.targetId,
      targetNameSnapshot: name,
      reason: d.reason,
      createdAt: now,
    }),
    db.insert(outbox).values({
      id: crypto.randomUUID(),
      eventType: "report",
      referenceId: id,
      createdAt: now,
      payload: `通報 ${d.targetType}\n理由: ${d.reason}\n対象: ${name}\nクイズID: ${d.quizId}\n${origin}/q/${d.quizId}\n日時: ${new Date(now).toISOString()}\n通報ID: ${id}`,
    }),
  ]);
  e.locals.waitUntil(retryNotifications(env(e)));
  return { id };
}
export async function contact(
  e: ServiceEvent,
  d?: v.InferOutput<typeof contactSchema>,
) {
  await rate(e, "contacts", 3, 3600);
  const data = d || (await read(e, contactSchema));
  await turnstile(e, data.turnstile, "contact");
  const id = crypto.randomUUID(),
    now = Date.now(),
    db = database(e);
  await db.batch([
    db.insert(contacts).values({
      id,
      name: data.name,
      email: data.email,
      category: data.category,
      message: data.message,
      createdAt: now,
    }),
    db.insert(outbox).values({
      id: crypto.randomUUID(),
      eventType: "contact",
      referenceId: id,
      createdAt: now,
      payload: `お問い合わせ ${data.category}\n名前: ${data.name || "未入力"}\nメール: ${data.email || "未入力"}\n${data.message}\n日時: ${new Date(now).toISOString()}\n受付ID: ${id}`,
    }),
  ]);
  e.locals.waitUntil(retryNotifications(env(e)));
  return { id };
}
