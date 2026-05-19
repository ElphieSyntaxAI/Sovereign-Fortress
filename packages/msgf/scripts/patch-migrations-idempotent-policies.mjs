#!/usr/bin/env node
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
 * Distribution Build ID: MSGF-f70c13c-20260519T044237Z-internal
 */
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
 * Distribution Build ID: MSGF-ee924ab-20260518T235305Z-internal
 */
/**
 * Insert DROP POLICY IF EXISTS before CREATE POLICY in migration SQL files.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const migrationsDir = path.join(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  "supabase",
  "migrations"
);

function patchSql(content) {
  const re =
    /create policy "([^"]+)"\s+(?:\r?\n\s*)?on\s+(public\.\w+)/gi;
  const reUpper =
    /create policy "([^"]+)"\s+on\s+(public\.\w+)\s+for/gi;
  let changed = false;

  const out = content.replace(re, (match, policyName, tableName, offset) => {
    const dropLine = `drop policy if exists "${policyName}" on ${tableName};`;
    const before = content.slice(Math.max(0, offset - 120), offset);
    if (before.toLowerCase().includes(dropLine.toLowerCase())) return match;
    changed = true;
    const indent = match.match(/^\s*/)?.[0] ?? "";
    return `${dropLine}\n${indent}create policy "${policyName}"\n${indent}  on ${tableName}`;
  });

  return { content: out, changed };
}

const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
let patched = 0;

for (const file of files) {
  const filePath = path.join(migrationsDir, file);
  const original = fs.readFileSync(filePath, "utf8");
  const { content, changed } = patchSql(original);
  if (changed) {
    fs.writeFileSync(filePath, content);
    patched += 1;
    console.log(`patched: ${file}`);
  }
}

console.log(`Done. Patched ${patched} of ${files.length} migration files.`);
