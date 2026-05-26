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
 * Distribution Build ID: MSGF-c103094-20260526T230730Z-internal
 */
/**
 * Verifies Postgres schema for MSGF Supabase cold layer.
 *
 * Dashboard-critical tables (PostgREST schema cache):
 *   public.msgf_incidents
 *   public.local_state_cache
 *   public.msgf_rule_global_review_submissions
 *
 * Plus pillar_vectors / p4_state_ledger checks from V3.2 migrations.
 *
 * Master B2B eco rollups (migration 20260604120000):
 *   msgf_master.global_eco_rollups
 *   public.msgf_master_increment_global_eco_rollup
 *
 * Requires a direct Postgres URL (pooler or primary), e.g. from Supabase Dashboard → Settings → Database:
 *   postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
 *
 * Env (loaded from repo root + packages/msgf .env files if not already set):
 *   DATABASE_URL or SUPABASE_DATABASE_URL
 *
 * Usage (from repo root):
 *   npm run verify:supabase-schema
 *   npm run verify:db-schema -w msgf
 */

import dns from "node:dns";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

import {
  authFailureHint,
  connectionFailureHint,
  resolveDatabaseUrl,
  trimEnv,
  validateDatabaseHostname,
} from "./lib/normalize-database-url.mjs";

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFiles() {
  for (const rel of ["../../.env", "../../.env.local", ".env", ".env.local"]) {
    const p = path.resolve(pkgRoot, rel);
    if (fs.existsSync(p)) {
      dotenv.config({ path: p, override: true });
    }
  }
}

/** Tables that clear dashboard "missing from schema cache" errors when present. */
const DASHBOARD_COLD_LAYER_TABLES = [
  {
    name: "msgf_incidents",
    requiredColumns: [
      "id",
      "user_id",
      "status",
      "bug_index",
      "metadata",
      "source",
      "created_at",
      "updated_at",
    ],
    expectRls: true,
  },
  {
    name: "local_state_cache",
    requiredColumns: [
      "id",
      "tenant_id",
      "entity_id",
      "delta_payload",
      "promotion_status",
      "created_at",
    ],
    expectRls: true,
  },
  {
    name: "msgf_rule_global_review_submissions",
    requiredColumns: [
      "id",
      "tenant_id",
      "company_id",
      "bug_index_instance",
      "mitigation_snapshot",
      "status",
      "created_at",
      "updated_at",
    ],
    expectRls: true,
  },
];

async function assertPublicTable(client, spec) {
  const { name, requiredColumns, expectRls } = spec;

  const tableRow = await client.query(
    `select c.relname, c.relrowsecurity
     from pg_catalog.pg_class c
     join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = $1
       and c.relkind = 'r'`,
    [name]
  );

  if (tableRow.rowCount === 0) {
    console.error(
      `FAIL: public.${name} does not exist. Run: npm run db:push (from repo root) to apply packages/msgf/supabase/migrations/.`
    );
    return false;
  }

  const colRows = await client.query(
    `select column_name
     from information_schema.columns
     where table_schema = 'public'
       and table_name = $1`,
    [name]
  );
  const present = new Set(colRows.rows.map((r) => r.column_name));
  const missing = requiredColumns.filter((c) => !present.has(c));

  if (missing.length > 0) {
    console.error(
      `FAIL: public.${name} is missing columns: ${missing.join(", ")}. Re-run db:push or apply pending migrations.`
    );
    return false;
  }

  if (expectRls && !tableRow.rows[0].relrowsecurity) {
    console.error(`FAIL: public.${name} exists but row level security is not enabled.`);
    return false;
  }

  console.log(`OK: public.${name} exists with required columns (${requiredColumns.length}) and RLS.`);
  return true;
}

async function main() {
  loadEnvFiles();

  const { url: conn, warnings } = resolveDatabaseUrl(process.env);
  for (const w of warnings) console.warn(`Note: ${w}`);

  if (!conn) {
    console.error(
      "Missing DATABASE_URL (or SUPABASE_DATABASE_URL / POSTGRES_URL). " +
        "Set in packages/msgf/.env.local — Supabase anon/service keys cannot run information_schema checks."
    );
    process.exit(1);
  }

  if (conn.includes("[YOUR_DB_PASSWORD]")) {
    console.error("DATABASE_URL still contains [YOUR_DB_PASSWORD]. Update packages/msgf/.env.local first.");
    process.exit(1);
  }

  const hostError = validateDatabaseHostname(conn);
  if (hostError) {
    console.error(hostError);
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString: conn,
    ssl: { rejectUnauthorized: false },
    /** Prefer IPv4 when IPv6 routes time out (common on some Windows networks). */
    lookup: (hostname, _opts, callback) => {
      dns.lookup(hostname, { family: 4 }, callback);
    },
  });

  await client.connect();
  console.log("Postgres: connected.");
  console.log("--- Dashboard cold-layer tables ---");

  let ok = true;
  for (const spec of DASHBOARD_COLD_LAYER_TABLES) {
    const passed = await assertPublicTable(client, spec);
    if (!passed) ok = false;
  }

  if (!ok) {
    await client.end();
    process.exit(1);
  }

  console.log("--- Pillar / ledger baseline ---");

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
    ok = false;
  } else {
    const t = emb.rows[0].coltype;
    if (t === "vector(1536)") {
      console.log("OK: pillar_vectors.embedding is vector(1536).");
    } else if (t === "vector(768)") {
      console.error(
        "FAIL: pillar_vectors.embedding is still vector(768). Run `npm run db:push` to apply migration 20260601120000_upgrade_vector_dimensions.sql, then re-embed cleared rows."
      );
      ok = false;
    } else {
      console.error(`FAIL: pillar_vectors.embedding unexpected type: ${t}`);
      ok = false;
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

  const statusCheck = checks.rows.find((r) => String(r.def).includes("consensus_status"));
  const need = ["pending", "approved", "rejected"];
  if (!statusCheck) {
    console.error(
      "FAIL: p4_state_ledger has no CHECK on consensus_status (run migration 20260506201000)."
    );
    ok = false;
  } else {
    const statusOk = need.every((w) => String(statusCheck.def).includes(w));
    if (statusOk) {
      console.log(
        "OK: p4_state_ledger consensus_status CHECK allows pending, approved, rejected."
      );
    } else {
      console.error(`FAIL: consensus_status CHECK incomplete. Found: ${statusCheck.def}`);
      ok = false;
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
    ok = false;
  }

  if (ledgerBlob) {
    console.log("OK: GIN index present on p4_state_ledger.state_blob.");
  } else {
    console.error(
      "FAIL: No GIN index on p4_state_ledger.state_blob (expected p4_state_ledger_state_blob_gin)."
    );
    ok = false;
  }

  console.log("--- Master eco rollups ---");

  const ecoTable = await client.query(
    `select c.relname
     from pg_catalog.pg_class c
     join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'msgf_master'
       and c.relname = 'global_eco_rollups'
       and c.relkind = 'r'`
  );

  if (ecoTable.rowCount === 0) {
    console.error(
      "FAIL: msgf_master.global_eco_rollups missing. Run npm run db:push (migration 20260604120000_msgf_master_global_eco_rollups.sql)."
    );
    ok = false;
  } else {
    const ecoCols = await client.query(
      `select column_name
       from information_schema.columns
       where table_schema = 'msgf_master'
         and table_name = 'global_eco_rollups'`
    );
    const needEco = [
      "tenant_id",
      "total_tokens_saved",
      "total_grid_compute_prevented_kwh",
      "total_co2e_offset_lbs",
      "total_freshwater_conserved_gallons",
      "last_observed_at",
      "updated_at",
    ];
    const ecoPresent = new Set(ecoCols.rows.map((r) => r.column_name));
    const ecoMissing = needEco.filter((c) => !ecoPresent.has(c));
    if (ecoMissing.length > 0) {
      console.error(
        `FAIL: msgf_master.global_eco_rollups missing columns: ${ecoMissing.join(", ")}.`
      );
      ok = false;
    } else {
      console.log(
        `OK: msgf_master.global_eco_rollups exists with required columns (${needEco.length}).`
      );
    }
  }

  const ecoFn = await client.query(
    `select p.proname
     from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'msgf_master_increment_global_eco_rollup'`
  );

  if (ecoFn.rowCount === 0) {
    console.error(
      "FAIL: public.msgf_master_increment_global_eco_rollup missing. Re-run db:push for migration 20260604120000."
    );
    ok = false;
  } else {
    console.log("OK: public.msgf_master_increment_global_eco_rollup exists.");
  }

  console.log("--- User project mappings ---");

  const userProjects = await client.query(
    `select c.relname
     from pg_catalog.pg_class c
     join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = 'msgf_user_projects'
       and c.relkind = 'r'`
  );

  if (userProjects.rowCount === 0) {
    console.error(
      "FAIL: public.msgf_user_projects missing. Run db:push (migration 20260605120000_user_projects_and_eco_rollups.sql)."
    );
    ok = false;
  } else {
    console.log("OK: public.msgf_user_projects exists.");
  }

  const userEco = await client.query(
    `select c.relname
     from pg_catalog.pg_class c
     join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'msgf_master'
       and c.relname = 'user_project_eco_rollups'
       and c.relkind = 'r'`
  );

  if (userEco.rowCount === 0) {
    console.error("FAIL: msgf_master.user_project_eco_rollups missing. Re-run db:push.");
    ok = false;
  } else {
    console.log("OK: msgf_master.user_project_eco_rollups exists.");
  }

  const userEcoFn = await client.query(
    `select p.proname
     from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'msgf_master_increment_user_project_eco_rollup'`
  );

  if (userEcoFn.rowCount === 0) {
    console.error("FAIL: public.msgf_master_increment_user_project_eco_rollup missing.");
    ok = false;
  } else {
    console.log("OK: public.msgf_master_increment_user_project_eco_rollup exists.");
  }

  console.log("--- usage_monitor (credit guard) ---");

  const usageMonitor = await client.query(
    `select c.relname
     from pg_catalog.pg_class c
     join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = 'usage_monitor'
       and c.relkind = 'r'`
  );

  if (usageMonitor.rowCount === 0) {
    console.error(
      "FAIL: public.usage_monitor missing. Run db:push (migration 20260526120000_usage_monitor_credit_guard.sql)."
    );
    ok = false;
  } else {
    console.log("OK: public.usage_monitor exists.");
  }

  const usageMonitorAdd = await client.query(
    `select p.proname
     from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'msgf_usage_monitor_add'`
  );

  if (usageMonitorAdd.rowCount === 0) {
    console.error(
      "FAIL: public.msgf_usage_monitor_add missing. Run db:push (migration 20260622120000_usage_monitor_increment.sql)."
    );
    ok = false;
  } else {
    console.log("OK: public.msgf_usage_monitor_add exists.");
  }

  await client.end();

  if (!ok) {
    process.exit(1);
  }

  console.log("");
  console.log("All schema checks passed.");
  console.log(
    "If the dashboard still reports schema-cache errors, reload the API schema in Supabase Dashboard → Settings → API."
  );
}

main().catch((e) => {
  const msg = e.message || String(e);
  if (/tenant\/user|Tenant or user not found/i.test(msg)) {
    console.error(msg);
    console.error(
      "\nPooler host does not match your project. In Supabase Dashboard → Database → Connection string, " +
        "copy the URI exactly (check aws-0 vs aws-1 prefix and region, e.g. aws-1-us-west-2). " +
        "Set SUPABASE_POOLER_AWS_PREFIX=aws-1 (or aws-0) and SUPABASE_POOLER_REGION to match the host."
    );
    process.exit(1);
  }
  if (/getaddrinfo ENOTFOUND/i.test(msg)) {
    console.error(msg);
    console.error(
      "\nDatabase host could not be resolved. Paste the exact Connection string URI from " +
        "Supabase Dashboard → Database into packages/msgf/.env.local as DATABASE_URL."
    );
    process.exit(1);
  }
  if (/ETIMEDOUT|ECONNREFUSED|i\/o timeout|dial tcp/i.test(msg)) {
    console.error(msg);
    console.error("\n" + connectionFailureHint());
    process.exit(1);
  }
  if (/password authentication failed|28P01/i.test(msg)) {
    console.error(msg);
    console.error("\n" + authFailureHint());
    process.exit(1);
  }
  console.error(msg);
  process.exit(1);
});
