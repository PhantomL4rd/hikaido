import { publicQuiz } from "#lib/server/service";
import type { PageServerLoad } from "./$types";
export const load: PageServerLoad = async (e) => ({
  quiz: await publicQuiz(e, e.params.id),
  sitekey: e.locals.env.PUBLIC_TURNSTILE_SITE_KEY || "",
});
