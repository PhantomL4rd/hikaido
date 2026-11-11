import { captureException } from "@sentry/sveltekit";
import { base } from "#lib/paths";
export function secret() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  token?: string,
): Promise<T> {
  let expectedError = false;
  try {
    const r = await fetch(`${base}/api/${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await r.json();
    expectedError = r.status >= 400 && r.status < 500;
    if (!r.ok)
      throw new Error(
        (data as { message?: string }).message || "通信に失敗しました",
      );
    return data as T;
  } catch (cause) {
    if (!expectedError) captureException(cause, { tags: { operation: "api" } });
    throw cause;
  }
}
export function load<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
export function save(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}
export type Owned = { id: string; name: string; token: string };
export async function copy(text: string) {
  await navigator.clipboard.writeText(text);
}
