import { expect, test } from "@playwright/test";
import { templates } from "../../src/lib/templates";

for (const count of [10, 25] as const) {
  test(`${count}問の回答をすべて消して同じ設問の1問目から回答し直せる`, async ({
    page,
  }) => {
    const draft = templates
      .slice(0, count)
      .map((question) => ({ ...question, answer: "A" }));
    await page.addInitScript(
      (value) => {
        if (!localStorage.getItem("hikaido-draft")) {
          localStorage.setItem("hikaido-draft", JSON.stringify(value));
        }
      },
      {
        name: "らーどよん",
        count,
        draft,
        position: count - 1,
        stage: "review",
      },
    );
    await page.goto("/create");
    await page
      .getByRole("button", { name: "全部回答し直す", exact: true })
      .click();
    const heading = page.getByRole("heading", {
      name: "らーどよんは挑戦するなら？",
    });
    await expect(heading).toBeFocused();
    await expect(page.locator(".choice[aria-pressed=true]")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "つぎへ", exact: true }),
    ).toBeDisabled();
    await expect
      .poll(async () =>
        page.evaluate(() =>
          JSON.parse(localStorage.getItem("hikaido-draft") || "null"),
        ),
      )
      .toMatchObject({
        name: "らーどよん",
        count,
        position: 0,
        stage: "questions",
        draft: draft.map(({ answer, ...question }) => question),
      });
    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("hikaido-draft") || "null"),
    );
    expect(
      saved.draft.every(
        (question: { answer?: string }) => question.answer === undefined,
      ),
    ).toBe(true);
    await page.reload();
    await expect(page.locator(".choice[aria-pressed=true]")).toHaveCount(0);
    await page.locator(".choice").last().click();
    await page.getByRole("button", { name: "つぎへ", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "らーどよんが休日に楽しむのは？" }),
    ).toBeVisible();
    await expect(page.locator(".choice[aria-pressed=true]")).toHaveCount(0);
    await page.getByRole("button", { name: "もどる", exact: true }).click();
    await expect(page.locator(".choice").last()).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
}
