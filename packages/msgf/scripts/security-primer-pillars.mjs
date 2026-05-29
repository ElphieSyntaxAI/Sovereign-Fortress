/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-3ea5d0e-20260529T033030Z-internal
 */
/**
 * MSGF "Prancer pillars" primer — static checks runnable in CI without Prancer Cloud.
 *
 * 1) IaC / RLS hygiene: scan SQL migrations for obviously over-broad policy hints.
 * 2) Secret redaction: block common Anthropic / Google API key literals in source trees.
 * 3) Environment parity: does NOT connect to DB — run `pnpm --filter msgf verify:db-schema`
 *    with Staging `DATABASE_URL` in CI after migrations apply.
 *
 * Usage (from repo root or packages/msgf):
 *   node packages/msgf/scripts/security-primer-pillars.mjs
 */

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MSGF_ROOT = path.join(__dirname, "..");
const REPO_ROOT = path.join(MSGF_ROOT, "..", "..");

const MIGRATIONS_DIR = path.join(MSGF_ROOT, "supabase", "migrations");

const SOURCE_ROOTS = [
  path.join(REPO_ROOT, "packages", "msgf"),
  path.join(REPO_ROOT, "apps", "author-ecosystem"),
];

const SKIP_DIR_NAMES = new Set([
  "node_modules",
  ".next",
  "dist",
  "build",
  ".git",
  "coverage",
  "mcps",
]);

/** Obvious key material (Prancer-style); allow env indirection. */
const EMBEDDED_KEY_PATTERNS = [
  { name: "anthropic_sk", re: /\bsk-ant-api\d{2}-[A-Za-z0-9_-]{20,}\b/ },
  { name: "openai_sk", re: /\bsk-(?:proj-|or-v1-)[A-Za-z0-9_-]{20,}\b/ },
  { name: "google_aiza", re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
];

/** Heuristic: one-line policies that grant all rows to authenticated/anon using literal true. */
const OPEN_POLICY_LINE = /\bTO\s+(authenticated|anon|PUBLIC)\b.*\bUSING\s*\(\s*true\s*\)/i;

let exitCode = 0;

function fail(msg) {
  console.error(msg);
  exitCode = 1;
}

async function walkFiles(dir, exts, out) {
  let st;
  try {
    st = await stat(dir);
  } catch {
    return;
  }
  if (!st.isDirectory()) return;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (ent.isDirectory()) {
      if (SKIP_DIR_NAMES.has(ent.name)) continue;
      await walkFiles(path.join(dir, ent.name), exts, out);
      continue;
    }
    const ext = path.extname(ent.name).toLowerCase();
    if (!exts.has(ext)) continue;
    const fp = path.join(dir, ent.name);
    try {
      const s = await stat(fp);
      if (s.size > 800_000) continue;
    } catch {
      continue;
    }
    out.push(fp);
  }
}

async function scanMigrations() {
  console.log("\n[1] Migration RLS / policy hygiene (static)\n");
  let st;
  try {
    st = await stat(MIGRATIONS_DIR);
  } catch {
    fail(`FAIL: migrations directory missing: ${MIGRATIONS_DIR}`);
    return;
  }
  if (!st.isDirectory()) {
    fail(`FAIL: not a directory: ${MIGRATIONS_DIR}`);
    return;
  }

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .map((f) => path.join(MIGRATIONS_DIR, f))
    .sort();

  if (files.length === 0) {
    fail("FAIL: no .sql files under supabase/migrations");
    return;
  }

  let hits = 0;
  for (const fp of files) {
    const text = await readFile(fp, "utf8");
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!OPEN_POLICY_LINE.test(line)) continue;
      if (/TO\s+service_role\b/i.test(line) && !/\bTO\s+(authenticated|anon|PUBLIC)\b/i.test(line)) {
        continue;
      }
      console.error(`  Suspicious: ${path.relative(REPO_ROOT, fp)}:${i + 1}`);
      console.error(`    ${line.trim().slice(0, 200)}`);
      hits++;
    }
  }

  if (hits > 0) {
    fail(
      `\nFAIL: ${hits} migration line(s) look like broad USING (true) for authenticated/anon/PUBLIC.\n` +
        "Review RLS; Prancer IaC rules should still run in CI for authoritative results."
    );
  } else {
    console.log(`  OK: scanned ${files.length} migration file(s); no single-line OPEN_POLICY_LINE hits.`);
    console.log(`  Note: multiline policies need human/Prancer review — this script is advisory.`);
  }
}

async function scanEmbeddedKeys() {
  console.log("\n[2] Embedded API key patterns (Anthropic / Google / OpenAI-style)\n");
  const exts = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
  const files = [];
  for (const root of SOURCE_ROOTS) {
    await walkFiles(root, exts, files);
  }

  let hits = 0;
  for (const fp of files) {
    const rel = path.relative(REPO_ROOT, fp);
    if (rel.includes(`${path.sep}node_modules${path.sep}`)) continue;
    const text = await readFile(fp, "utf8");
    for (const { name, re } of EMBEDDED_KEY_PATTERNS) {
      const m = text.match(re);
      if (!m) continue;
      const lineNo = text.slice(0, m.index).split(/\r?\n/).length;
      console.error(`  ${name}: ${rel}:${lineNo} → ${m[0].slice(0, 16)}…`);
      hits++;
    }
  }

  if (hits > 0) {
    fail("\nFAIL: possible hardcoded API key material — use env vars and secret manager.");
  } else {
    console.log(`  OK: no obvious embedded key strings in ${files.length} source file(s) scanned.`);
  }
}

function printParityReminder() {
  console.log("\n[3] Environment parity (live DB)\n");
  console.log(
    "  Run against **Staging** Postgres (same migration chain as Dev):\n" +
      "    pnpm --filter msgf verify:db-schema\n" +
      "  with DATABASE_URL or SUPABASE_DATABASE_URL pointing at the Staging pooler.\n" +
      "  Prancer / drift checks can wrap this script in CI once Staging credentials are available."
  );
}

async function main() {
  console.log("MSGF security primer (Prancer pillars — static + reminders)\n");
  console.log(`Repo root: ${REPO_ROOT}`);
  await scanMigrations();
  await scanEmbeddedKeys();
  printParityReminder();
  process.exit(exitCode);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
