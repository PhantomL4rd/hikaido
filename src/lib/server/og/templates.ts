import type { CSSProperties, ReactNode } from "react";
import {
  SYMBOL,
  SYMBOL_LAVENDER,
  SYMBOL_PINK,
  SYMBOL_ROSE,
} from "./assets.generated.js";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const C = {
  pink: "#f5c2e7",
  lavender: "#b4befe",
  rose: "#f38ba8",
  ink: "#4c4f69",
  inkSoft: "#5c5f77",
  cream: "#fdf6f1",
  pinkTint: "#fbe3f3",
  lavenderTint: "#e9ebff",
};

function h(type: string, style: CSSProperties, ...children: ReactNode[]) {
  const kids = children
    .flat()
    .filter((c) => c !== null && c !== undefined && c !== false);
  return {
    key: null,
    type,
    props: {
      style: { display: "flex", ...style },
      children: kids.length === 1 ? kids[0] : kids,
    },
  };
}

function heart(src: string, width: number, style: CSSProperties = {}) {
  return {
    key: null,
    type: "img",
    props: { src, width, height: Math.round((width * 76) / 84), style },
  };
}

function blob(
  color: string,
  opacity: number,
  size: number,
  pos: CSSProperties,
) {
  return h("div", {
    position: "absolute",
    width: size,
    height: size,
    borderRadius: size,
    background: color,
    opacity,
    ...pos,
  });
}

function frame(children: ReactNode, { blobs = "both", column = true } = {}) {
  return h(
    "div",
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      position: "relative",
      display: "flex",
      flexDirection: column ? "column" : "row",
      background: C.cream,
      color: C.ink,
      fontFamily: "Zen Maru Gothic",
      overflow: "hidden",
    },
    blobs === "both" || blobs === "pink"
      ? blob(C.pink, 0.45, 300, { left: -100, bottom: -130 })
      : blob(C.lavender, 0.4, 300, { left: -100, bottom: -130 }),
    blobs === "both"
      ? blob(C.lavender, 0.4, 260, { right: -80, top: -110 })
      : null,
    h("div", { position: "relative", display: "flex", flexGrow: 1 }, children),
  );
}

function lockup() {
  return h(
    "div",
    {
      display: "flex",
      alignItems: "center",
      height: 56,
      minHeight: 56,
      flexShrink: 0,
    },
    heart(SYMBOL, 60),
    h(
      "div",
      { fontSize: 42, fontWeight: 900, letterSpacing: 1, marginLeft: 14 },
      "ひかいど",
    ),
  );
}

function chip(text: string, background: string, fontSize = 34) {
  return h(
    "div",
    {
      display: "flex",
      fontSize,
      fontWeight: 700,
      padding: "8px 28px",
      borderRadius: 999,
      background,
    },
    text,
  );
}

function heroHeart(size: number, overlay: ReactNode = null) {
  const hgt = Math.round((size * 76) / 84);
  return h(
    "div",
    {
      position: "relative",
      display: "flex",
      width: size + 60,
      height: hgt + 30,
      flexShrink: 0,
    },
    heart(SYMBOL, size, { position: "absolute", left: 30, top: 15 }),
    overlay
      ? h(
          "div",
          {
            position: "absolute",
            left: 30,
            top: 15,
            width: size,
            height: hgt,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            paddingTop: 16,
            fontSize: Math.round(size * 0.44),
            fontWeight: 900,
          },
          overlay,
        )
      : null,
    heart(SYMBOL_ROSE, 50, {
      position: "absolute",
      left: 0,
      top: 0,
      transform: "rotate(-16deg)",
    }),
    heart(SYMBOL_LAVENDER, 38, {
      position: "absolute",
      right: 0,
      bottom: 10,
      transform: "rotate(14deg)",
    }),
  );
}

function body(left: ReactNode, right: ReactNode) {
  return h(
    "div",
    {
      display: "flex",
      flexGrow: 1,
      alignItems: "center",
      justifyContent: "space-between",
    },
    h(
      "div",
      {
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        flexShrink: 1,
        marginRight: 40,
      },
      left,
    ),
    right,
  );
}

function fit(text: string, steps: readonly (readonly [number, number])[]) {
  const n = [...String(text)].length;
  for (const [max, size] of steps) if (n <= max) return size;
  return steps[steps.length - 1][1];
}

const nameStyle = (size: number, weight = 900): CSSProperties => ({
  fontFamily: "Zen Maru Gothic Full",
  display: "flex",
  fontSize: size,
  fontWeight: weight,
  lineHeight: 1.15,
  wordBreak: "break-word",
});

export function defaultOg() {
  return frame(
    h(
      "div",
      {
        display: "flex",
        flexGrow: 1,
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 70px 0 80px",
      },
      h(
        "div",
        { display: "flex", flexDirection: "column", alignItems: "flex-start" },
        chip("ヒカセン理解度チェック", C.lavenderTint, 30),
        h(
          "div",
          {
            fontSize: 152,
            fontWeight: 900,
            lineHeight: 1.1,
            letterSpacing: 3,
            marginTop: 18,
          },
          "ひかいど",
        ),
        h(
          "div",
          {
            display: "flex",
            flexDirection: "column",
            fontSize: 42,
            fontWeight: 700,
            lineHeight: 1.4,
            marginTop: 18,
          },
          h("div", {}, "あのヒカセンのこと、"),
          h("div", {}, "どのくらいしってる？"),
        ),
      ),
      heroHeart(340),
    ),
  );
}

export function quizOg({
  characterName,
  questionCount,
}: {
  characterName: string;
  questionCount: number;
}) {
  const size = fit(characterName, [
    [10, 84],
    [16, 68],
    [24, 54],
    [Infinity, 44],
  ]);
  return frame(
    h(
      "div",
      {
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        padding: "48px 62px 48px 72px",
      },
      lockup(),
      body(
        [
          h("div", nameStyle(size), characterName),
          h(
            "div",
            { fontSize: 64, fontWeight: 900, lineHeight: 1.2 },
            "理解度チェック",
          ),
          h(
            "div",
            { display: "flex", marginTop: 22 },
            chip(`全${questionCount}問・2択`, C.pinkTint),
          ),
          h(
            "div",
            { fontSize: 38, fontWeight: 700, marginTop: 22 },
            "あなたはどのくらいしってる？",
          ),
        ],
        heroHeart(300, "?"),
      ),
    ),
  );
}

export function resultOg({
  characterName,
  correctCount,
  questionCount,
}: {
  characterName: string;
  correctCount: number;
  questionCount: number;
}) {
  const total = Math.max(1, Math.floor(questionCount));
  const correct = Math.min(total, Math.max(0, Math.floor(correctCount)));
  const score = Math.round((correct / total) * 100);
  const size = fit(characterName, [
    [10, 76],
    [16, 60],
    [24, 48],
    [Infinity, 40],
  ]);
  const W = 460;
  const H = Math.round((W * 76) / 84);
  return frame(
    h(
      "div",
      {
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        padding: "48px 52px 48px 72px",
      },
      lockup(),
      body(
        [
          h("div", nameStyle(size), characterName),
          h(
            "div",
            { fontSize: 46, fontWeight: 700, lineHeight: 1.3, marginTop: 4 },
            "への理解度",
          ),
          h(
            "div",
            { display: "flex", marginTop: 26 },
            chip(`${correct} / ${total} 問正解`, C.lavenderTint, 38),
          ),
        ],
        h(
          "div",
          {
            position: "relative",
            display: "flex",
            width: W + 40,
            height: H + 24,
            flexShrink: 0,
            marginTop: -40,
          },
          heart(SYMBOL_PINK, W, { position: "absolute", left: 20, top: 12 }),
          h(
            "div",
            {
              position: "absolute",
              left: 20,
              top: 12,
              width: W,
              height: H,
              display: "flex",
              alignItems: "baseline",
              justifyContent: "center",
              paddingTop: score === 100 ? 104 : 88,
              fontWeight: 900,
              lineHeight: 1,
            },
            h("div", { fontSize: score === 100 ? 132 : 160 }, String(score)),
            h("div", { fontSize: 72, marginLeft: 6 }, "%"),
          ),
          heart(SYMBOL_ROSE, 54, {
            position: "absolute",
            left: 0,
            top: 6,
            transform: "rotate(-18deg)",
          }),
          heart(SYMBOL_LAVENDER, 40, {
            position: "absolute",
            right: 0,
            top: 30,
            transform: "rotate(16deg)",
          }),
          heart(SYMBOL_ROSE, 46, {
            position: "absolute",
            right: 40,
            bottom: 34,
            transform: "rotate(12deg)",
          }),
          heart(SYMBOL_LAVENDER, 34, {
            position: "absolute",
            left: 46,
            bottom: 60,
            transform: "rotate(-10deg)",
          }),
        ),
      ),
    ),
    { blobs: "lavender" },
  );
}
