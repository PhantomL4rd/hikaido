import { initWasm, Resvg } from "@resvg/resvg-wasm";
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm?module";
import type { RequestEvent } from "@sveltejs/kit";
import type { ReactNode } from "react";
import satori, { type Font, init } from "satori/wasm";
import initYoga from "yoga-wasm-web";
import layoutWasm from "yoga-wasm-web/dist/yoga.wasm?module";
import { base } from "#lib/paths";
import { FONT_700_BASE64, FONT_900_BASE64 } from "./assets.generated.js";
import { OG_HEIGHT, OG_WIDTH } from "./templates";

const boldFont = Uint8Array.from(atob(FONT_700_BASE64), (c) =>
  c.charCodeAt(0),
).buffer;
let ready: Promise<unknown> | undefined;
let fullFont: ArrayBuffer | undefined;
const blackFont = Uint8Array.from(atob(FONT_900_BASE64), (c) =>
  c.charCodeAt(0),
).buffer;
async function fonts(e: RequestEvent): Promise<Font[]> {
  if (!fullFont) {
    const path = `${base}/fonts/ZenMaruGothic-Bold.ttf`;
    const r = import.meta.env.DEV
      ? await e.fetch(path)
      : await e.locals.env.ASSETS.fetch(`https://assets.internal${path}`);
    if (!r.ok) throw new Error("OGP font could not be loaded");
    fullFont = await r.arrayBuffer();
  }
  return [
    {
      name: "Zen Maru Gothic Full",
      data: fullFont,
      weight: 900,
      style: "normal",
    },
    { name: "Zen Maru Gothic", data: boldFont, weight: 700, style: "normal" },
    { name: "Zen Maru Gothic", data: blackFont, weight: 900, style: "normal" },
  ];
}
export async function renderPng(element: ReactNode, e: RequestEvent) {
  ready ??= Promise.all([initYoga(layoutWasm).then(init), initWasm(resvgWasm)]);
  await ready;
  const svg = await satori(element, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: await fonts(e),
  });
  const renderer = new Resvg(svg, {
    fitTo: { mode: "width", value: OG_WIDTH },
  });
  try {
    const image = renderer.render();
    try {
      return new Uint8Array(image.asPng()).buffer;
    } finally {
      image.free();
    }
  } finally {
    renderer.free();
  }
}
export async function ogResponse(e: RequestEvent, element: ReactNode) {
  const cache = (globalThis.caches as CacheStorage & { default?: Cache })
    .default;
  const key = new Request(`${e.url.origin}${e.url.pathname}?version=brand-4`);
  const cached = await cache?.match(key);
  const internal =
    cached ||
    new Response(await renderPng(element, e), {
      headers: {
        "content-type": "image/png",
        "cache-control": "public, max-age=86400",
      },
    });
  if (!cached && cache) e.locals.waitUntil(cache.put(key, internal.clone()));
  return new Response(internal.body, {
    headers: {
      "content-type": "image/png",
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}
