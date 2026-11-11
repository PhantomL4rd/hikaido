import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import type { ReactNode } from "react";
import type { Font } from "satori";
import satori from "satori";
import subsetFont from "subset-font";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const p = (...s: string[]) => path.join(root, ...s);

const CREAM = "#fdf6f1";
const master = await readFile(p("src/lib/assets/brand/symbol.svg"), "utf8");
const inner = master
  .replace(/^[\s\S]*?<svg[^>]*>/, "")
  .replace(/<\/svg>\s*$/, "")
  .trim();
const svg = (viewBox: string, content: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${content}</svg>\n`;
const mono = (color: string) => inner.replace(/#[0-9a-f]{6}/gi, color);
const scaled = (s: number) =>
  `<g transform="translate(50 50) scale(${s}) translate(-50 -50)">${inner}</g>`;
const png = (source: string, size: number) =>
  new Resvg(source, { fitTo: { mode: "width", value: size } }).render().asPng();

const favicon = svg("8 8 84 84", inner);
const tile = (scale: number, rx: number) =>
  svg(
    "0 0 100 100",
    `<rect width="100" height="100" rx="${rx}" fill="${CREAM}"/>${scaled(scale)}`,
  );

await writeFile(p("static/favicon.svg"), favicon);
const fav16 = png(favicon, 16);
const fav32 = png(favicon, 32);
const fav48 = png(favicon, 48);
await writeFile(p("static/favicon-16x16.png"), fav16);
await writeFile(p("static/favicon-32x32.png"), fav32);
await writeFile(
  p("static/favicon.ico"),
  ico([fav16, fav32, fav48], [16, 32, 48]),
);
await writeFile(p("static/apple-touch-icon.png"), png(tile(0.8, 0), 180));
await writeFile(p("static/icon-192.png"), png(tile(0.8, 22), 192));
await writeFile(p("static/icon-512.png"), png(tile(0.8, 22), 512));
await writeFile(p("static/icon-maskable-512.png"), png(tile(0.66, 0), 512));

function ico(images: Buffer[], sizes: number[]) {
  const head = Buffer.alloc(6 + 16 * images.length);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(images.length, 4);
  let offset = head.length;
  images.forEach((img, i) => {
    const o = 6 + 16 * i;
    head.writeUInt8(sizes[i], o);
    head.writeUInt8(sizes[i], o + 1);
    head.writeUInt16LE(1, o + 4);
    head.writeUInt16LE(32, o + 6);
    head.writeUInt32LE(img.length, o + 8);
    head.writeUInt32LE(offset, o + 12);
    offset += img.length;
  });
  return Buffer.concat([head, ...images]);
}

const templateSrc = await readFile(p("src/lib/server/og/templates.ts"), "utf8");
const extra = (await readFile(p("scripts/brand/glyphs.txt"), "utf8"))
  .split("\n")
  .filter((l) => !l.startsWith("#"))
  .join("");
const range = (a: number, b: number) =>
  Array.from({ length: b - a + 1 }, (_, i) => String.fromCodePoint(a + i)).join(
    "",
  );
const glyphs = [
  ...new Set(
    range(0x20, 0x7e) +
      range(0x3041, 0x3096) +
      range(0x30a1, 0x30fc) +
      "、。！？・ー〜「」" +
      templateSrc +
      extra,
  ),
]
  .filter((ch) => ch >= " ")
  .join("");

const fonts: Record<number, Buffer> = {};
for (const [weight, file] of [
  [700, "ZenMaruGothic-Bold.ttf"],
  [900, "ZenMaruGothic-Black.ttf"],
] as const) {
  const full = await readFile(p("scripts/brand/fonts-src", file));
  fonts[weight] = await subsetFont(full, glyphs, { targetFormat: "truetype" });
}
const dataUri = (content: string) =>
  "data:image/svg+xml;base64," +
  Buffer.from(svg("8 12 84 76", content)).toString("base64");
await writeFile(
  p("src/lib/server/og/assets.generated.js"),
  `// 自動生成：node scripts/brand/generate.ts（手で編集しないでください）
export const SYMBOL = '${dataUri(inner)}';
export const SYMBOL_PINK = '${dataUri(mono("#f5c2e7"))}';
export const SYMBOL_ROSE = '${dataUri(mono("#f38ba8"))}';
export const SYMBOL_LAVENDER = '${dataUri(mono("#b4befe"))}';
export const FONT_700_BASE64 = '${fonts[700].toString("base64")}';
export const FONT_900_BASE64 = '${fonts[900].toString("base64")}';
`,
);

const t = await import(
  p("src/lib/server/og/templates.ts") + "?v=" + Date.now()
);
const satoriFonts: Font[] = ([700, 900] as const).map((weight) => ({
  name: "Zen Maru Gothic",
  data: fonts[weight],
  weight,
  style: "normal",
}));
satoriFonts.push({
  name: "Zen Maru Gothic Full",
  data: await readFile(p("scripts/brand/fonts-src/ZenMaruGothic-Bold.ttf")),
  weight: 900,
  style: "normal",
});
async function og(element: ReactNode, out: string) {
  const s = await satori(element, {
    width: t.OG_WIDTH,
    height: t.OG_HEIGHT,
    fonts: satoriFonts,
  });
  await writeFile(out, png(s, t.OG_WIDTH));
}
await og(t.defaultOg(), p("static/og-default.png"));

if (process.argv.includes("--previews")) {
  await mkdir(p("previews"), { recursive: true });
  const long = "Wolfgang'a Thunderstrike";
  await og(
    t.quizOg({ characterName: "Hikari Asahina", questionCount: 10 }),
    p("previews/quiz-10.png"),
  );
  await og(
    t.quizOg({ characterName: long, questionCount: 25 }),
    p("previews/quiz-25-long.png"),
  );
  await og(
    t.resultOg({
      characterName: "Hikari Asahina",
      correctCount: 7,
      questionCount: 10,
    }),
    p("previews/result-70.png"),
  );
  await og(
    t.resultOg({
      characterName: "Mio Sora",
      correctCount: 0,
      questionCount: 10,
    }),
    p("previews/result-0.png"),
  );
  await og(
    t.resultOg({ characterName: long, correctCount: 25, questionCount: 25 }),
    p("previews/result-100-long.png"),
  );
  await og(
    t.resultOg({
      characterName: "Hikari Asahina",
      correctCount: 13,
      questionCount: 25,
    }),
    p("previews/result-52.png"),
  );
}
console.log("done");
