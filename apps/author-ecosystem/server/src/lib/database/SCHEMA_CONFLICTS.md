# Legacy Express vs MSGF Supabase schema

Docker-era `schema.sql` + `dbConfig.js` were **removed**. The legacy Express stack (e.g. `index.js` on port 3003) now uses **`DATABASE_URL`** / **`SUPABASE_DATABASE_URL`** with tables from **`packages/msgf/supabase/migrations/20260516900000_msgf_legacy_express_tables_and_rules.sql`** (`msgf_legacy_*`, `msgf_rules`). The TypeScript BFF (`src/main.ts`) uses **`getSupabaseAdmin()`** and **`p4_*`** objects.

## Identifier map (legacy names vs canonical P4)

| Legacy / `msgf_legacy_*` (Express + direct Postgres) | MSGF / Supabase (BFF services) |
|------------------------------------------------------|--------------------------------|
| (no `hal_ledger` in new legacy DDL) | **`public.p4_hal_ledger`** |
| `msgf_legacy_users`, `msgf_legacy_projects`, … | **`p4_manuscripts`**, **`p4_helpers`**, tenant-scoped rows, etc. |
| `msgf_legacy_rag_*` (768-dim Gemini chunks) | Narrative library in P4 (e.g. **`p4_narrative_library_chunks`**, 1536-dim ingest path) |

**Rule of thumb:** `require("../lib/databaseUrlPool.cjs")` + `msgf_legacy_*` / `msgf_rules` = **legacy Express** only. TypeScript controllers use **`getSupabaseAdmin()`** and **`p4_*`** only.

## Environment variables

| Variable set | Used by |
|--------------|---------|
| **`SUPABASE_URL`** or **`NEXT_PUBLIC_SUPABASE_URL`**, **`SUPABASE_SERVICE_ROLE_KEY`** | `getSupabaseAdmin()` — HAL session, recalibration, `src/lib/*Service` |
| **`DATABASE_URL`** or **`SUPABASE_DATABASE_URL`** | `databaseUrlPool.cjs` — legacy Express auth, RAG, HUD history (`msgf_legacy_*`) |

Do not assume an arbitrary Postgres database matches the Supabase project unless migrations were applied there.

## HAL / forensics canonical names (MSGF migrations)

- **`p4_hal_ledger`** — session rows (stylometric snapshot, latencies, recalibration flags).
- **`p4_hal_ledger_rolling_avg_5`** — **view** (not `v_p4_*`); rolling linguistic baseline after latest `recalibration_event`.
- **`p4_forensic_profiles`** — calibration storage (author plaintext vs school ciphertext).
- **`p4_recalibration_logs`** — optional audit table (see migration `20260511100000_hal_recalibration_support.sql`).

Legacy view name **`v_p4_hal_ledger_rolling_avg_5`** was removed from migrations in favor of the single canonical view above; do not reintroduce it in queries.

## Related code outside this server

- **`@elphie-syntax/core`** (`packages/core/src/lib/forensics/calibration-node.ts`) inserts into **`p4_forensic_profiles`** as a string literal. That name matches MSGF migrations; consider importing identifiers from this server’s `canonicalIdentifiers.ts` only if you later extract a shared `p4-constants` package.
