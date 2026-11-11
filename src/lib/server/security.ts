import { error, type RequestEvent } from "@sveltejs/kit";
import * as v from "valibot";
export type ServiceEvent = Pick<
  RequestEvent,
  "request" | "url" | "locals" | "getClientAddress"
>;
export async function hash(s: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
}
export async function verify(token: string, expected: string) {
  const actual = await hash(token);
  let different = actual.length ^ expected.length;
  for (let i = 0; i < actual.length; i++)
    different |= actual.charCodeAt(i) ^ (expected.charCodeAt(i) || 0);
  return different === 0;
}
export function bearer(e: ServiceEvent) {
  const h = e.request.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) error(403, "秘密情報が必要です");
  return h.slice(7);
}
export function env(e: ServiceEvent) {
  if (!e.locals.env?.DB) error(503, "データベースが未設定です");
  return e.locals.env;
}
export async function read<T extends v.GenericSchema>(
  e: ServiceEvent,
  s: T,
): Promise<v.InferOutput<T>> {
  const reader = e.request.body?.getReader();
  if (!reader) error(400, "入力がありません");
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 65536) {
      await reader.cancel();
      error(413, "入力が大きすぎます");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  let data: unknown;
  try {
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    error(400, "JSON形式が不正です");
  }
  const r = v.safeParse(s, data);
  if (!r.success) error(400, r.issues[0].message);
  return r.output;
}
export async function rate(
  e: ServiceEvent,
  scope: string,
  max = 20,
  seconds = 60,
) {
  const db = env(e).DB;
  const now = Math.floor(Date.now() / 1000);
  const ip = e.request.headers.get("cf-connecting-ip") || e.getClientAddress();
  const key = await hash(`${scope}:${ip}:${Math.floor(now / seconds)}`);
  const r = await db
    .prepare(
      "INSERT INTO rate_limits(key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count",
    )
    .bind(key, now + seconds)
    .first<{ count: number }>();
  if ((r?.count || 0) > max) error(429, "少し待ってからお試しください");
  await db
    .prepare("DELETE FROM rate_limits WHERE expires_at < ?")
    .bind(now - 3600)
    .run();
}
export async function turnstile(
  e: ServiceEvent,
  token: string,
  action: string,
) {
  const config = env(e);
  if (
    config.LOCAL_TEST_MODE === "true" &&
    ["localhost", "127.0.0.1"].includes(e.url.hostname)
  )
    return;
  if (!config.TURNSTILE_SECRET_KEY) error(503, "認証の設定が必要です");
  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          secret: config.TURNSTILE_SECRET_KEY,
          response: token,
        }),
        signal: AbortSignal.timeout(10000),
      },
    );
    const r = (await response.json()) as {
      success: boolean;
      action: string;
      hostname: string;
    };
    if (
      !response.ok ||
      !r.success ||
      r.action !== action ||
      r.hostname !== config.TURNSTILE_HOSTNAME
    )
      error(403, "認証をやり直してください");
  } catch {
    error(403, "認証をやり直してください");
  }
}
