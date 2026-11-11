import { fileURLToPath } from "node:url";
import adapter from "@sveltejs/adapter-cloudflare";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";
export default defineConfig(({ command }) => ({
  plugins: [
    {
      name: "hikaido-wasm-modules",
      enforce: "pre",
      resolveId(source) {
        if (!source.endsWith(".wasm?module")) return;
        const name = source.slice(0, -7);
        const resolved = fileURLToPath(import.meta.resolve(name));
        return command === "build"
          ? { id: name, external: true }
          : `\0hikaido-wasm:${resolved}`;
      },
      load(id) {
        if (id.startsWith("\0hikaido-wasm:"))
          return `import {readFileSync} from 'node:fs';export default new WebAssembly.Module(readFileSync(${JSON.stringify(id.slice(14))}));`;
      },
    },
    sveltekit({
      adapter: adapter({
        platformProxy: process.env.HIKAIDO_DB_DIR
          ? { persist: { path: process.env.HIKAIDO_DB_DIR } }
          : undefined,
      }),
      paths: { base: "" },
    }),
  ],
  test: { include: ["tests/**/*.test.ts"] },
}));
