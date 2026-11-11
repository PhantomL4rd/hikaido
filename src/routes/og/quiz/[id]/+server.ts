import { quizOg } from "#lib/server/og/templates";
import { rate } from "#lib/server/security";
import { publicQuizCard } from "#lib/server/sharing";
import type { RequestHandler } from "./$types";
export const GET: RequestHandler = async (e) => {
  await rate(e, "og", 60);
  const quiz = await publicQuizCard(e, e.params.id);
  const { ogResponse } = await import("#lib/server/og/render");
  return ogResponse(e, quizOg(quiz));
};
