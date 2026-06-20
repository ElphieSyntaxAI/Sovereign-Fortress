import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Standalone IIFE — no hashed chunk imports (served from nginx root). */
export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/handoff-bridge.ts"),
      formats: ["iife"],
      name: "AuthorHandoffBridge",
      fileName: "handoff-bridge",
    },
    outDir: "dist",
    emptyOutDir: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        entryFileNames: "handoff-bridge.js",
      },
    },
  },
});
