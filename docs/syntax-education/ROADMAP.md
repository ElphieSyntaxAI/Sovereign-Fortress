# Syntax Education — Product Roadmap

**Status:** Delivery tracker aligned to MSGF P1–P6 and phased master spec.  
**Last updated:** 2026-05-18

| Document | Purpose |
| :--- | :--- |
| [`syntax_education_masterdoc.md`](./syntax_education_masterdoc.md) | **What** features must exist (phases, functional spec) |
| [`syntax_education_pillars.md`](./syntax_education_pillars.md) | **How** they must behave (pillar gates, HALT rules) |
| [`../MSGF_PILLAR_MAPPING_SSOT.md`](../MSGF_PILLAR_MAPPING_SSOT.md) | Engineering pillar numbers & code entry points |
| [`../MONOREPO_PRODUCTS.md`](../MONOREPO_PRODUCTS.md) | Monorepo surfaces & URLs |

**Production URL (target):** https://syntaxeducates.elphiesyntax.com  
**Repo:** `apps/syntax-educates/` · **MSGF tenant:** `tenant_education` / `syntax_education`  
**Login (platform matrix):** Education tab — **Coming Soon** on apex until Phase 1 auth ships.

---

## 1. Current implementation snapshot

| Area | Status | Notes |
| :--- | :--- | :--- |
| Vite shell (`apps/syntax-educates`) | 🟡 Scaffold | Placeholder login UI only |
| MSGF tenant manifest | 🟢 Present | `tenant_education` in `packages/msgf/config/tenant-manifest.json` |
| Platform login personas | 🟡 Defined | Student / Teacher / Admin IT in `platform-persona-auth.ts`; sign-in gated |
| Shared Supabase / `p4_profiles` | 🟢 Shared | Same brain as Author/MSGF; education entitlement path TBD |
| HAL / "The Call" in education UI | 🔴 Not started | Reuse Author extension patterns + in-sandbox hooks (P4) |
| Socratic sandbox dual-pane | 🔴 Not started | Phase 1 MVP |
| Curriculum RAG (district PDF) | 🔴 Not started | MSGF ingest + P6 shard (Author RAG is reference) |
| Canvas LTI 1.3 | 🔴 Not started | Phase 1 MVP |
| Parent / teacher dashboards | 🔴 Not started | Phase 2–3 |
| Utah S.B. 149 / H.B. 273 gates | 🔴 Not started | P1 policy pack for education |

---

## 2. Phase overview

```
Phase 1 (MVP)          Phase 2                    Phase 3
─────────────────      ─────────────────────      ─────────────────────────
ELA/History sandbox    Math step tracker          K–3 print hub (H.B. 273)
The Call → P4          Science lab RAG            Gamified practice (P6 index)
Socratic tutor         Parent dashboard           Admin legal dashboard (P1)
Canvas LTI → P3        Subject models (P5/P6)   District scale / UDL
Static curriculum RAG  Cohort dual-model alerts   State lab launch
```

---

## 3. Feature ↔ pillar matrix (corrected alignment)

Legend: **Primary** = owning pillar · **Also** = read/write or enforcement dependency

### Phase 1 — Core MVP

| Feature (masterdoc) | Primary | Also | MSGF / repo dependency |
| :--- | :---: | :---: | :--- |
| **"The Call" keystroke hook** | **P4** | P6 | `msgf-hot-layer`, `p4_hal_ledger`, `p1HalStandard.ts`; education sandbox `content.js` pattern from Author extension |
| **Baseline HAL → Human Effort Score** | **P4** | P6 | HAL session ingest → `POST /api/hal/session` (BFF or MSGF); score index in P6 |
| **Paste / injection defense** | **P4** | P1, P6 | Flight-time gaps → P6 instance; P1 HALT on policy tier breach |
| **Socratic Sandbox (dual-pane UI)** | **P5** | P2, P4 | New `apps/syntax-educates` workspace; tutor pane calls MSGF Pulse |
| **Socratic Tutor (no direct answers)** | **P2** | P1, P6 | `PulseEngine` + education system prompts; P1 AI Allowance Regulator |
| **Static context RAG (one workbook)** | **P6** | P3 | `IngestService`, `pillar_vectors`, 1.1.1 metadata; tenant-scoped ingest |
| **Canvas LTI 1.3 SSO** | **P3** | P1 | LTI service + `p4_profiles`; maps to Teacher/Student/Parent roles |
| **Gradebook / SpeedGrader token** | **P3** | P6 | Human Effort Certificate from P6 + LTI outcomes API |
| **Utah S.B. 149 disclosure screen** | **P1** | P3 | Pre-session gate before any P4/P2 processing |
| **AI Allowance levels (L1–L3)** | **P1** | P2 | Per-assignment policy row; blocks tutor CONVERGE when L3 |

### Phase 2 — Cross-curricular

| Feature | Primary | Also | Notes |
| :--- | :---: | :---: | :--- |
| Math multi-step latency tracker | **P4** | P2, P6 | Line-level "The Call" segmentation |
| Science lab report RAG | **P6** | P4 | Lab template shards + logic validation rules |
| Science method compliance | **P2** | P6 | Milestone: hypothesis before results |
| Parent dashboard (Resilience / Friction) | **P5** | P3, P6 | Read-only P3 role; aggregates from P6 |
| Subject-specific model routing | **P2** | P1 | CONVERGE profile per subject (config in P5) |
| Teacher friction heat map | **P5** | P6 | Classroom cohort rollup |
| Google Workspace add-on (Docs / Sheets / Slides) | **P4** | P5, P6 | Apps Script `onEdit()` / `onChange()` + HTML sidebar; `ecosystem_source=GOOGLE_EDIT` (pillars §2.4.1) |
| Microsoft 365 add-in (Word / Excel / PowerPoint) | **P4** | P5, P6 | Office.js `addHandlerAsync`; `ecosystem_source=MS_OFFICE_EDIT` |
| Active session focus monitor | **P4** | P6 | `document.hidden` + window blur → focus pause beats |
| Embedded research portal | **P5** | P4, P6 | Iframe-sandboxed search; pipes copy-paste to Citation Hall Engine |
| Degraded telemetry modes (`CELL_MUTATION` / `FOCUS_DURATION`) | **P4** | P6 | Surrogate Human Effort signals when host API blocks keystroke timing |

### Phase 3 — Scale & compliance

| Feature | Primary | Also | Notes |
| :--- | :---: | :---: | :--- |
| K–3 print worksheets hub (H.B. 273) | **P6** | P4, P3 | Telemetry → offline PDF generation; zero-screen path |
| Gamified practice from error log | **P5** | P6 | Reads P6 genealogical instances |
| Admin legal governance dashboard | **P1** | P3 | District overrides, FERPA/COPPA flags |
| Universal admin settings | **P5** | P1 | Tenant-wide P5 config surfaced to super-admin |
| Dual-model cohort analytics | **P2** | P6 | MSGF CONVERGE + ARBITRATE for emergent failures |
| State laboratory launch | **P1** | P3 | Compliance pack per state adapter |
| Citation Hall Engine (`3.0_RESEARCH` root) | **P6** | P4 | Genealogical schema relaxed to accept `3.0_*` roots; new lineage `3.1.2_UNATTRIBUTED_SOURCE_STRING` (pillars §2.6.1) |
| Trusted research domain registry | **P6** | P1 | Per-tenant allowlist surfaced via admin governance dashboard |
| Admin curriculum catalog ingestion | **P1** | P3, P6 | Upload PDFs / LTI publisher tokens; cross-tenant guardrail per pillars §2.1.4 (masterdoc §4.1) |
| Friction-gap recommendation engine | **P6** | P1 | Scans 1.1.1 instance hotspots → catalog keyword match (masterdoc §4.1) |
| Teacher curriculum tree picker | **P5** | P2 | Nested Unit/Chapter/Section checkboxes (masterdoc §4.2) |
| `resource_context_id` slicing + tokenized deep link | **P2** | P1, P3 | Junction `education_assignment_resources`; signed publisher / Supabase Storage URL |
| Socratic boundary sync (RAG locked to slice) | **P6** | P2 | `match_education_curriculum_shards` filtered by `resource_context_id` (masterdoc §4.3) |
| Reading dependency trigger (un-skippable focus block) | **P2** | P4, P5 | Focus-beat verified pre-composition gate (pillars §2.2.1) |

---

## 4. Pillar delivery checklist (Syntax Education)

Use this with [`syntax_education_pillars.md`](./syntax_education_pillars.md) for acceptance criteria.

| Pillar | Education capability | Phase | Delivery |
| :--- | :--- | :---: | :---: |
| **P1** | AI Allowance Regulator + Utah S.B. 149 / H.B. 273 HALT | 1 | 🔴 |
| **P1** | Admin legal governance dashboard | 3 | 🔴 |
| **P2** | ELA/History milestone gates | 1 | 🔴 |
| **P2** | Math / science step gates | 2 | 🔴 |
| **P2** | Socratic tutor CONVERGE (anti-answer prompts) | 1 | 🔴 |
| **P3** | Canvas LTI 1.3 + role matrix | 1 | 🔴 |
| **P3** | De-identified tokens for analytics | 1–2 | 🔴 |
| **P3** | Platform login + `syncPlatformEntitlement` (education) | 1 | 🟡 |
| **P4** | "The Call" in sandbox + Redis hot layer | 1 | 🔴 |
| **P4** | HAL session → effort score pipeline | 1 | 🔴 |
| **P5** | Socratic dual-pane + local literacy HUD | 1 | 🔴 |
| **P5** | Parent/teacher dashboard shells | 2 | 🔴 |
| **P6** | District curriculum ingest + 1.1.1 tree | 1 | 🔴 |
| **P6** | Mistake hall + strength-based tutor memory | 1–2 | 🔴 |
| **P6** | Human Effort Certificate export | 1 | 🔴 |
| **P4** | External telemetry router (`ecosystem_source` + degraded modes) | 2 | 🔴 |
| **P4 / P5** | Google Workspace add-on (Docs / Sheets / Slides) | 2 | 🔴 |
| **P4 / P5** | Microsoft 365 add-in (Word / Excel / PowerPoint) | 2 | 🔴 |
| **P4** | Active session focus monitor (`document.hidden` + blur) | 2 | 🔴 |
| **P5 / P6** | Embedded research portal + reading-time tracker | 2–3 | 🔴 |
| **P6** | Citation Hall Engine (`3.0_RESEARCH` lineage + schema relax) | 2–3 | 🔴 |

---

## 5. Recommended build order (Phase 1)

Aligned to MSGF **SWEEP → SHARD → DEFEND → CONVERGE** and education gates:

1. **P3** — Education BFF or MSGF-hosted auth; enable platform login tab; LTI stub + roles on `p4_profiles`.
2. **P1** — Education policy pack (AI levels, Utah disclosure, no auto-grade); wire to `msgf-legal` patterns.
3. **P5 + P4** — Socratic sandbox UI + "The Call" hook (port Author extension logic; `syntax_education` tenant).
4. **P4** — HAL session POST + Redis hot slice; verify `bootstrapTenantBrain` for `syntax_education`.
5. **P6** — Single-chapter PDF ingest + shard; tutor RAG scoped to tenant corpus.
6. **P2** — Assignment milestone state machine; block tutor until gates pass.
7. **P2 + P6** — Socratic tutor via MSGF Pulse with anti-cheat system boundary.
8. **P3** — Canvas LTI grade passback with effort certificate.

---

## 6. Reuse from monorepo (do not fork guardrails)

| Need | Reuse |
| :--- | :--- |
| HAL capture | `apps/author-ecosystem/extension/` (Google Docs / Word Online) → education sandbox iframe |
| HAL API | `apps/author-ecosystem/server` `POST /api/hal/session` or MSGF pulse-adjacent routes |
| Entitlement / profile | `MSGF.syncPlatformEntitlement` in `packages/msgf/lib/msgf-onboarding.ts` |
| RAG ingest | `packages/msgf/lib/services/IngestService.ts` |
| Tutor / consensus | `packages/msgf/lib/services/PulseEngine.ts` |
| Pillar baseline | `bootstrapTenantBrain(admin, 'syntax_education', entityId)` |
| UI primitives | `@elphie-syntax/ui`, `PlatformLoginMatrix` |

---

## 7. Alignment corrections (masterdoc ↔ MSGF SSOT)

These deltas are intentional in this roadmap so Cursor indexes **one** pillar truth:

| Topic | Informal / draft wording | Correct MSGF pillar |
| :--- | :--- | :--- |
| "The Call" ingestion | Sometimes grouped with P6 HAL Score | **P4** telemetry; **P6** stores derived score & error taxonomy |
| HAL charter file `.msgf/P1_HAL.md` | Filename says P1 | **P4** extension charter (see SSOT §3) |
| Static Ledger vs. Utah law | Education P1 description | Matches MSGF **P1 Static Ledger** ✅ |
| Entity / SSO / Canvas | Education P3 | Matches MSGF **P3 Entity Profiles** ✅ |
| Redis hot session | Education P4 | Matches MSGF **P4 State Ledger** ✅ |
| Editor fonts / HUD | Education P5 | Matches MSGF **P5 Local Variables** ✅ |
| Genealogical tree / Hall | Education P6 | Matches MSGF **P6 Constraint Ledger** ✅ |

---

## 8. Success metrics (Phase 1 exit)

- [ ] Student completes Utah disclosure (P1) before first keystroke (P4).
- [ ] Teacher assigns AI Allowance level; L3 blocks tutor responses (P1/P2).
- [ ] Sandbox captures ≥1 HAL session with paste detection (P4 → P6).
- [ ] Tutor answers only from ingested chapter shards (P6); zero direct-answer violations in test suite (P2/P6).
- [ ] Canvas LTI launches sandbox and receives effort token (P3/P6).
- [ ] `tenant_education` passes `bootstrapTenantBrain` / pillar baseline probe.

---

## Changelog

| Date | Change |
| :--- | :--- |
| 2026-05-18 | Initial roadmap; feature–pillar matrix; HAL on P4 per MSGF SSOT |
| 2026-05-18 | Phase 2/3 expansion: Google Workspace add-on, MS 365 add-in, focus monitor, embedded research portal, Citation Hall Engine; aligned to pillars §3 / §2.4.1 / §2.6.1 |
| 2026-05-18 | Phase 2/3 expansion: admin curriculum catalog + recommendation engine, teacher slicing widget (`resource_context_id`), Socratic boundary sync, reading dependency trigger; aligned to masterdoc §4 + pillars §2.1.4 / §2.2.1 |
