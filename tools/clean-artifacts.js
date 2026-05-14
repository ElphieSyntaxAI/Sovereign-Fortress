#!/usr/bin/env node
/**
 * Removes TypeScript incremental caches and stray ingest logs across the monorepo.
 * Skips node_modules, .git, dist, and .next.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".next"]);

function walk(dir, onFile) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, onFile);
    else onFile(full, e.name);
  }
}

let removed = 0;
walk(root, (full, name) => {
  if (name.endsWith(".tsbuildinfo") || name === "ingest-log.txt") {
    try {
      fs.unlinkSync(full);
      removed += 1;
      console.log("removed:", path.relative(root, full));
    } catch (err) {
      console.warn("skip:", path.relative(root, full), err.message);
    }
  }
});

console.log(`clean:artifacts done (${removed} file(s)).`);
