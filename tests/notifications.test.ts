import { afterEach, expect, it, vi } from "vitest";
import { retryNotifications } from "../src/lib/server/notifications";

afterEach(() => vi.unstubAllGlobals());
it("Webhook未設定ならイベントを保持する", async () => {
  const prepare = vi.fn();
  await retryNotifications({ DB: { prepare } } as unknown as Env);
  expect(prepare).not.toHaveBeenCalled();
});
