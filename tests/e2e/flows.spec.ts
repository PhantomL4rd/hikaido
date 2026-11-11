import { expect, test } from "@playwright/test";
import { types } from "../../src/lib/domain";
import { templates } from "../../src/lib/templates";

const root = "";
const headers = { origin: "http://127.0.0.1:5174" };
async function publish(
  request: import("@playwright/test").APIRequestContext,
  n = 10,
) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  const qs = [
    ...templates.filter((t) => t.type === "diagnosis"),
    ...templates.filter((t) => t.type === "normal").slice(0, n - 4),
  ];
  const r = await request.post(`${root}/api/quizzes`, {
    headers,
    data: {
      characterName: "テストのヒカセン",
      managementToken: token,
      questions: qs.map((t) => ({ templateId: t.id, answer: "A" })),
    },
  });
  expect(r.status()).toBe(201);
  return { ...((await r.json()) as { id: string }), token };
}
test("10問作成、下書き復元、変更、公開、挑戦、結果、管理削除", async ({
  page,
  browser,
}) => {
  await page.goto(`${root}/create`);
  await page.getByLabel("キャラクター名").fill("ひろし");
  await page.getByRole("button", { name: "2択をはじめる" }).click();
  await page.getByRole("button", { name: /A 高難度レイド/ }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: /A 高難度レイド/ }),
  ).toHaveAttribute("aria-pressed", "true");
  for (let i = 0; i < 10; i++) {
    if (i === 4) {
      const before = await page.locator(".question").textContent();
      await page.locator(".choice").first().click();
      await page.getByRole("button", { name: "べつの問題にする" }).click();
      await expect(page.locator(".question")).not.toHaveText(before || "");
      await expect(page.locator(".choice[aria-pressed=true]")).toHaveCount(0);
    }
    await page.locator(".choice").first().click();
    await page
      .getByRole("button", { name: i === 9 ? "こたえをみる" : "つぎへ" })
      .click();
  }
  await expect(page.getByText("公開前の確認")).toBeVisible();
  await page.getByRole("button", { name: "この内容で公開する" }).click();
  await expect(page.getByText("クイズができました！")).toBeVisible();
  const href = await page
    .getByRole("link", { name: "クイズを見る", exact: true })
    .getAttribute("href");
  const ownerState = await page.evaluate(() =>
    localStorage.getItem("hikaido-owned"),
  );
  const challenger = await browser.newContext();
  const friend = await challenger.newPage();
  await friend.goto(href!);
  await expect(friend.getByText("バトルジャンキー")).toHaveCount(0);
  await expect(
    friend.getByText(/名前・正解数・理解度・答えた日時.*一覧は誰でも見られる/),
  ).toBeVisible();
  await expect(
    friend.getByText(/本人の答えとどれくらい同じだったか/),
  ).toBeVisible();
  await friend.getByLabel("回答者名").fill("友達");
  await friend.getByRole("button", { name: "挑戦する" }).click();
  for (let i = 0; i < 10; i++) {
    await friend.locator(".choice").first().click();
    await expect(friend.getByText("まだ集計中！")).toBeVisible();
    await friend
      .getByRole("button", { name: i === 9 ? "こたえをみる" : "つぎへ" })
      .click();
  }
  await friend
    .getByRole("button", { name: "回答を確定して結果を見る" })
    .click();
  await expect(friend.locator(".score")).toContainText("100");
  await expect(
    friend.getByText(
      new RegExp(`^(${types.map((type) => type.name).join("|")})$`),
    ),
  ).toBeVisible();
  await friend.getByRole("button", { name: "結果を共有", exact: true }).click();
  const sharedHref = await friend
    .getByRole("link", { name: "Xで共有" })
    .getAttribute("href");
  expect(sharedHref).toContain("%2Fshare%2F");
  const sharedUrl = new URL(sharedHref!).searchParams.get("url")!;
  const publicView = await page.request.get(sharedUrl);
  expect(publicView.status()).toBe(200);
  const publicHtml = await publicView.text();
  expect(publicHtml).not.toContain("correctChoice");
  expect(publicHtml).not.toContain("selectedChoice");
  const shareId = new URL(sharedUrl).pathname.split("/").at(-1);
  const sharedImage = await page.request.get(`/og/result/${shareId}`);
  expect(sharedImage.status()).toBe(200);
  expect((await sharedImage.body()).readUInt32BE(16)).toBe(1200);
  const resultUrl = friend.url();
  await page.getByRole("link", { name: "こたえをみる", exact: true }).click();
  await expect(page.getByText("友達", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "回答者を削除" }).click();
  await page.getByRole("button", { name: "削除する", exact: true }).click();
  await expect(page.getByText("まだ回答がありません。")).toBeVisible();
  expect((await page.request.get(sharedUrl)).status()).toBe(404);
  expect((await page.request.get(`/og/result/${shareId}`)).status()).toBe(404);
  await friend.goto(resultUrl);
  await expect(friend.getByRole("alert")).toContainText("結果が見つかりません");
  expect(ownerState).toBeTruthy();
  await page.getByRole("button", { name: "クイズ全体を削除" }).click();
  await page.getByRole("button", { name: "削除する", exact: true }).click();
  await expect(page).toHaveURL(/\/manage$/);
  await challenger.close();
});
test("25問・正解秘匿・冪等性・権限・統計削除・不正入力", async ({
  page,
  request,
}) => {
  const q = await publish(request, 25);
  await page.goto(`${root}/q/${q.id}`);
  const html = await page.content();
  for (const field of [
    "correctChoice",
    "managementTokenHash",
    "hikansenType",
    "percentA",
  ])
    expect(html).not.toContain(field);
  const data = await page.evaluate(() =>
    JSON.parse(
      document.querySelector("script[data-sveltekit-fetched]")?.textContent ||
        "null",
    ),
  );
  const publicData = await page.locator("body").textContent();
  expect(publicData).not.toContain("バトルジャンキー");
  await page.getByLabel("回答者名").fill("再送テスト");
  await page.getByRole("button", { name: "挑戦する" }).click();
  for (let i = 0; i < 25; i++) {
    await page.locator(".choice").first().click();
    await page
      .getByRole("button", { name: i === 24 ? "こたえをみる" : "つぎへ" })
      .click();
  }
  await page.getByRole("button", { name: "回答を確定して結果を見る" }).click();
  await expect(page.locator(".score")).toContainText("100");
  const saved = await page.evaluate(
    (id) => JSON.parse(localStorage.getItem(`hikaido-answer-${id}`)!),
    q.id,
  );
  const result = await request.get(
    `${root}/api/quizzes/${q.id}/result/${saved.responseId}`,
    { headers: { authorization: `Bearer ${saved.resultToken}` } },
  );
  expect(result.ok()).toBe(true);
  const detail = await result.json();
  expect(detail.questions).toHaveLength(25);
  const body = {
    respondentName: "再送テスト",
    idempotencyKey: saved.idempotencyKey,
    resultToken: saved.resultToken,
    answers: detail.questions.map((x: { id: string }) => ({
      questionId: x.id,
      choice: "A",
    })),
  };
  const again = await request.post(`${root}/api/quizzes/${q.id}/responses`, {
    headers,
    data: body,
  });
  expect((await again.json()).id).toBe(saved.responseId);
  const wrong = await request.delete(
    `${root}/api/quizzes/${q.id}/responses/${saved.responseId}`,
    { headers: { ...headers, authorization: "Bearer wrong" } },
  );
  expect(wrong.status()).toBe(403);
  const leaked = await request.get(
    `${root}/api/quizzes/${q.id}/result/${saved.responseId}`,
  );
  expect(leaked.status()).toBe(403);
  const edited = await request.put(`${root}/api/quizzes/${q.id}`, {
    headers,
    data: {},
  });
  expect(edited.status()).toBe(405);
  await request.delete(`${root}/api/quizzes/${q.id}`, {
    headers: { ...headers, authorization: `Bearer ${q.token}` },
  });
  expect((await request.get(`${root}/q/${q.id}`)).status()).toBe(404);
});
test("通報・連投制限とお問い合わせを受け付ける", async ({ request, page }) => {
  const q = await publish(request);
  const data = {
    quizId: q.id,
    targetType: "quiz",
    targetId: q.id,
    reason: "不適切な名前",
  };
  expect(
    (await request.post(`${root}/api/reports`, { headers, data })).status(),
  ).toBe(201);
  expect(
    (await request.post(`${root}/api/reports`, { headers, data })).status(),
  ).toBe(429);
  expect(
    (
      await request.post(`${root}/api/contacts`, {
        headers,
        data: { category: "その他", message: "テストのお問い合わせ" },
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await request.post(`${root}/api/contacts`, {
        headers,
        data: { category: "その他", message: "a".repeat(1001) },
      })
    ).status(),
  ).toBe(400);
  const contact = await request.get(`${root}/contact`, { maxRedirects: 0 });
  expect(contact.status()).toBe(303);
  expect(contact.headers().location).toBe(
    "https://contact.pl4rd.com/?service=hikaido",
  );
  await page.goto(`${root}/`);
  await expect(
    page.locator("footer").getByRole("link", { name: "お問い合わせ" }),
  ).toHaveAttribute("href", "https://contact.pl4rd.com/?service=hikaido");

  await request.delete(`${root}/api/quizzes/${q.id}`, {
    headers: { ...headers, authorization: `Bearer ${q.token}` },
  });
});
