import { expect, test } from "@playwright/test";

const root = "";

test("最上部の案内帯を表示しない", async ({ page }) => {
  await page.goto(`${root}/`);
  await expect(
    page.getByText("FFXIVファンによる非公式サービス · 無料・ログイン不要"),
  ).toHaveCount(0);
});

test("OSの配色変更に追従し、ヘッダーの切り替えを保存して配色設定は表示しない", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto(`${root}/`);
  const html = page.locator("html");
  await expect(html).toHaveClass(/dark/);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    "content",
    "#24273a",
  );
  await page.emulateMedia({ colorScheme: "light" });
  await expect(html).not.toHaveClass(/dark/);
  await page.getByRole("button", { name: "配色を切り替える" }).click();
  await expect(html).toHaveClass(/dark/);
  await page.reload();
  await expect(html).toHaveClass(/dark/);
  await page.getByRole("button", { name: "メニューを開く" }).click();
  await expect(page.getByLabel("配色設定", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("combobox")).toHaveCount(0);
});

test("保存済みのライト設定をOSのダーク設定より優先する", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() =>
    localStorage.setItem("hikaido-theme", "light"),
  );
  await page.goto(`${root}/`);
  await expect(page.locator("html")).toHaveClass(/light/);
  await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    "content",
    "#eff1f5",
  );
});

test("ライト・ダークの操作色を他ツールと同じグレーに揃える", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(`${root}/`);
  const primary = page.getByRole("link", { name: "あなたのクイズを作る" });
  await expect(primary).toHaveCSS("background-color", "oklch(0.49 0.025 286)");
  await page.getByRole("button", { name: "配色を切り替える" }).click();
  await expect(primary).toHaveCSS("background-color", "oklch(0.798 0.032 274)");
});
