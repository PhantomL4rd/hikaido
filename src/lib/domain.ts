import { type Template, templates } from "./templates";
export type Choice = "A" | "B";
export const types = [
  {
    id: "battle",
    name: "バトルジャンキー",
    description: "強敵との一戦に心が躍る。挑戦そのものがごほうび。",
    icon: "Swords",
    color: "#d20f39",
  },
  {
    id: "story",
    name: "物語の旅人",
    description: "出会いと物語を大切に、一歩ずつ旅を紡ぐ。",
    icon: "BookOpen",
    color: "#8839ef",
  },
  {
    id: "fashion",
    name: "おしゃれ番長",
    description: "お気に入りの装いで、今日の自分を表現する。",
    icon: "Shirt",
    color: "#ea76cb",
  },
  {
    id: "housing",
    name: "ハウジング職人",
    description: "小さな空間にこだわりと、とびきりの居心地を。",
    icon: "House",
    color: "#fe640b",
  },
  {
    id: "craft",
    name: "職人気質",
    description: "素材を集め、手を動かし、理想の逸品を作る。",
    icon: "Hammer",
    color: "#df8e1d",
  },
  {
    id: "social",
    name: "交流の達人",
    description: "仲間との何気ない時間が、冒険を特別にする。",
    icon: "MessagesSquare",
    color: "#179299",
  },
  {
    id: "explorer",
    name: "探検家",
    description: "まだ見ぬ景色と、寄り道の先の発見を求める。",
    icon: "Compass",
    color: "#40a02b",
  },
  {
    id: "collector",
    name: "コレクター",
    description: "ひとつずつ集まる宝物に、旅の思い出を重ねる。",
    icon: "Gem",
    color: "#1e66f5",
  },
] as const;
export function chooseType(scores: readonly number[]) {
  if (scores.length !== types.length)
    throw new Error("タイプ別スコアが不正です");
  return types[scores.indexOf(Math.max(...scores))].id;
}
export function diagnose(answers: readonly { id: string; answer: Choice }[]) {
  const questions = answers.map(({ id, answer }) => {
    const template = templates.find((q) => q.id === id);
    if (!template) throw new Error("未登録の問題です");
    return { ...template, answer };
  });
  if (questions.filter((q) => q.type === "diagnosis").length !== 4)
    throw new Error("診断には固定4問が必要です");
  const scores = types.map((_, i) =>
    questions.reduce(
      (score, question) =>
        score + (question.typeScores?.[question.answer][i] ?? 0),
      0,
    ),
  );
  return chooseType(scores);
}
export type DraftQuestion = Template & { answer?: Choice };
export function makeDraft(n: 10 | 25): DraftQuestion[] {
  const normal = templates
    .filter((q) => q.type === "normal")
    .map((q) => ({ q, key: crypto.randomUUID() }))
    .sort((a, b) => a.key.localeCompare(b.key));
  return [
    ...templates.filter((q) => q.type === "diagnosis"),
    ...normal.slice(0, n - 4).map((x) => x.q),
  ].map((q) => ({ ...q }));
}
export function replaceQuestion(
  d: DraftQuestion[],
  position: number,
): DraftQuestion[] {
  if (!d[position] || d[position].type === "diagnosis") return d;
  const options = templates.filter(
    (q) => q.type === "normal" && !d.some((x) => x.id === q.id),
  );
  if (!options.length) return d;
  const pick = crypto.getRandomValues(new Uint32Array(1))[0] % options.length;
  return d.map((q, i) => (i === position ? { ...options[pick] } : q));
}
export function reaction(selected: number, total: number) {
  return total < 5
    ? "まだ集計中！"
    : selected / total > 0.6
      ? "多数派！"
      : selected / total < 0.4
        ? "レア！"
        : "割れてる！";
}
export function statistics(a: number, b: number, correct: Choice) {
  const total = a + b;
  const percentA = total ? Math.round((a / total) * 100) : 0;
  return {
    a,
    b,
    total,
    percentA,
    percentB: total ? 100 - percentA : 0,
    correctRate: total
      ? Math.round(((correct === "A" ? a : b) / total) * 100)
      : 0,
  };
}
