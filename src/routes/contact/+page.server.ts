import { fail } from "@sveltejs/kit";
import * as v from "valibot";
import { contact } from "#lib/server/service";
import { contactSchema } from "#lib/validation";
import type { Actions, PageServerLoad } from "./$types";
export const load: PageServerLoad = (e) => ({
  sitekey: e.locals.env.PUBLIC_TURNSTILE_SITE_KEY || "",
});
export const actions: Actions = {
  default: async (e) => {
    const form = await e.request.formData();
    const parsed = v.safeParse(contactSchema, {
      ...Object.fromEntries(form),
      turnstile: form.get("cf-turnstile-response") || "",
    });
    if (!parsed.success) return fail(400, { error: parsed.issues[0].message });
    const r = await contact(e, parsed.output);
    return { id: r.id };
  },
};
