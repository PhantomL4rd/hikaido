import { error } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { quizzes, responses, resultShares } from "./schema";
import { bearer, env, rate, type ServiceEvent, verify } from "./security";
export async function publicQuizCard(e: ServiceEvent, id: string) {
  const [quiz] = await drizzle(env(e).DB)
    .select({
      id: quizzes.id,
      characterName: quizzes.characterName,
      questionCount: quizzes.questionCount,
    })
    .from(quizzes)
    .where(and(eq(quizzes.id, id), eq(quizzes.status, "published")));
  if (!quiz) error(404, "クイズが見つかりません");
  return quiz;
}
export async function shareResult(
  e: ServiceEvent,
  quizId: string,
  responseId: string,
) {
  await rate(e, "result-share", 30, 60);
  await publicQuizCard(e, quizId);
  const db = drizzle(env(e).DB);
  const [response] = await db
    .select({ hash: responses.resultAccessTokenHash })
    .from(responses)
    .where(and(eq(responses.id, responseId), eq(responses.quizId, quizId)));
  if (!response || !(await verify(bearer(e), response.hash)))
    error(404, "結果が見つかりません");
  await db
    .insert(resultShares)
    .values({ id: crypto.randomUUID(), responseId, createdAt: Date.now() })
    .onConflictDoNothing({ target: resultShares.responseId });
  const [share] = await db
    .select({ id: resultShares.id })
    .from(resultShares)
    .where(eq(resultShares.responseId, responseId));
  if (!share) error(404, "結果が見つかりません");
  return share;
}
export async function publicResultCard(e: ServiceEvent, id: string) {
  const [shared] = await drizzle(env(e).DB)
    .select({
      id: resultShares.id,
      quizId: quizzes.id,
      characterName: quizzes.characterName,
      questionCount: quizzes.questionCount,
      correctCount: responses.correctCount,
    })
    .from(resultShares)
    .innerJoin(responses, eq(responses.id, resultShares.responseId))
    .innerJoin(quizzes, eq(quizzes.id, responses.quizId))
    .where(and(eq(resultShares.id, id), eq(quizzes.status, "published")));
  if (!shared) error(404, "共有結果が見つかりません");
  return {
    ...shared,
    score: Math.round((shared.correctCount / shared.questionCount) * 100),
  };
}
