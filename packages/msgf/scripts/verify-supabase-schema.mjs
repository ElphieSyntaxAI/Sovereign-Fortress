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
 * Distribution Build ID: MSGF-2d8d295-20260516T002421Z-internal
 */
/**
 * Verifies Postgres schema for MSGF Supabase (pillar_vectors 1536, ledger CHECK, GIN indexes).
 *
 * Requires a direct Postgres URL (pooler or primary), e.g. from Supabase Dashboard → Settings → Database:
 *   postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
 *
 * Env:
 *   DATABASE_URL or SUPABASE_DATABASE_URL
 *
 * Usage (from packages/msgf):
 *   node --env-file=.env.local scripts/verify-supabase-schema.mjs
 */

import pg from "pg";

const conn =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DATABASE_URL ||
  process.env.POSTGRES_URL ||
  "";

async function main() {
  if (!conn) {
    console.error(
      "Missing DATABASE_URL (or SUPABASE_DATABASE_URL / POSTGRES_URL). " +
        "Supabase anon/service keys alone cannot run information_schema checks; use the Postgres connection string."
    );
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString: conn,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log("Postgres: connected.");

  const emb = await client.query(
    `select pg_catalog.format_type(a.atttypid, a.atttypmod) as coltype
     from pg_catalog.pg_attribute a
     join pg_catalog.pg_class c on c.oid = a.attrelid
     join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = 'pillar_vectors'
       and a.attname = 'embedding'
       and not a.attisdropped`
  );

  if (emb.rowCount === 0) {
    console.error("FAIL: public.pillar_vectors.embedding column not found.");
    process.exitCode = 1;
  } else {
    const t = emb.rows[0].coltype;
    if (t === "vector(1536)") {
      console.log("OK: pillar_vectors.embedding is vector(1536).");
    } else if (t === "vector(768)") {
      console.error(
        "FAIL: pillar_vectors.embedding is still vector(768). Apply migration 20260506200000 on a fresh table, or migrate embeddings to 1536."
      );
      process.exitCode = 1;
    } else {
      console.error(`FAIL: pillar_vectors.embedding unexpected type: ${t}`);
      process.exitCode = 1;
    }
  }

  const checks = await client.query(
    `select c.conname, pg_catalog.pg_get_constraintdef(c.oid, true) as def
     from pg_catalog.pg_constraint c
     join pg_catalog.pg_class r on r.oid = c.conrelid
     join pg_catalog.pg_namespace n on n.oid = r.relnamespace
     where n.nspname = 'public'
       and r.relname = 'p4_state_ledger'
       and c.contype = 'c'`
  );

  const statusCheck = checks.rows.find((r) =>
    String(r.def).includes("consensus_status")
  );
  const need = ["pending", "approved", "rejected"];
  if (!statusCheck) {
    console.error(
      "FAIL: p4_state_ledger has no CHECK on consensus_status (run migration 20260506201000)."
    );
    process.exitCode = 1;
  } else {
    const ok = need.every((w) => String(statusCheck.def).includes(w));
    if (ok) {
      console.log(
        "OK: p4_state_ledger consensus_status CHECK allows pending, approved, rejected."
      );
    } else {
      console.error(
        `FAIL: consensus_status CHECK incomplete. Found: ${statusCheck.def}`
      );
      process.exitCode = 1;
    }
  }

  const gin = await client.query(
    `select tablename, indexname, indexdef
     from pg_indexes
     where schemaname = 'public'
       and tablename in ('pillar_vectors', 'p4_state_ledger')
       and indexdef ilike '%using gin%'`
  );

  const pvMeta = gin.rows.some(
    (r) => r.tablename === "pillar_vectors" && r.indexdef.includes("metadata")
  );
  const ledgerBlob = gin.rows.some(
    (r) => r.tablename === "p4_state_ledger" && r.indexdef.includes("state_blob")
  );

  if (pvMeta) {
    console.log("OK: GIN index present on pillar_vectors.metadata.");
  } else {
    console.error(
      "FAIL: No GIN index on pillar_vectors.metadata (expected pillar_vectors_metadata_gin)."
    );
    process.exitCode = 1;
  }

  if (ledgerBlob) {
    console.log("OK: GIN index present on p4_state_ledger.state_blob.");
  } else {
    console.error(
      "FAIL: No GIN index on p4_state_ledger.state_blob (expected p4_state_ledger_state_blob_gin)."
    );
    process.exitCode = 1;
  }

  await client.end();
  if (process.exitCode === 1) process.exit(1);
  console.log("All schema checks passed.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
