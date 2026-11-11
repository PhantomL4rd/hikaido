import { publicQuiz, respondents } from "#lib/server/service";
import type { PageServerLoad } from "./$types";
export const load: PageServerLoad = async (e) => ({
  quiz: await publicQuiz(e, e.params.id),
  page: await respondents(e, e.params.id),
});
