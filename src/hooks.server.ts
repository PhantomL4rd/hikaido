import { env, waitUntil } from "cloudflare:workers";
import {
  handleErrorWithSentry,
  initCloudflareSentryHandle,
  sentryHandle,
} from "@sentry/sveltekit";
import { error } from "@sveltejs/kit";
import {
  type Handle,
  type HandleServerError,
  sequence,
} from "@sveltejs/kit/hooks";
import { sentryPrivacy } from "#lib/sentry";
import { PUBLIC_SENTRY_DSN } from "$app/env/public";

const handleApplication: Handle = async ({ event, resolve }) => {
  event.locals.env = env;
  event.locals.waitUntil = waitUntil;
  let request = event.request;
  if (!["GET", "HEAD", "OPTIONS"].includes(event.request.method)) {
    const origin = event.request.headers.get("origin");
    if (origin && origin !== event.url.origin) error(403, "送信元が不正です");
    if (Number(event.request.headers.get("content-length") || 0) > 65536)
      error(413, "入力が大きすぎます");
    if (event.request.body) {
      const reader = event.request.body.getReader();
      let size = 0;
      const chunks: Uint8Array[] = [];
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 65536) {
          await reader.cancel();
          error(413, "入力が大きすぎます");
        }
        chunks.push(value);
      }
      const body = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.length;
      }
      request = new Request(event.request, { body });
    }
  }
  const r = await resolve({ ...event, request });
  r.headers.set("x-content-type-options", "nosniff");
  r.headers.set("referrer-policy", "same-origin");
  r.headers.set("x-frame-options", "DENY");
  if (
    event.url.pathname.includes("/q/") ||
    event.url.pathname.includes("/share/") ||
    event.url.pathname.includes("/og/") ||
    event.url.pathname.includes("/api/") ||
    event.url.pathname.includes("/manage")
  )
    r.headers.set("cache-control", "private, no-store");
  return r;
};

export const handle = sequence(
  initCloudflareSentryHandle({
    dsn: PUBLIC_SENTRY_DSN,
    enabled: Boolean(PUBLIC_SENTRY_DSN),
    ...sentryPrivacy,
  }),
  sentryHandle(),
  handleApplication,
);

const reportError = handleErrorWithSentry<HandleServerError>(() => {});
export const handleError: HandleServerError = (input) => {
  if (input.kind === "unknown") return reportError(input);
};
