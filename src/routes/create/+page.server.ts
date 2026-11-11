import type { PageServerLoad } from "./$types";
export const load: PageServerLoad = (e) => ({
  sitekey: e.locals.env.PUBLIC_TURNSTILE_SITE_KEY || "",
});
