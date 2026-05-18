import * as esbuild from "esbuild";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes("--watch");

const ctx = await esbuild.context({
  entryPoints: [resolve(__dirname, "src/extension.ts")],
  bundle: true,
  outfile: resolve(__dirname, "out/extension.js"),
  platform: "node",
  format: "cjs",
  target: "es2022",
  external: ["vscode"],
  sourcemap: true,
  logLevel: "info",
});

if (watch) {
  await ctx.watch();
  console.log("[msgf-pulse-guard] esbuild watching…");
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
