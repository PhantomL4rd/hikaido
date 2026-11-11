import { describe, expect, it } from "vitest";
import {
  chooseType,
  diagnose,
  makeDraft,
  reaction,
  replaceQuestion,
  statistics,
  types,
} from "../src/lib/domain";
import { templates } from "../src/lib/templates";

describe("診断", () => {
  it("固定4問が同じでも通常問題の回答で診断が変わる", () => {
    const questions = [
      "t001",
      "t002",
      "t003",
      "t004",
      "t029",
      "t032",
      "t005",
    ].map((id) => ({
      ...templates.find((q) => q.id === id)!,
      answer: "A" as const,
    }));
    expect(diagnose(questions)).toBe("battle");
    expect(diagnose(questions.map(({ id, answer }) => ({ id, answer })))).toBe(
      "battle",
    );
    expect(
      diagnose(
        questions.map((q) => ({
          ...q,
          answer: q.id === "t005" ? ("B" as const) : q.answer,
        })),
      ),
    ).toBe("craft");
  });
  it("すべての設問に8タイプ分の非負の採点を定義する", () => {
    for (const q of templates) {
      for (const choice of ["A", "B"] as const) {
        expect(q.typeScores?.[choice]).toHaveLength(8);
        expect(
          q.typeScores?.[choice].every(
            (score) => Number.isInteger(score) && score >= 0,
          ),
        ).toBe(true);
        expect(q.typeScores?.[choice].some((score) => score > 0)).toBe(true);
      }
    }
  });

  it("16通りで各タイプへ2回到達し再現可能", () => {
    const counts = new Map();
    for (let i = 0; i < 16; i++) {
      const a = Array.from({ length: 4 }, (_, j) =>
        (i >> j) & 1 ? "B" : "A",
      ) as ("A" | "B")[];
      const questions = templates
        .slice(0, 4)
        .map((q, j) => ({ ...q, answer: a[j] }));
      const t = diagnose(questions);
      expect(diagnose(questions)).toBe(t);
      counts.set(t, (counts.get(t) || 0) + 1);
    }
    expect(counts.size).toBe(8);
    expect([...counts.values()]).toEqual(Array(8).fill(2));
    expect(types).toHaveLength(8);
  });
});
describe("問題", () => {
  it("すべてのテンプレートを一意のIDで識別できる", () => {
    expect(new Set(templates.map((q) => q.id)).size).toBe(templates.length);
  });
  it("同じ二択の設問を重複して出題しない", () => {
    const pairs = templates.map((q) =>
      [q.choiceA, q.choiceB].sort().join("\n"),
    );
    expect(new Set(pairs).size).toBe(templates.length);
    expect(templates.some((q) => ["t009", "t010", "t028"].includes(q.id))).toBe(
      false,
    );
  });
  it("追加の17問を通常問題として選べる", () => {
    const added = templates.filter((q) =>
      Array.from(
        { length: 17 },
        (_, i) => `t${String(81 + i).padStart(3, "0")}`,
      ).includes(q.id),
    );
    expect(added).toHaveLength(17);
    expect(added.every((q) => q.type === "normal")).toBe(true);
  });
  for (const n of [10, 25] as const)
    it(`${n}問は重複なし診断4問`, () => {
      const d = makeDraft(n);
      expect(d.length).toBe(n);
      expect(new Set(d.map((q) => q.id)).size).toBe(n);
      expect(d.filter((q) => q.type === "diagnosis")).toHaveLength(4);
      const r = replaceQuestion(d, 4);
      expect(r[4].id).not.toBe(d[4].id);
      expect(r[4].answer).toBeUndefined();
      expect(replaceQuestion(d, 0)).toEqual(d);
    });
  it("通常テンプレート60問以上", () =>
    expect(
      templates.filter((q) => q.type === "normal").length,
    ).toBeGreaterThanOrEqual(60));
});
describe("統計とリアクション", () => {
  it("少数・境界・多数派", () => {
    expect(reaction(4, 4)).toBe("まだ集計中！");
    expect(reaction(7, 10)).toBe("多数派！");
    expect(reaction(3, 10)).toBe("レア！");
    for (const n of [4, 5, 6]) expect(reaction(n, 10)).toBe("割れてる！");
  });
  it("丸めたA/B割合の和は100", () => {
    expect(statistics(1, 2, "B")).toEqual({
      a: 1,
      b: 2,
      total: 3,
      percentA: 33,
      percentB: 67,
      correctRate: 67,
    });
    expect(statistics(0, 0, "A").correctRate).toBe(0);
  });
});

it("同点時は固定のタイプ順で判定する", () => {
  expect(chooseType(Array(8).fill(0))).toBe("battle");
  expect(chooseType([0, 2, 2, 0, 0, 0, 0, 0])).toBe("story");
});
it("差し替え候補が尽きたときは元の問題を維持する", () => {
  const all = templates.map((q) => ({ ...q, answer: "A" as const }));
  expect(replaceQuestion(all, 4)).toBe(all);
});
it("差し替え時は回答を消し、ほかの採用問題とは重複しない", () => {
  const draft = makeDraft(25);
  draft[4].answer = "B";
  const next = replaceQuestion(draft, 4);
  expect(next[4].answer).toBeUndefined();
  expect(new Set(next.map((q) => q.id)).size).toBe(25);
  expect(next[4].id).not.toBe(draft[4].id);
});
