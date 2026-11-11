import { expect, it } from "vitest";
import { buildMetadata } from "../src/lib/metadata";
import { quizOg, resultOg } from "../src/lib/server/og/templates";

it("クイズ画像は名前と問題数だけを含む", () => {
  const json = JSON.stringify(
    quizOg({ characterName: "ひろし", questionCount: 25 }),
  );
  expect(json).toContain("ひろし");
  expect(json).toContain("Zen Maru Gothic Full");
  expect(json).toContain("全25問");
  for (const hidden of ["correctChoice", "hikansenType", "selectedChoice"])
    expect(json).not.toContain(hidden);
});
it("結果画像は0・52・100%を正確に描画する", () => {
  for (const [correct, total, score] of [
    [0, 10, 0],
    [13, 25, 52],
    [25, 25, 100],
  ]) {
    const json = JSON.stringify(
      resultOg({
        characterName: "ひろし",
        correctCount: correct,
        questionCount: total,
      }),
    );
    expect(json).toContain(`"${score}"`);
    expect(json).toContain(`${correct} / ${total} 問正解`);
  }
});
it("OGPとXに絶対URLと個別タイトルを使う", () => {
  const data = buildMetadata({
    title: "ひろし理解度チェック | ひかいど",
    description: "どのくらいしってる？",
    path: "/q/abc",
    image: "/og/quiz/abc",
  });
  expect(data.url).toBe("https://hikaido.pl4rd.com/q/abc");
  expect(data.image).toBe("https://hikaido.pl4rd.com/og/quiz/abc");
  expect(data.title).toContain("ひろし");
});
