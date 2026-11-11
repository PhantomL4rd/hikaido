import { afterEach, expect, it, vi } from "vitest";
import { api } from "../src/lib/client";
import { sanitizeSentryEvent, sentryPrivacy } from "../src/lib/sentry";

vi.mock("@sentry/sveltekit", () => ({ captureException: vi.fn() }));
vi.mock("#lib/paths", () => ({ base: "" }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("SDKの自動データ収集と性能・ログ・メトリクス送信を無効にする", () => {
  expect(sentryPrivacy.dataCollection).toMatchObject({
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
    databaseQueryData: false,
    stackFrameVariables: false,
    frameContextLines: 0,
  });
  expect(sentryPrivacy.tracesSampleRate).toBe(0);
  expect(sentryPrivacy.maxBreadcrumbs).toBe(0);
  expect(sentryPrivacy.beforeSendLog()).toBeNull();
  expect(sentryPrivacy.beforeSendMetric()).toBeNull();
});

it("例外のソース位置を残して秘密とユーザー入力を送信対象から除く", () => {
  const event = sanitizeSentryEvent({
    type: undefined,
    event_id: "event",
    level: "error",
    platform: "javascript",
    user: { email: "private@test.invalid" },
    extra: { token: "private" },
    tags: { operation: "api", quiz: "private" },
    request: {
      url: "https://test.invalid/q/private?token=private",
      headers: { authorization: "Bearer private" },
      data: "private",
    },
    contexts: { custom: { token: "private" } },
    breadcrumbs: [{ message: "private", data: { token: "private" } }],
    message: "private",
    transaction: "/q/private",
    exception: {
      values: [
        {
          type: "Error",
          value: "Failed query: private",
          stacktrace: {
            frames: [
              {
                filename:
                  "https://test.invalid/_app/immutable/chunks/a.js?token=private",
                lineno: 12,
                colno: 3,
                vars: { token: "private" },
                context_line: "private",
              },
            ],
          },
        },
      ],
    },
  });
  expect(JSON.stringify(event)).not.toContain("private");
  expect(event.exception?.values?.[0].stacktrace?.frames?.[0]).toEqual({
    filename: "https://test.invalid/_app/immutable/chunks/a.js",
    lineno: 12,
    colno: 3,
  });
  expect(event.tags).toEqual({ operation: "api" });
});

it.each([400, 403, 404, 429])(
  "想定内のHTTP %sをSentryに送らない",
  async (status) => {
    const { captureException } = await import("@sentry/sveltekit");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ message: "入力エラー" }), { status }),
        ),
    );
    await expect(
      api("quizzes/private", "POST", { token: "private" }),
    ).rejects.toThrow("入力エラー");
    expect(captureException).not.toHaveBeenCalled();
  },
);

it.each(["network", "server", "invalid-json"])(
  "APIの%s障害を捕捉して利用者にも返す",
  async (kind) => {
    const { captureException } = await import("@sentry/sveltekit");
    const fetch = vi.fn();
    if (kind === "network") fetch.mockRejectedValue(new TypeError("offline"));
    else
      fetch.mockResolvedValue(
        new Response(
          kind === "invalid-json"
            ? "broken"
            : JSON.stringify({ message: "障害" }),
          { status: kind === "server" ? 500 : 200 },
        ),
      );
    vi.stubGlobal("fetch", fetch);
    await expect(api("quizzes/private", "POST")).rejects.toThrow();
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(expect.any(Error), {
      tags: { operation: "api" },
    });
  },
);
