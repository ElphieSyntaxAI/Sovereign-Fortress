/**
 * Compile msgf-pulse-guard and copy a stable .vsix into packages/msgf/public/downloads/.
 * Used locally (`npm run package:pulse-guard`) and in the production Docker build.
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const extDir = path.join(root, "packages", "msgf-pulse-guard");
const outDir = path.join(root, "packages", "msgf", "public", "downloads");
const stableName = "msgf-pulse-guard.vsix";

fs.mkdirSync(outDir, { recursive: true });

execSync("npm run compile -w msgf-pulse-guard", { cwd: root, stdio: "inherit" });
execSync(
  "npx --yes @vscode/vsce@3 package --no-dependencies --allow-missing-repository --no-rewrite-relative-links",
  {
  cwd: extDir,
    stdio: "inherit",
  }
);

const built = fs
  .readdirSync(extDir)
  .filter((f) => f.endsWith(".vsix"))
  .map((f) => ({ name: f, mtime: fs.statSync(path.join(extDir, f)).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime)[0];

if (!built) {
  console.error("package-pulse-guard: no .vsix produced in", extDir);
  process.exit(1);
}

const dest = path.join(outDir, stableName);
fs.copyFileSync(path.join(extDir, built.name), dest);
console.log(`package-pulse-guard: ${dest} (${fs.statSync(dest).size} bytes)`);
