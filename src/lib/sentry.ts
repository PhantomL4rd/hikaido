import type { ErrorEvent } from "@sentry/sveltekit";

function assetUrl(value: string): string {
  const path = value.split(/[?#]/, 1)[0];
  if (/^(https?:)?\/\//.test(path)) {
    try {
      const url = new URL(path);
      return url.pathname.startsWith("/_app/")
        ? `${url.origin}${url.pathname}`
        : "[redacted]";
    } catch {
      return "[redacted]";
    }
  }
  return path;
}

export function sanitizeSentryEvent(event: ErrorEvent): ErrorEvent {
  const exceptions = event.exception?.values?.map((exception) => ({
    type: exception.type,
    value: "Application error (details redacted)",
    mechanism: exception.mechanism
      ? { type: exception.mechanism.type, handled: exception.mechanism.handled }
      : undefined,
    stacktrace: exception.stacktrace
      ? {
          frames: exception.stacktrace.frames?.map((frame) => ({
            filename: frame.filename ? assetUrl(frame.filename) : undefined,
            abs_path: frame.abs_path ? assetUrl(frame.abs_path) : undefined,
            function: frame.function,
            module: frame.module,
            lineno: frame.lineno,
            colno: frame.colno,
            in_app: frame.in_app,
            debug_id: frame.debug_id,
          })),
        }
      : undefined,
  }));
  return {
    type: undefined,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: event.platform,
    level: event.level,
    release: event.release,
    environment: event.environment,
    sdk: event.sdk,
    debug_meta: event.debug_meta,
    exception: exceptions ? { values: exceptions } : undefined,
    message: event.message ? "Application error (details redacted)" : undefined,
    tags: event.tags?.operation === "api" ? { operation: "api" } : undefined,
  };
}

export const sentryPrivacy = {
  tracesSampleRate: 0,
  maxBreadcrumbs: 0,
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
    databaseQueryData: false,
    queues: false,
    stackFrameVariables: false,
    frameContextLines: 0,
    genAI: { inputs: false, outputs: false },
    mcp: { inputs: false, outputs: false },
    graphQL: { document: false, variables: false },
  },
  beforeSend: sanitizeSentryEvent,
  beforeSendLog: () => null,
  beforeSendMetric: () => null,
};
