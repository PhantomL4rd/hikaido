import * as Sentry from "@sentry/sveltekit";
import type { HandleClientError } from "@sveltejs/kit/hooks";
import { sentryPrivacy } from "#lib/sentry";
import { PUBLIC_SENTRY_DSN } from "$app/env/public";

Sentry.init({
  dsn: PUBLIC_SENTRY_DSN,
  enabled: Boolean(PUBLIC_SENTRY_DSN),
  ...sentryPrivacy,
});

const reportError = Sentry.handleErrorWithSentry<HandleClientError>(() => {});
export const handleError: HandleClientError = (input) => {
  if (input.kind === "unknown") return reportError(input);
};
