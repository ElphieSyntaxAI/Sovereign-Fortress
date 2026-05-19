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
 * Distribution Build ID: MSGF-6d594fa-20260519T162432Z-internal
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRole) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  const supabase = createClient(supabaseUrl, serviceRole);
  const vaultPack = readJson(path.join(process.cwd(), "project-doc", "vault_seed_pack.json"));
  const hallPack = readJson(path.join(process.cwd(), "project-doc", "hall_seed_pack.json"));

  const vaultRows = vaultPack.entries.map((e) => ({
    content: `${e.fix_delta}\n\n${e.content}`,
    metadata: {
      pillar: "P6",
      ledger: "vault",
      index_type: "genealogical_bug_index",
      category: e.category_1_0,
      branch: e.branch_1_1,
      instance: e.instance_1_1_1,
      source_path: e.path,
      seed_label: "ancestral_root",
      seeded_at: new Date().toISOString(),
    },
  }));

  const hallRows = hallPack.entries.map((e) => ({
    content: `${e.pattern}\n\nRejected because: ${e.why_rejected}`,
    metadata: {
      pillar: "P6",
      ledger: "hall",
      index_type: "negative_index",
      category: e.category_1_0,
      branch: e.branch_1_1,
      instance: e.instance_1_1_1,
      severity: e.severity,
      label: e.label,
      seeded_at: new Date().toISOString(),
    },
  }));

  const { error: vaultErr } = await supabase.from("pillar_vectors").insert(vaultRows);
  if (vaultErr) throw vaultErr;

  const { error: hallErr } = await supabase.from("pillar_vectors").insert(hallRows);
  if (hallErr) throw hallErr;

  console.log(`Seeded Vault rows: ${vaultRows.length}`);
  console.log(`Seeded Hall rows: ${hallRows.length}`);
  console.log("SHARD phase complete: Cold Layer initialized.");
}

main().catch((err) => {
  console.error("Seed failed:", err.message || err);
  process.exit(1);
});

