# Six Pillars & AUTH Plan — Progress Tracker

**Purpose:** Track how the immutable writing-audit vision (HAL, MSGF, stylometry, revision gates, RAG) maps to the repo. Update statuses and the changelog as work lands.

**How to update:** Change the **Status** column (`Done` | `Partial` | `Not started` | `N/A`) and add a row under **Changelog** with date + brief note. Optionally add file paths under **Primary evidence**.

**Product SSOT (vision, lexicon, phased roadmap, tiers, MSGF states):** [`docs/AUTHOR_ECOSYSTEM_ROADMAP.md`](./AUTHOR_ECOSYSTEM_ROADMAP.md) — update that file when marketing or scope-of-record changes; keep this tracker aligned when implementation status shifts.

**MSGF platform SSOT (1.0 release, V3 master spec, three production domains):** [`docs/MSGF_V1_ROADMAP.md`](./MSGF_V1_ROADMAP.md) · [`docs/MONOREPO_PRODUCTS.md`](./MONOREPO_PRODUCTS.md)

**Last reviewed:** 2026-05-21

---

## Vision summary

Aligned with **Creative Integrity Flywheel** and the **Sovereign Lexicon** in [`AUTHOR_ECOSYSTEM_ROADMAP.md`](./AUTHOR_ECOSYSTEM_ROADMAP.md) (HAL Ledger, Vault Seal, Cool Down Lock, Bicameral Audit, Publisher Hub).

| Pillar | Goal |
|--------|------|
| **HAL** | Human Authorship Ledger — manual typing vs AI / programmatic paste |
| **MSGF** | Multi-Stage Guardrail Framework — World Bible rules AI must not violate |
| **Stylometric fingerprint** | Author voice; drift and bot-style signals |
| **Revision gates** | Cool Down Lock + planning cooldown — deliberate editing and audit gates |
| **Immutable audit** | Durable logs, contracts, forensic access rules |
| **RAG / world** | Outline + bible in vector store; character-consistent lore |

---

## Pillar ↔ repo (high level)

| Pillar | Status | Primary evidence (examples) |
|--------|--------|-------------------------------|
| HAL | Partial | `apps/author-ecosystem/extension/src/content.js`, `packages/msgf/lib/P4.ts`, pulse route, `p4_hal_ledger` migrations |
| MSGF | Partial → strong (V3.2 ops) | `pulse/route.ts`, `PulseEngine.runThroughDefend`, `lib/v32-ultra-directive.ts`, `POST /api/msgf/ops/v32-heartbeat`, `hall-purge-protocol.ts`, dashboard arbitrate (session + service admin) |
| Stylometric fingerprint | Partial | `packages/msgf/supabase/migrations/*hal_ledger*rolling*`, `apps/author-ecosystem/server/src/lib/forensics/`, `packages/core/src/lib/forensics/` |
| Revision gates | Partial → strong | `apps/author-ecosystem/server/src/lib/RevisionLockService.ts`, `20260515180000_p4_manuscripts_revision_p4_revision_reports.sql` |
| Immutable audit | Partial | `p4_narrative_logs`, `packages/msgf/lib/pov-logger.ts`, `ContractAutomationService.ts`, `p4_legal_contracts` migration |
| RAG / world | Partial → strong | `20240508_unified_ecosystem.sql` (`vector`), narrative library migrations, `IngestionService.ts`, librarian routes/controllers |

---

## Phase 1 — Security & ledger foundation

| AUTH | Deliverable | Status | Primary evidence | Notes |
|------|-------------|--------|------------------|-------|
| AUTH-7 | MSGF root + six pillar **markdown** guides for AI development | Partial | `packages/msgf/.msgf/P1` … `P6` (currently **empty** stubs), `msgf-ingest.ts`, `identity-violations.ndjson` | Replace 0-byte `P*` files with real pillar docs when ready |
| AUTH-8 | Google Docs extension: trusted typing vs programmatic paste | Partial | `apps/author-ecosystem/extension/src/content.js`, extension README | Paste flagged `isSystemEvent`; full Docs API + OAuth still scaffold |
| AUTH-9 | DB schema for **5** subscription tiers (Free → **$199.99**) | Partial | `msgf_legacy_tiers` in `20260516900000_msgf_legacy_express_tables_and_rules.sql` (seed has **3** tiers today); product prices in [`AUTHOR_ECOSYSTEM_ROADMAP.md`](./AUTHOR_ECOSYSTEM_ROADMAP.md) | Align seed + `msgf_rules` / BFF defaults to SSOT ($29.99 … $199.99) |
| AUTH-10 | **4-level** asymmetric encryption for publisher-safe report sharing | Partial | `packages/core/src/lib/forensics/calibration-node.ts` (school / FERPA encryption path) | Core has calibration encryption; full **4-level publisher** design not fully reflected here |

---

## Phase 2 — Staging & revision gates

| AUTH | Deliverable | Status | Primary evidence | Notes |
|------|-------------|--------|------------------|-------|
| AUTH-12 | **Prancer** staging middleware — AI prose until human approve/reject | Partial | `.github/workflows/security-prancer-pillars.yml`, `packages/msgf/scripts/security-primer-pillars.mjs`, `npm run security:prancer-pillars` | Static migration + embedded-key scan in CI; Prancer Cloud policy packs still optional; Staging DB parity via `npm run verify:supabase-schema` + `SUPABASE_DATABASE_URL` (e.g. `workflow_dispatch` in workflow) |
| AUTH-13 | Revision locks (**2–6 week** cool-down style) | Partial | `RevisionLockService.ts` — tiers **4w / 6w / 8w** | Align product copy with actual tier weeks |
| AUTH-14 | Auto continuity / theme reports when revision lock **expires** | Partial | `AuthorSovereigntyService.ts` (cool-down + Librarian continuity gap report) | Confirm **scheduler** / trigger vs on-demand API only |

---

## Phase 3 — Author fingerprinting & analysis

| AUTH | Deliverable | Status | Primary evidence | Notes |
|------|-------------|--------|------------------|-------|
| AUTH-16 | Stylometric analyzer from **verified** human sessions | Partial | Forensics + HAL snapshot JSON on `p4_hal_ledger` | May need explicit “verified session” gate in UI/policy |
| AUTH-17 | **5-session** sliding average = author fingerprint baseline | Partial → strong | `20260510150000_p4_hal_ledger_rolling_avg_5_view.sql` + recalibration migrations | Recalibration boundary filtering in later migrations |
| AUTH-29 | Latency alarms — keystroke speed above human capability | Partial | `halMetrics.ts`, core calibration pure/node | Wire alerts / incidents if not already centralized |

---

## Phase 4 — World building & RAG

| AUTH | Deliverable | Status | Primary evidence | Notes |
|------|-------------|--------|------------------|-------|
| AUTH-23 | RAG ingestion — **pgvector** for outline + World Bible | Partial → strong | `20240508_unified_ecosystem.sql`, ingest routes, `IngestionService.ts` | |
| AUTH-25 | Lore bot matrix — character bible metadata for voice consistency | Partial | Character embedding columns in unified migration; chunk / lore migrations | “Matrix” product layer may still be thin |

---

## Cross-cutting engineering notes

- **Author-ecosystem entrypoint:** `apps/author-ecosystem/server/src/main.ts` is the **canonical BFF** (HAL, librarian, recalibration, proxies). Legacy Express (`index.js` / `server.js`, port **3003**) remains for **RAG + lore-git + JWT auth** against Supabase Postgres via `DATABASE_URL` and `msgf_legacy_*` / `msgf_rules` — not local Docker Postgres.
- **MSGF:** `next build` has succeeded in dev; runtime needs Supabase + model envs. Optional: resolve multi-lockfile / `outputFileTracingRoot` warning.
- **Jira:** This file does **not** sync Jira automatically; paste ticket keys in **Changelog** or link epics when you close work.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-21 | **V3.2-ULTRA §2.6 closure:** `v32_directive` on Pulse responses; `MSGF_REQUIRE_REDIS` + `/health` SHARD probe; ingest DEFEND (`preFlightCheck`); signed-in dashboard Human Arbitrate; `POST /api/msgf/ops/v32-heartbeat` (tier batches + 30d Hall purge); live checklist on `/status`. |
| 2026-05-15 | **MSGF V3.2-ULTRA:** `docs/references/MSGF_v3_2_masterdoc.pdf` + roadmap §2.0–2.6 (hot/cold, Vault/Hall, SWEEP→PERSIST acceptance). |
| 2026-05-15 | **MSGF 1.0 SSOT:** Added `docs/MSGF_V1_ROADMAP.md` (V3 master spec → 1.0 plan) and `docs/MONOREPO_PRODUCTS.md` (three domains: elphiesyntax.com, elphiesgatedai.elphiesyntax.com, syntaxeducation.elphiesyntax.com). |
| 2026-05-13 | **Author Ecosystem SSOT:** Added `docs/AUTHOR_ECOSYSTEM_ROADMAP.md` (vision, lexicon, phases 1–3, five tiers + publisher key levels, MSGF `STATE_*` targets); linked from this tracker and Vision summary. |
| 2026-05-13 | **Prancer pillars (MSGF):** `.github/workflows/security-prancer-pillars.yml` runs static migration + embedded-key scan on PR/push; `npm run security:prancer-pillars` at repo root; optional `workflow_dispatch` + `run_db_verify` + `SUPABASE_DATABASE_URL` for `verify:supabase-schema`. |
| 2026-05-13 | **BFF security:** CORS whitelist + credentials; `author_bff_jwt` → **httpOnly** cookie via `/api/auth` bridge; `/api/rag` + `/api/lore-git` proxied to legacy **internal** loopback only. **Data plane purge:** removed local `schema.sql` / `dbConfig.js` / `initDb`; legacy stack uses `DATABASE_URL` + `msgf_legacy_*` + **`msgf_rules`** (RAG allowlists); `supabase db push` applied `20260516900000_*`. Removed duplicate legacy `halRoutes` (HAL lives on TS BFF). |
| 2026-05-08 | Initial tracker: imported 6-pillar rundown + AUTH phases 1–4 with statuses from codebase review. |
