import type { PageServerLoad } from "./$types";
export const load: PageServerLoad = (e) => ({
  sitekey: e.locals.env.PUBLIC_TURNSTILE_SITE_KEY || "",
  quizId: e.url.searchParams.get("quiz") || "",
  targetType: e.url.searchParams.get("type") || "",
  targetId: e.url.searchParams.get("target") || "",
});
