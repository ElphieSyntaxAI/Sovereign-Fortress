# Author Ecosystem Roadmap & Key Language (SSoT)

**Status:** Single source of truth for product vision, terminology, phased delivery, tiers, and target system states.  
**Companion tracker:** Operational repo ↔ pillar mapping lives in `docs/PILLAR_PROGRESS.md` (update both when scope shifts).

**Production URL:** **https://authorecosystem.elphiesyntax.com** (global hub / picker: **https://elphiesyntax.com**)

**Shared engine:** MSGF (guardrails, Pulse, Vault/Hall) — **https://elphiesgatedai.elphiesyntax.com** — see [`MSGF_V1_ROADMAP.md`](../msgf/MSGF_V1_ROADMAP.md) and [`MONOREPO_PRODUCTS.md`](../MONOREPO_PRODUCTS.md).

**Last updated:** 2026-08-12

**Public roadmap UI (SSOT):** `packages/core/src/lib/author-roadmap-content.ts` · live at **https://authorecosystem.elphiesyntax.com/roadmap** and **https://elphiesgatedai.elphiesyntax.com/roadmap?product=author**

**Picker status (public):** **Foundational testing** on authorecosystem — registration gated behind `/beta` waitlist.

---

## 0. Progress pulse (2026-08-06)

| Scope | % complete | Notes |
| :--- | :---: | :--- |
| **Project switcher plan** (nav + hub isolation) | **100%** | All five plan todos shipped — see §3 Phase 1 row + changelog. |
| **Phase 1 — Foundation** (table below) | **~78%** | Ingest + MSGF governance wires (Shadow/Active, verify-result, sync brain default); HAL cert + tier copy still partial. |
| **Phase 2 — Professionalization** | **~42%** | Cool-down unlock → verify-result; editor hub + deploy-gate advisory; dual-structure T3 HITL on ingest. |
| **Phase 3 — Scaling & Sovereignty** | **~5%** | Lore-bot / multimedia / growth analytics mostly future. |
| **Author Ecosystem overall (Phases 1–3)** | **~48%** | Weighted toward Phase 1 shipping surface on authorecosystem. |
| **MSGF governance adoption (high/medium)** | **~85%** | Gateway + tiers + quarantine signals + period-report links + Hybrid seal; Gemini still direct (no `/api/v1` Gemini upstream yet). |

**Project switcher plan checklist (100%):**

1. ~~Selection identity (`manuscriptId` + `tenantId` + `seriesId`)~~
2. ~~Nav `MS:` dropdown (series / standalone groups + confirm)~~
3. ~~Hub activate harden + series rename/delete fix~~
4. ~~No cross-book client bleed (per-`manuscriptId` remount/keys; series RAG share kept)~~
5. ~~Smoke / helper verification~~

---

## 1. Core Vision: The Creative Integrity Flywheel

ElphieSyntax is a sovereign narrative infrastructure that transitions authors from **“Protecting the Work”** (Sovereignty) to **“Perfecting the Work”** (Professionalism).

---

## 2. Key Terminology (The “Sovereign” Lexicon)

| Term | Definition | Legal / Technical Impact |
| :--- | :--- | :--- |
| **HAL Ledger** | Human Authorship Ledger. Telemetry-based proof of biometric interaction. | Defends copyright via “Chain of Origin.” |
| **Vault Seal** | The bilateral NDA / Pact enforcing zero-training and no-human-browsing. | Contractual data sovereignty. |
| **Cool Down Lock** | A mandatory read-only period (2 / 4 / 6 weeks) after a draft is finished. | Forces professional distance; triggers audit. |
| **Bicameral Audit** | Dual-AI review (Librarian for logic, Critic for sensitivity). | Provides a logic audit receipt for publishers. |
| **Publisher Hub** | Anonymized WIP feed showing HAL scores, blurbs, and genre. | Proof-based scouting without IP exposure. |
| **Active Project** | The manuscript currently in scope (`manuscriptId` + `tenantId` + optional `seriesId`). | Wiki, outline, drafting, and HAL client state bind to this book; no cross-book bleed. |
| **Series RAG share** | Sibling manuscripts in the same `p4_series` may share wiki/lore retrieval. | Intentional continuity within a series; never across different series/standalone books. |

**Implementation note (engineering):** Tiered manuscript locks today use **4w / 6w / 8w** `lock_tier` values in `p4_manuscripts` plus a separate **24h planning-sync cooldown** (`COOLDOWN_LOCKED`) for Apprentice/Guild gates. Product copy and pricing should converge on this SSOT over time.

---

## 3. Development Phases

### Phase 1: The Foundation (Current WIP — ~78%)

| Feature | Description | Status |
| :--- | :--- | :---: |
| **Document ingest (MSGF V3.2)** | Uploads & Google Docs → scan → authorship Q&A → review → commit (wiki, outline, world bible). Default `sync_msgf_brain` when pulse ready; dual-disagree → T3 HITL + verify fail. | ~90% |
| **Project switcher (nav + hub)** | Always-visible `MS:` dropdown + hub kanban; activate with `manuscriptId` / `tenantId` / `seriesId`; outline & docs remount per book; series siblings may share RAG. | **100%** |
| **HAL v2 Certificate** | Telemetry summary + Vault Seal + Lore-Git chain (exportable proof bundle). **ML-DSA-65** (FIPS 204 algorithm family) over RFC 8785-canonical JSON when `MSGF_HAL_PQC_SIGN=1`. See [`MSGF_PQC_CRYPTO_AUDIT.md`](../msgf/technical-specs/MSGF_PQC_CRYPTO_AUDIT.md). | ~70% |
| **MSGF Pulse bridge** | HAL chunk-pulse → Gated AI routing (`x-msgf-converge-tier: TIER_1`); token savings on `tenant_id=author_ecosystem`. | ~90% |
| **MSGF governance (high/medium)** | Shadow/Active gateway for Librarian + Critic; verify-result on unlock/commit; deploy-gate advisory on editor hub; period-report + quarantine ops links; Hybrid KEM Vault Pact seal. | **~85%** |
| **Author RAG Model** | Sidekick for continuity and outline adherence (OpenAI via MSGF gateway when mode ≠ off). | ~75% |
| **Progress Tracking** | Word count + outline percentage. | ~40% |
| **Unified Registration** | Atomic transaction (Auth + Profile + Pact + Legacy) + optional Hybrid KEM attestation envelope. | ~70% |

**Project switcher evidence:** `ActiveManuscriptChip.tsx`, `NarrativeContext.tsx`, `manuscriptTypes.ts` (`hubRowToSelection`), `ManuscriptHub.tsx`, `PlanningCommandCenter.tsx`, series scope via `seriesRagScope.ts`.

### Phase 2: Professionalization (Immediate Focus — ~42%)

| Feature | Description | Status |
| :--- | :--- | :---: |
| **Cool Down Revision Lock** | Read-only state gate with timer-based unlocks; unlock posts MSGF `verify-result`. | ~70% |
| **Revision Reports** | Automated insights on continuity, plot holes, and market appeal (Critic via MSGF gateway). | ~50% |
| **Editor Suite** | Dashboard for human editors; quality gate + optional deploy-gate (`MSGF_AUTHOR_REQUIRE_DEPLOY_GATE`). | ~30% |
| **Community Guild** | Marketplace for verified human translators, artists, and VAs. | ~10% |

### Phase 3: Scaling & Sovereignty (~5%)

| Feature | Description | Status |
| :--- | :--- | :---: |
| **Author Growth Tracking** | Vocabulary and craft analytics. | ~5% |
| **Multimedia Vault** | Video / audio uploads (Patreon-style or Stripe-gated). | ~0% |
| **Graph Comparison** | Sales data vs. multimedia engagement vs. AI insights. | ~0% |
| **Personality Lore Bots** | Character-specific RAG models for fan interaction (non-spoiler). | ~15% |

---

## 4. Tiers & Encryption Levels

### Author Tiers

| Tier | Price | Capabilities (SSoT) |
| :--- | :--- | :--- |
| **Tier 1 (Free)** | — | Extension + HAL (biometric only) + 1 WIP. |
| **Tier 2** | **$29.99** | Dashboard + 2 WIP + Guild access (Level 1 editors). |
| **Tier 3** | **$79.99** | 5 WIP + 1 Lore Bot + Guild access (Level 2 editors). |
| **Tier 4** | **$109.99** | 10 WIP + 3 Lore Bots + Manual sales tracking + Video (3–5). |
| **Tier 5** | **$199.99** | 20 WIP + 7 Lore Bots + Automated sales tracking + Courses. |

**Reconciliation:** Legacy `msgf_legacy_tiers` seeds and BFF defaults may still reflect older counts or prices until migrations and product rules are aligned to this table.

### Publisher Encryption Keys

| Level | Scope |
| :--- | :--- |
| **Level 1** | Core HAL average (Free). |
| **Level 2** | Chapter-level timestamps and general metrics. |
| **Level 3** | In-depth session-level audit trail. |
| **Level 4** | Full forensic audit trail (max detail). |

---

## 5. System Enforcement (MSGF States)

Target lifecycle vocabulary (product / guardrail layer). Map to `p4_manuscripts.revision_status`, BFF gates, and HAL/Vault policies as implementations mature.

| State | Meaning |
| :--- | :--- |
| **`STATE_SOVEREIGN`** | Vault Pact signed; HAL active. |
| **`STATE_COOLDOWN`** | Manuscript locked; revision logic active. |
| **`STATE_AUDIT`** | Librarian / Critic generating revision reports (bicameral audit path). |
| **`STATE_DISCOVERY`** | Manuscript (anonymized) visible in Publisher Hub. |

**Today (partial mapping):** `DRAFTING`, `LOCKED`, `COOLDOWN_LOCKED`, `AUDITING`, `READY_FOR_EDITOR`, etc., cover slices of the above; explicit `STATE_*` enums in application config may land later without renaming database enums prematurely.

---

## Changelog (SSoT only)

| Date | Change |
| :--- | :--- |
| 2026-08-06 | **MSGF high/medium governance adoption:** Shadow/Active gateway (Librarian+Critic), CONVERGE tiers on Pulse, T3 HITL on ingest dual-disagree, verify-result on commit/unlock, deploy-gate on editor hub, period-report/quarantine ops links, Hybrid KEM Vault Pact seal. Onboarding defaults `sync_msgf_brain`. Progress pulse refreshed (~48% overall). |
| 2026-08-05 | HAL v2 certificate: ML-DSA-65 signed proof bundles (RFC 8785 canonicalize) when `MSGF_HAL_PQC_SIGN=1`; crypto audit linked. |
| 2026-07-13 | **Project switcher shipped (plan 100%):** nav `MS:` dropdown + hub activate with `seriesId`; per-book outline/wiki/drafting isolation; series RAG share retained. Added §0 progress pulse (Phase 1 ~72%, overall ~45%). Lexicon: Active Project, Series RAG share. |
| 2026-05-15 | Linked production URL (elphiesyntax.com), MSGF engine (elphiesgatedai.elphiesyntax.com), and monorepo/MSGF 1.0 companion docs. |
| 2026-05-13 | Initial SSoT: Creative Integrity Flywheel, Sovereign Lexicon, three phases, five author tiers, four publisher key levels, MSGF state model. |
