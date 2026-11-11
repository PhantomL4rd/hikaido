import { expect, test } from "@playwright/test";
import { templates } from "../../src/lib/templates";

const root = "";
test("文言・Lucideハート・favicon・共通OGPをSSRで返す", async ({
  page,
  request,
}) => {
  await page.goto(`${root}/`);
  await expect(page.locator("header")).toContainText("ひかいど");
  await expect(page.locator("header")).not.toContainText("HIKAIDO");
  await expect(page.locator("header .lucide-heart")).toHaveCount(1);
  await expect(
    page.getByRole("heading", {
      name: /あのヒカセンのこと、\s*どのくらいしってる？/,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "あなたのクイズを作る" }),
  ).toBeVisible();
  await expect(page.getByText("A LITTLE QUIZ, A NEW DISCOVERY.")).toHaveCount(
    0,
  );
  const html = await (await request.get(`${root}/`)).text();
  expect((html.match(/property="og:image"/g) || []).length).toBe(1);
  expect(html).toContain("https://hikaido.pl4rd.com/og-default.png");
  expect(
    (await request.get(`${root}/favicon.svg`)).headers()["content-type"],
  ).toContain("image/svg+xml");
  const png = await request.get(`${root}/og-default.png`);
  expect(png.status()).toBe(200);
  const bytes = await png.body();
  expect(bytes.readUInt32BE(16)).toBe(1200);
  expect(bytes.readUInt32BE(20)).toBe(630);
  await page.goto(`${root}/create`);
  for (const text of [
    "どちらも4問の共通タイプ診断を含みます。",
    "この4問はタイプ診断のため固定です。",
    "下書きはこの端末に自動保存されます。",
  ])
    await expect(page.getByText(text)).toHaveCount(0);
});
test("クイズ別OGPは1200×630のPNGを生成し削除後は配信しない", async ({
  request,
}) => {
  const token = crypto.randomUUID() + crypto.randomUUID();
  const qs = [
    ...templates.filter((t) => t.type === "diagnosis"),
    ...templates.filter((t) => t.type === "normal").slice(0, 6),
  ];
  const published = await request.post(`${root}/api/quizzes`, {
    data: {
      characterName: "朝比奈 ひかり",
      managementToken: token,
      questions: qs.map((t) => ({ templateId: t.id, answer: "A" })),
    },
  });
  expect(published.status()).toBe(201);
  const { id } = await published.json();
  const html = await (await request.get(`${root}/q/${id}`)).text();
  expect(html).toContain(`https://hikaido.pl4rd.com/og/quiz/${id}`);
  expect((html.match(/property="og:image"/g) || []).length).toBe(1);
  expect(html).toContain("朝比奈 ひかり理解度チェック");
  const image = await request.get(`${root}/og/quiz/${id}`);
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toBe("image/png");
  expect(image.headers()["cache-control"]).toContain("no-store");
  const bytes = await image.body();
  expect(bytes.readUInt32BE(16)).toBe(1200);
  expect(bytes.readUInt32BE(20)).toBe(630);
  await request.delete(`${root}/api/quizzes/${id}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect((await request.get(`${root}/og/quiz/${id}`)).status()).toBe(404);
});
