#!/usr/bin/env node
/**
 * Deletes every package-lock.json under the repo except the root lockfile.
 * Run from repo root, then `npm install` (or `pnpm import` + pnpm install) once.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const rootLock = path.join(root, "package-lock.json");

const SKIP_DIRS = new Set(["node_modules", ".git"]);

function walk(dir, acc) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, acc);
    else if (e.name === "package-lock.json" && full !== rootLock) acc.push(full);
  }
}

const nested = [];
walk(root, nested);

for (const f of nested) {
  fs.unlinkSync(f);
  console.log("removed:", path.relative(root, f));
}

console.log(`remove-nested-package-locks: deleted ${nested.length} nested package-lock.json (root preserved).`);
