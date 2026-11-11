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
      "t034",
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
      }
    }
  });

  it("固定問は回答が直接示す関心だけに加点する", () => {
    expect(templates.find((q) => q.id === "t001")?.typeScores?.B).toEqual(
      Array(8).fill(0),
    );
    expect(templates.find((q) => q.id === "t004")?.typeScores?.B).toEqual(
      Array(8).fill(0),
    );
    for (const answer of ["A", "B"] as const) {
      expect(
        templates.find((q) => q.id === "t002")?.typeScores?.[answer],
      ).toEqual([0, 2, 0, 0, 0, 0, 0, 0]);
    }
    expect(templates.find((q) => q.id === "t003")?.typeScores?.A).toEqual([
      0, 0, 2, 0, 0, 0, 0, 0,
    ]);
  });

  it("種族や音楽、ジョブ、日常の好みは診断を変えない", () => {
    const base = ["t001", "t002", "t003", "t004"].map((id) => ({
      id,
      answer: "A" as const,
    }));
    const neutral = [
      "t006",
      "t007",
      "t014",
      "t015",
      "t021",
      "t026",
      "t034",
      "t037",
      "t040",
      "t049",
      "t077",
      "t079",
      "t085",
      "t086",
      "t087",
      "t090",
      "t092",
      "t093",
    ];
    for (const answer of ["A", "B"] as const) {
      for (const id of neutral) {
        expect(
          templates.find((q) => q.id === id)?.typeScores?.[answer],
        ).toEqual(Array(8).fill(0));
      }
      expect(
        diagnose([...base, ...neutral.map((id) => ({ id, answer }))]),
      ).toBe(diagnose(base));
    }
  });

  it("らーどよんの25回答は物語の旅人になりバトルへの加点はない", () => {
    const choices = [
      "気軽にルーレット",
      "メインストーリー",
      "ミラプリ",
      "マーケットで購入",
      "バトルBGM",
      "内装づくり",
      "まとめて保管",
      "その場で飛び跳ねる",
      "晴れた青空",
      "ジョブごとに変える",
      "植物",
      "アウラ",
      "テキストチャット派",
      "タンヒラ",
      "いろいろ使う",
      "まずジャンプ",
      "かっこいい系",
      "ギャザクラでコツコツ",
      "探検手帳",
      "笑顔でかわいく",
      "装備コンプリート",
      "固定パーティ",
      "ノーマルレイド",
      "ララフェル",
      "いつもの定位置",
    ];
    const answers = choices.map((choice) => {
      const matches = templates.filter(
        (q) => q.choiceA === choice || q.choiceB === choice,
      );
      expect(matches).toHaveLength(1);
      const q = matches[0];
      const answer = q.choiceA === choice ? ("A" as const) : ("B" as const);
      expect(q.typeScores?.[answer][0]).toBe(0);
      return { id: q.id, answer };
    });
    expect(diagnose(answers)).toBe("story");
  });

  it("追加11問は好みに対応するタイプだけに1点を加算する", () => {
    const expected = [
      ["battle", "fashion"],
      ["battle", "housing"],
      ["battle", "craft"],
      ["battle", "explorer"],
      ["housing", "craft"],
      ["housing", "story"],
      ["housing", "explorer"],
      ["craft", "story"],
      ["craft", "explorer"],
      ["story", "explorer"],
      ["story", "fashion"],
    ];
    const totals = types.map(() => 0);
    expected.forEach((pair, i) => {
      const question = templates.find(
        (q) => q.id === `t${String(99 + i).padStart(3, "0")}`,
      );
      expect(question?.type).toBe("normal");
      for (const [j, answer] of (["A", "B"] as const).entries()) {
        const scores = types.map((type) => Number(type.id === pair[j]));
        expect(question?.typeScores?.[answer]).toEqual(scores);
        scores.forEach((score, index) => {
          totals[index] += score;
        });
      }
    });
    expect(totals).toEqual([4, 4, 2, 4, 4, 0, 4, 0]);
    expect(templates.find((q) => q.id === "t099")?.choiceB).toBe(
      "新しいおしゃれ装備",
    );
  });

  it.each(types.map((type, i) => [type.id, i] as const))(
    "%sは関心に沿った回答で到達できる",
    (id, index) => {
      const answers = templates.flatMap((q) => {
        if (!q.typeScores) throw new Error(`配点が未定義です: ${q.id}`);
        const a = q.typeScores.A[index];
        const b = q.typeScores.B[index];
        if (q.type === "normal" && Math.max(a, b) === 0) return [];
        return [{ id: q.id, answer: a > b ? ("A" as const) : ("B" as const) }];
      });
      expect(diagnose(answers)).toBe(id);
    },
  );
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

it("新エリアの問題は名前の後に助詞が続く", () => {
  expect(templates.find((t) => t.id === "t107")?.question).toBe(
    "{name}が新エリアでまずしたいのは？",
  );
});
