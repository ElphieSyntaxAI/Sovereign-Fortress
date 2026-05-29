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
 * Distribution Build ID: MSGF-3a4c1de-20260529T200349Z-internal
 */
/**
 * MSGF ingest workflow verification.
 *
 * Exercises the same SWEEP service used by `/api/msgf/ingest` for new repository
 * shards: path classification, 1.1.1 lineage metadata, project origin tagging,
 * 1536-dim degraded embeddings, Supabase persistence, and six-pillar baseline.
 */

import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import { sweepAndIngest } from "../lib/msgf-ingest";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

function skip(message: string): never {
  console.error(`[ingest-workflow] ${message}`);
  process.exit(2);
}

function fail(message: string): never {
  console.error(`[ingest-workflow] ${message}`);
  process.exit(1);
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    skip("NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const tenantId = `ingest-workflow-${randomUUID()}`;
  const projectOrigin = "verify/new-repository";

  try {
    const result = await sweepAndIngest({
      tenantId,
      projectOrigin,
      supabase: admin,
      files: [
        {
          path: "apps/new-repo/api/auth/login.ts",
          content: "export async function login(){ return fetch('/api/auth/session') }",
        },
        {
          path: "apps/new-repo/components/EditorPanel.tsx",
          content: "export function EditorPanel(){ return <section>draft</section> }",
        },
        {
          path: "apps/new-repo/db/migrations/001_init.sql",
          content: "create table public.example(id uuid primary key);",
        },
      ],
    });

    if (result.ingested !== 3) {
      fail(`Expected 3 ingested repository shards, got ${result.ingested}. Audit:\n${result.auditLog}`);
    }
    if (!result.isPillarBaselineSet) {
      fail("Expected six-pillar baseline to be set after ingest.");
    }
    if (result.projectOrigin !== projectOrigin) {
      fail(`Expected project_origin ${projectOrigin}, got ${result.projectOrigin}`);
    }

    const { data, error } = await admin
      .from("pillar_vectors")
      .select("id, content, metadata, embedding")
      .contains("metadata", { tenant_id: tenantId })
      .limit(20);

    if (error) fail(`pillar_vectors read failed: ${error.message}`);

    const rows = data ?? [];
    const repositoryRows = rows.filter((row) => {
      const meta = row.metadata as Record<string, unknown> | null;
      return meta?.ingest_source === "sweep" && meta?.project_origin === projectOrigin;
    });

    if (repositoryRows.length !== 3) {
      fail(`Expected 3 sweep rows for project_origin ${projectOrigin}, found ${repositoryRows.length}.`);
    }

    for (const row of repositoryRows) {
      const meta = row.metadata as Record<string, unknown>;
      const bugIndex = meta.bug_index as Record<string, unknown> | undefined;
      if (!meta.original_path || !meta.governance_pillar || !bugIndex) {
        fail(`Missing ingest metadata on row ${row.id}: ${JSON.stringify(meta)}`);
      }
      if (bugIndex.level_1_1_1_instance !== "1.1.1_INGEST_BASELINE") {
        fail(`Row ${row.id} missing 1.1.1 ingest instance: ${JSON.stringify(bugIndex)}`);
      }
    }

    console.log("OK: repository SWEEP ingest wrote 3 shards with 1.1.1 metadata.");
    console.log("OK: six-pillar baseline set for new repository tenant.");
  } finally {
    await admin.from("pillar_vectors").delete().contains("metadata", { tenant_id: tenantId });
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
