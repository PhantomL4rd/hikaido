import { expect, test } from "@playwright/test";

for (const width of [390, 1280]) {
  test(`${width}px幅で共通サイドバーの寸法と文字サイズに揃う`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    await page.getByRole("button", { name: "メニューを開く" }).click();
    const drawer = page.getByRole("dialog", { name: "メニュー", exact: true });
    await expect(drawer).toHaveCSS("width", "256px");
    await expect(drawer.locator("nav")).toHaveCSS("padding", "8px");
    const link = drawer.getByRole("link", { name: "このサイトについて" });
    await expect(link).toHaveCSS("font-size", "14px");
    await expect(link).toHaveCSS("line-height", "20px");
    await expect(link).toHaveCSS("padding", "12px");
    await expect(link).toHaveCSS("border-radius", "8px");
    await expect(link.locator("svg")).toHaveAttribute("stroke-width", "2");
    await expect(drawer.getByText("外部リンク", { exact: true })).toHaveCSS(
      "font-size",
      "12px",
    );
    await expect(
      drawer.getByRole("button", { name: "メニューを閉じる" }),
    ).toHaveCSS("height", "36px");
    await expect(drawer.locator('a[target="_blank"]')).toHaveCount(3);
    await expect(
      drawer.locator('a[href="https://contact.pl4rd.com/?service=hikaido"]'),
    ).toHaveAttribute("target", "_blank");
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await link.hover();
      await expect(link).toHaveCSS(
        "background-color",
        scheme === "light" ? "oklch(0.864 0.012 286)" : "oklch(0.391 0.03 285)",
      );
    }
  });
}

test("メニューは余白クリックで閉じず、Escape・背景・リンクで閉じる", async ({
  page,
}) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "メニューを開く" });
  const drawer = page.getByRole("dialog", { name: "メニュー", exact: true });
  await trigger.click();
  await drawer.click({ position: { x: 128, y: 600 } });
  await expect(drawer).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.mouse.click(10, 100);
  await expect(drawer).not.toBeVisible();
  await trigger.click();
  await drawer.getByRole("link", { name: "このサイトについて" }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(drawer).not.toBeVisible();
});
