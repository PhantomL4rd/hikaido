import * as v from "valibot";
import { expect, it, vi } from "vitest";
import { escapeSlack } from "../src/lib/server/notifications";
import { hash, verify } from "../src/lib/server/security";
import { contactSchema, nameSchema } from "../src/lib/validation";

it("名前と連絡先をサーバーで検証する", () => {
  for (const name of ["", "<script>", "a".repeat(31), "a\nb"])
    expect(v.safeParse(nameSchema, name).success).toBe(false);
  expect(v.parse(nameSchema, "  ひろし  ")).toBe("ひろし");
  expect(
    v.safeParse(contactSchema, {
      category: "その他",
      message: "a".repeat(1001),
    }).success,
  ).toBe(false);
  expect(
    v.safeParse(contactSchema, {
      category: "その他",
      message: "こんにちは",
      email: "bad",
    }).success,
  ).toBe(false);
  expect(
    v.safeParse(contactSchema, { category: "その他", message: "こんにちは" })
      .success,
  ).toBe(true);
});
it("管理秘密をハッシュ化して照合する", async () => {
  const digest = await hash("a".repeat(64));
  expect(digest).not.toContain("a".repeat(64));
  expect(await verify("a".repeat(64), digest)).toBe(true);
  expect(await verify("b".repeat(64), digest)).toBe(false);
});
it("Slackのメンションやリンク記法を無効化する", () => {
  expect(escapeSlack("<!channel> @everyone & <https://x|x>")).toBe(
    "&lt;!channel&gt; ＠everyone &amp; &lt;https://x|x&gt;",
  );
});

it("Turnstileはaction・hostname不一致と通信失敗を拒否する", async () => {
  const { turnstile } = await import("../src/lib/server/security");
  const event = {
    url: new URL("https://hikaido.pl4rd.com/"),
    locals: {
      env: {
        DB: {},
        LOCAL_TEST_MODE: "false",
        TURNSTILE_SECRET_KEY: "test-only",
        TURNSTILE_HOSTNAME: "hikaido.pl4rd.com",
      },
    },
  } as import("../src/lib/server/security").ServiceEvent;
  const send = vi.fn();
  vi.stubGlobal("fetch", send);
  send.mockResolvedValue(
    new Response(
      JSON.stringify({
        success: true,
        action: "report",
        hostname: "hikaido.pl4rd.com",
      }),
    ),
  );
  await expect(
    turnstile(event, "fresh-token", "report"),
  ).resolves.toBeUndefined();
  for (const payload of [
    { success: false, action: "report", hostname: "hikaido.pl4rd.com" },
    { success: true, action: "answer", hostname: "hikaido.pl4rd.com" },
    { success: true, action: "report", hostname: "evil.test" },
  ]) {
    send.mockResolvedValue(new Response(JSON.stringify(payload)));
    await expect(turnstile(event, "token", "report")).rejects.toMatchObject({
      status: 403,
    });
  }
  send.mockRejectedValue(new Error("offline"));
  await expect(turnstile(event, "token", "report")).rejects.toMatchObject({
    status: 403,
  });
  vi.unstubAllGlobals();
});
