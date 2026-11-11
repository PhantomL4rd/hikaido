declare module "cloudflare:workers" {
  export const env: Env;
  export function waitUntil(promise: Promise<unknown>): void;
}
declare module "*.wasm?module" {
  const value: WebAssembly.Module;
  export default value;
}

declare module "subset-font" {
  export default function subsetFont(
    input: Buffer,
    text: string,
    options: { targetFormat: "truetype" },
  ): Promise<Buffer>;
}
