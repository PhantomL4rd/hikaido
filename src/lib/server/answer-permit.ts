import { hash } from "./security";

async function signingKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
function message(payload: string) {
  return new TextEncoder().encode(`hikaido-answer-entry-v1:${payload}`);
}
export async function issueAnswerPermit(
  secret: string,
  quizId: string,
  key: string,
  resultToken: string,
) {
  const payload = btoa(
    JSON.stringify([
      quizId,
      key,
      await hash(resultToken),
      Date.now() + 24 * 60 * 60 * 1000,
    ]),
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      await signingKey(secret),
      message(payload),
    ),
  );
  return `${payload}.${Array.from(signature, (n) => n.toString(16).padStart(2, "0")).join("")}`;
}
export async function verifyAnswerPermit(
  secret: string,
  permit: string,
  quizId: string,
  key: string,
  resultToken: string,
) {
  try {
    const [payload, signature, extra] = permit.split(".");
    if (extra || !payload || !/^[a-f0-9]{64}$/.test(signature || ""))
      return false;
    const valid = await crypto.subtle.verify(
      "HMAC",
      await signingKey(secret),
      Uint8Array.from(signature.match(/../g)!, (s) => Number.parseInt(s, 16)),
      message(payload),
    );
    if (!valid) return false;
    const [quiz, idempotencyKey, resultHash, expiresAt] = JSON.parse(
      atob(payload),
    );
    return (
      quiz === quizId &&
      idempotencyKey === key &&
      resultHash === (await hash(resultToken)) &&
      Number.isSafeInteger(expiresAt) &&
      expiresAt > Date.now()
    );
  } catch {
    return false;
  }
}
