import { defineEnvVars } from "@sveltejs/kit/env";

export const variables = defineEnvVars({
  PUBLIC_SENTRY_DSN: { public: true, schema: (input) => input ?? "" },
});
