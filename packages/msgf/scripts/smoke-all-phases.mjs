#!/usr/bin/env node
/**
 * Run P1–P4 local smoke scripts in sequence.
 * Usage: npm run smoke:all -w msgf
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const phases = [
  ["smoke:p1-ide", "P1 IDE setup"],
  ["smoke:p2-dev", "P2 dev heal"],
  ["smoke:p3-verify", "P3 verify + MCP"],
  ["smoke:p4-ide", "P4 IDE token"],
];

console.log("[smoke:all] MSGF phased smoke suite\n");

for (const [script, label] of phases) {
  console.log(`\n--- ${label} (${script}) ---\n`);
  const r = spawnSync("npm", ["run", script], { cwd: root, stdio: "inherit", shell: true });
  if (r.status !== 0) {
    console.error(`[smoke:all] FAIL at ${script}`);
    process.exit(r.status ?? 1);
  }
}

console.log("\n[smoke:all] All phase smokes passed.");
