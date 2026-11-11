import { expect, it, vi } from "vitest";
import {
  issueAnswerPermit,
  verifyAnswerPermit,
} from "../src/lib/server/answer-permit";

it("入口の許可はクイズと回答秘密に紐付き、改ざんと期限切れを拒否する", async () => {
  const secret = "test-secret";
  const claims = ["quiz", "key", "result-token"] as const;
  const permit = await issueAnswerPermit(secret, ...claims);
  expect(await verifyAnswerPermit(secret, permit, ...claims)).toBe(true);
  expect(
    await verifyAnswerPermit(secret, permit, "other", "key", "result-token"),
  ).toBe(false);
  expect(
    await verifyAnswerPermit(secret, permit, "quiz", "other", "result-token"),
  ).toBe(false);
  expect(await verifyAnswerPermit(secret, permit, "quiz", "key", "other")).toBe(
    false,
  );
  expect(await verifyAnswerPermit(secret, permit + "x", ...claims)).toBe(false);
  expect(await verifyAnswerPermit("other-secret", permit, ...claims)).toBe(
    false,
  );
  vi.spyOn(Date, "now").mockReturnValue(Date.now() + 24 * 60 * 60 * 1000 + 1);
  try {
    expect(await verifyAnswerPermit(secret, permit, ...claims)).toBe(false);
  } finally {
    vi.restoreAllMocks();
  }
});
