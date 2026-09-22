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
 * Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
 */
import dotenv from "dotenv";
import pg from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDatabaseUrl } from "./lib/normalize-database-url.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(here, "../.env.staging.local") });
dotenv.config({ path: path.join(here, "../../.env.staging.local") });

const { url, warnings } = resolveDatabaseUrl({
  ...process.env,
  SUPABASE_POOLER_PORT: "5432",
});
for (const w of warnings) console.warn("Note:", w);
if (!url) {
  console.error("Missing staging DATABASE_URL / SUPABASE_DB_PASSWORD");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
await client.query(`
  CREATE TABLE IF NOT EXISTS public.msgf_sandbox (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    content text NOT NULL DEFAULT '',
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    embedding vector(1536),
    created_at timestamptz NOT NULL DEFAULT now()
  )
`);
const { rows } = await client.query(
  `SELECT to_regclass('public.msgf_sandbox') AS t`
);
console.log("msgf_sandbox", rows[0]?.t);
await client.end();
