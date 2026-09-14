# MSGF Pillar Mapping — Single Source of Truth

**Status:** Canonical crosswalk for engineering, product, and AI/dev charters.  
**Last updated:** 2026-08-10

This document resolves **documentation debt** where local filenames (e.g. `.msgf/P1_HAL.md`) used pillar numbers that **do not match** the V3.0 / V3.2 master specifications. When in conflict, **master-spec pillar numbers win** for platform architecture; `.msgf/*.md` files are **Author-domain extension charters** and must be read through the mapping table below—not by filename alone.

---

## 1. Canonical references

| Document | Role | Location |
| :--- | :--- | :--- |
| **MSGF V3.0** — Six-pillar taxonomy | Historical baseline (what each P1–P6 *means*) | `docs/references/MSGF_v3_masterdoc.pdf` (Desktop copy may exist) |
| **MSGF V3.2-ULTRA** — Hot/cold storage, Vault/Hall, master directive | Primary **runtime** architecture for MSGF 1.0 | [`docs/references/MSGF_v3_2_masterdoc.pdf`](../../references/MSGF_v3_2_masterdoc.pdf) |
| **MSGF 1.0 release plan** | Acceptance criteria, repo map | [`docs/msgf/MSGF_V1_ROADMAP.md`](../MSGF_V1_ROADMAP.md) |
| **SWEEP audit** | Day-zero code ↔ pillar map | [`packages/msgf/pre_ingestion_audit.md`](../../../packages/msgf/pre_ingestion_audit.md) |
| **Engineering rules** | Six-pillar core directive for agents | [`packages/msgf/.cursorrules`](../../../packages/msgf/.cursorrules) |
| **Author domain charters** | Deep specs for HAL, revision, RAG, etc. | [`packages/msgf/.msgf/`](../../../packages/msgf/.msgf/) |

---

## 2. Engineering six-pillar core (V3.0 taxonomy, V3.2 execution)

V3.2 **does not replace** the six-pillar meanings from V3.0; it adds **Redis hot layer**, **Postgres cold layer**, **Vault vs Hall**, tiered batching, and the **SWEEP → PERSIST** directive. Use this table for all platform code, migrations, and `pillar_vectors.metadata.pillar` values.

| Pillar | V3.0 master role | V3.2-ULTRA emphasis | Primary codebase entry points | Primary Supabase / infra |
| :--- | :--- | :--- | :--- | :--- |
| **P1 — Static Ledger** | Immutable global rules, security constants, legal versions; violations **HALT** | **DEFEND** — shadow abort on P1 breach | [`packages/msgf/lib/msgf-legal.ts`](../../../packages/msgf/lib/msgf-legal.ts), [`packages/msgf/msgf-init.cjs`](../../../packages/msgf/msgf-init.cjs), [`packages/msgf/lib/services/brain-readiness.ts`](../../../packages/msgf/lib/services/brain-readiness.ts), `npm run security:prancer-pillars` → [`scripts/security-primer-pillars.mjs`](../../../packages/msgf/scripts/security-primer-pillars.mjs) | `state_beats` (legal pledge), `legal_attestations`, security-related migrations |
| **P2 — Flow Sequence** | Build order, gate orchestration, deployment roadmaps | **CONVERGE** pipeline ordering | [`packages/msgf/app/api/msgf/pulse/route.ts`](../../../packages/msgf/app/api/msgf/pulse/route.ts), [`packages/msgf/lib/services/PulseEngine.ts`](../../../packages/msgf/lib/services/PulseEngine.ts), [`packages/msgf/pre_ingestion_audit.md`](../../../packages/msgf/pre_ingestion_audit.md) | — |
| **P3 — Entity Profiles** | Roles, tiers, multi-tenant identity | Stripe + credit guard on Pulse | [`packages/msgf/lib/creditGuard.ts`](../../../packages/msgf/lib/creditGuard.ts), [`packages/msgf/middleware.ts`](../../../packages/msgf/middleware.ts), [`packages/msgf/app/api/webhooks/stripe/route.ts`](../../../packages/msgf/app/api/webhooks/stripe/route.ts), `p4_profiles`, [`packages/msgf/lib/services/tenant-query-scope.ts`](../../../packages/msgf/lib/services/tenant-query-scope.ts) | `p4_profiles`, `msgf_legacy_tiers`, tenant RLS migrations |
| **P4 — State Ledger** | Flight recorder; session memory; active logic beats | **SHARD** — Redis hot slices + cold beats | [`packages/msgf/lib/P4.ts`](../../../packages/msgf/lib/P4.ts), [`packages/msgf/lib/msgf-hot-layer.ts`](../../../packages/msgf/lib/msgf-hot-layer.ts), [`packages/msgf/lib/msgf-consensus.ts`](../../../packages/msgf/lib/msgf-consensus.ts), [`packages/msgf/utils/msgf/pulse-client.ts`](../../../packages/msgf/utils/msgf/pulse-client.ts), [`packages/msgf/src/lib/universal/p1HalStandard.ts`](../../../packages/msgf/src/lib/universal/p1HalStandard.ts) *(rhythm types; name is legacy)* | `p4_state_ledger`, `state_beats`, **`p4_hal_ledger`**, `p4_narrative_logs` (beats) |
| **P5 — Local Variables** | Per-site / module UI and config shards | Tenant manifest, dashboard shells | [`packages/msgf/config/tenant-manifest.json`](../../../packages/msgf/config/tenant-manifest.json), [`packages/msgf/lib/tenant-silo.ts`](../../../packages/msgf/lib/tenant-silo.ts), `apps/msgf-dashboard` | Per-tenant JSONB config, demo todos, UI-only state |
| **P6 — Constraint Ledger** | Compliance regression, error history, hallucination avoidance | **Vault** (success) vs **Hall** (failure); **CROSS-REF** + **DEFEND** preflight | [`packages/msgf/lib/defend-preflight.ts`](../../../packages/msgf/lib/defend-preflight.ts), [`packages/msgf/lib/msgf-shadow.ts`](../../../packages/msgf/lib/msgf-shadow.ts), [`packages/msgf/lib/msgf-index.ts`](../../../packages/msgf/lib/msgf-index.ts), [`packages/msgf/lib/services/constraint-ledger.ts`](../../../packages/msgf/lib/services/constraint-ledger.ts), [`packages/msgf/lib/schemas/vault-hall-metadata.ts`](../../../packages/msgf/lib/schemas/vault-hall-metadata.ts) | `pillar_vectors`, `msgf_sandbox`, `p4_narrative_library_chunks` (semantic cold) |

### 2.0a Engineering extension — P7 Source Audit (not a seventh SWEEP pillar)

**P7** is a **DEFEND / P6 provenance layer**, not a new `pillar_vectors.metadata.pillar` value and not a seventh SWEEP ingest bucket. It sits beside Vault/Hall:

| Concern | Tables / modules |
| :--- | :--- |
| Forward audit of cited sources | `msgf_source_audit_events`, beat `metadata.source_audit` |
| Resource reputation + prune/boost | `msgf_resource_reputation` (`lib/schemas/source-audit.ts`, `lib/services/source-audit.ts`) |
| Reverse impact by content hash | `msgf_source_downstream_impact` |
| Dashboard | `GET /api/msgf/dashboard/source-audit`, `SourceAuditPanel` |

`attribution_class` is source compliance (copyleft / untrusted), **not** Stripe `billing_license_type`.

### 2.1 HAL (Human Authorship Ledger) — not P1

**HAL** is keystroke/rhythm telemetry (dwell, flight, paste markers). Per master specs it is **P4 State Ledger** scope (and Author Ecosystem), **not** P1 Static Security.

| Concern | Correct pillar | Entry points |
| :--- | :--- | :--- |
| Rhythm telemetry, active slices, biometric baseline | **P4** | `lib/P4.ts`, `p4_hal_ledger`, `utils/msgf/pulse-client.ts`, extension HAL metrics |
| Legal pledge / version HALT | **P1** | `lib/msgf-legal.ts`, `state_beats` |
| Author charter (misnamed file) | **P4 extension** | [`.msgf/P1_HAL.md`](../../../packages/msgf/.msgf/P1_HAL.md) — see §3 |

---

## 3. Author domain charters (`.msgf/*.md`) ↔ engineering pillars

The `.msgf/` directory uses **product-oriented names** that were assigned before this SSOT. **Do not treat the `P#` in the filename as the V3.0 pillar number.**

| Local file | Filename suggests | Actual master pillar | Subject |
| :--- | :--- | :--- | :--- |
| [`P1_HAL.md`](../../../packages/msgf/.msgf/P1_HAL.md) | P1 | **P4 extension** | HAL telemetry (keystroke dynamics) |
| [`P2_MSGF.md`](../../../packages/msgf/.msgf/P2_MSGF.md) | P2 | **P2 + P6** | LOM gates, master directive, governance |
| [`P3_STYLOMETRY.md`](../../../packages/msgf/.msgf/P3_STYLOMETRY.md) | P3 | **P3 + forensic** | Identity / stylometry snapshots |
| [`P4_REVISION.md`](../../../packages/msgf/.msgf/P4_REVISION.md) | P4 | **P4** | Revision locks, temporal gates, cooldowns |
| [`P5_AUDIT.md`](../../../packages/msgf/.msgf/P5_AUDIT.md) | P5 | **P5 narrative + P4 logs** | Immutable narrative / forensic audit |
| [`P6_RAG.md`](../../../packages/msgf/.msgf/P6_RAG.md) | P6 | **P6** | World model, pgvector RAG |

**Planned hygiene (optional):** rename files to `P4_HAL_TELEMETRY.md`, etc., in a follow-up PR to avoid breaking deep links.

---

## 4. V3.2-ULTRA master directive → code map

| Step | Intent | Code / ops entry points |
| :---: | :--- | :--- |
| **SWEEP** | Day-zero audit | [`pre_ingestion_audit.md`](../../../packages/msgf/pre_ingestion_audit.md), `day-zero-scan.js` |
| **SHARD** | Redis hot + Postgres cold | [`msgf-hot-layer.ts`](../../../packages/msgf/lib/msgf-hot-layer.ts), `pillar_vectors`, [`IngestService`](../../../packages/msgf/lib/services/IngestService.ts), [`app/api/msgf/ingest/route.ts`](../../../packages/msgf/app/api/msgf/ingest/route.ts) |
| **DEFEND** | Vault/Hall preflight (`runDefendPreflight`) | [`defend-preflight.ts`](../../../packages/msgf/lib/defend-preflight.ts) · [`msgf-shadow.ts`](../../../packages/msgf/lib/msgf-shadow.ts), Pulse + ingest gates |
| **CROSS-REF** | Vault + Hall preflight | `preFlightCheck`, [`msgf-index.ts`](../../../packages/msgf/lib/msgf-index.ts) |
| **CONVERGE** | Dual-model consensus | [`msgf-consensus.ts`](../../../packages/msgf/lib/msgf-consensus.ts), `PulseEngine` |
| **ARBITRATE** | HITL / recursion limit | `msgf_incidents`, `apps/msgf-dashboard`, `tests/test-lom-disagreement.ts` |
| **PERSIST** | Vault write; Hall purge | [`constraint-ledger.ts`](../../../packages/msgf/lib/services/constraint-ledger.ts), [`scripts/msgf-tier-processor.js`](../../../packages/msgf/scripts/msgf-tier-processor.js), [`scripts/ops-purge-hall.mjs`](../../../packages/msgf/scripts/ops-purge-hall.mjs) |

Full 1.0 acceptance checklist: [`MSGF_V1_ROADMAP.md` §2.6](../MSGF_V1_ROADMAP.md).

---

## 5. Product surfaces (outside `packages/msgf` only)

| Surface | Relationship to pillars |
| :--- | :--- |
| [`apps/author-ecosystem`](../../../apps/author-ecosystem/) | HAL capture, revision UI, legacy RAG (`msgf_legacy_rag_*`); calls MSGF Pulse/ingest |
| [`apps/msgf-dashboard`](../../../apps/msgf-dashboard/) | Ops UI — RED incidents, HITL, pillar health (proxies MSGF API) |
| Marketing / auth shell | [`packages/msgf/app/page.tsx`](../../../packages/msgf/app/page.tsx), sign-in — not pillar logic |

---

## 6. Decision rules (for PRs and agents)

1. **Security, legal version, init HALT** → implement under **P1**; cite `msgf-legal.ts`, not HAL charters.
2. **Keystroke rhythm, paste detection, `p4_hal_ledger`** → implement under **P4**; cite `.msgf/P1_HAL.md` only as the *telemetry charter*, not as “P1 Static Ledger.”
3. **Vault/Hall, shadow preflight, lineage 1.1.1** → **P6** + `pillar_vectors.metadata`.
4. When adding `metadata.pillar` on cold-layer rows, use **V3.0 engineering numbers** (`P1`…`P6`), not `.msgf` filename numbers.
5. Update **this file** when adding a new canonical module or renaming a mislabeled charter.

---

## 7. Related docs

- [`docs/PILLAR_PROGRESS.md`](../../PILLAR_PROGRESS.md) — Author product pillar delivery status (HAL, revision, RAG vision)
- [`docs/MONOREPO_PRODUCTS.md`](../../MONOREPO_PRODUCTS.md) — Which app owns which surface
- [`packages/msgf/README.md`](../../../packages/msgf/README.md) — Runbooks, env, Pulse pledge
