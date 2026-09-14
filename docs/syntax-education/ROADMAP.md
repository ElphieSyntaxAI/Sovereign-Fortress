# Syntax Education — Product Roadmap

**Status:** Delivery tracker aligned to MSGF P1–P6 and phased master spec.  
**Last updated:** 2026-08-12 (picker: **in development** — ~78% code complete; public host signup not open)

**Picker status (public):** **In development** — Syntax Educates code is largely wired; production soak and public registration still pending.

| Document | Purpose |
| :--- | :--- |
| [`syntax_education_masterdoc.md`](./technical-specs/syntax_education_masterdoc.md) | **What** features must exist (phases, functional spec) |
| [`syntax_education_pillars.md`](./technical-specs/syntax_education_pillars.md) | **How** they must behave (pillar gates, HALT rules) |
| [`DOCS_E2E_CHECKLIST.md`](./DOCS_E2E_CHECKLIST.md) | Live Docs / Classroom / tutor soak checklist |
| [`../MSGF_PILLAR_MAPPING_SSOT.md`](../msgf/technical-specs/MSGF_PILLAR_MAPPING_SSOT.md) | Engineering pillar numbers & code entry points |
| [`../MONOREPO_PRODUCTS.md`](../MONOREPO_PRODUCTS.md) | Monorepo surfaces & URLs |

**Production URL (target):** https://syntaxeducates.elphiesyntax.com  
**Repo:** `apps/syntax-educates/` · **MSGF tenant:** `tenant_education` / `syntax_education`  
**Login (platform matrix):** Education tab **live** (student / teacher / administration_it).  
**Launch hosts:** **Google Classroom first**, Canvas LTI second.  
**Student surface:** Google Docs / Slides / Sheets (Author SSoT lite) — native sandbox is fallback only.  
**Grade focus:** 4th grade+ (K–3 print / light path later).

---

## 0. Completion score (2026-07-13)

| Scope | Complete | How scored |
| :--- | :---: | :--- |
| **Phase 1 MVP (ship path)** | **~84%** | Auth + Classroom cert stub + remaining live soak gaps |
| **Phase 2** | **~72%** | Parent Resilience/Friction UI; reading-gate wire; friction recommend; Citation Hall pure |
| **Phase 3** | **~38%** | Trusted domain registry + governance surface; Hall classification code-complete |
| **Full roadmap (P1–P3 combined)** | **~78%** | Weights: Phase 1 × 60% + Phase 2 × 25% + Phase 3 × 15% |

**Headline for stakeholders:** Syntax Education is **~78% of the full multi-phase roadmap** on code + unit tests (no live LMS soak yet). Offline package landed: **parent dashboard**, **reading gate policy + sandbox wire**, **friction→catalog on teacher board**, **Citation Hall / trusted domains**. Remaining to ~80%+: live migrations/OAuth/Docs soak and light Phase 3 polish.

### Phase 1 capability scores

| Capability | % | Status |
| :--- | ---: | :--- |
| Utah S.B. 149 disclosure + H.B. 273 HALTs | 95 | Live API + sandbox / Docs / M365 gates |
| AI Allowance (0–4) | 90 | Workspace + teacher regulator |
| Admin books by grade + catalog | 85 | Text ingest + layout; PDF storage UX thin |
| Teacher lesson builder + tree picker | 90 | `/lessons` + `education_lessons` |
| `resource_context_id` slicing | 85 | Bound on lesson create |
| HAL Lite + paste injection | 85 | API + Docs sidebar |
| Milestone Gate (CER / outline / etc.) | 90 | Structural parser + state transition |
| Turn-In Lockout | 90 | `EDU_SUBMITTED_LOCK` |
| Teacher Classroom Board | 85 | Cohort trends; no raw drafts |
| Classroom launch (privacy token) | 85 | Launch + mock + OAuth start (needs client env) |
| Google Workspace add-on | 80 | Disclosure / HAL / milestone / turn-in + cert display |
| Socratic tutor + strength bridge | 82 | Demo Vault seed + prompt bridge proven in tests |
| Curriculum RAG / compiler ingest | 65 | Paths exist; district soak incomplete |
| Canvas LTI 1.3 | 55 | Routes present; secondary smoke only |
| Reading dependency gate | 75 | Policy + sandbox `?requireReading=1` + POST wire |
| Demo / QA harness | 95 | `/demo` + bootstrap + Vault seed + OAuth flag |
| Automated education tests | 95 | 24 pure/unit tests green |
| Platform Coming Soon → live auth | 85 | Education ungated; persona redirect paths |
| Human Effort → SpeedGrader / Classroom grade | 70 | Classroom stub on submit; Canvas AGS still thin |

---

## 1. Current implementation snapshot

| Area | Status | Notes |
| :--- | :--- | :--- |
| Vite shell (`apps/syntax-educates`) | 🟢 Wired | Sandbox, lessons, board, curriculum, governance, parent, **QA demo** |
| MSGF tenant manifest | 🟢 Present | `tenant_education` / `syntax_education` |
| Platform login personas | 🟢 Live | Student / Teacher / Admin IT → `/sandbox` `/teacher` `/curriculum` |
| Shared Supabase / `p4_profiles` | 🟢 Shared | Same brain as Author/MSGF |
| Admin curriculum by grade | 🟢 UI + ingest | `/curriculum` + `register_catalog` + `grade_band` |
| Teacher lesson builder | 🟢 UI + API | `/lessons` + CurriculumTreePicker + mock Classroom button |
| Classroom OAuth | 🟡 Wired | start/callback; needs `GOOGLE_CLASSROOM_*` env |
| Classroom mock launch (QA) | 🟢 Present | `POST /api/education/classroom/mock-launch` |
| Demo bootstrap (QA) | 🟢 Present | Vault strength seed + OAuth configured flag |
| HAL Lite | 🟢 Modules + API | Docs sidebar sync; paste `PASTE_INJECTION` |
| Milestone Gate | 🟢 Modules + API | CER / outline / explain / lab |
| Turn-In Lockout | 🟢 State machine | `EDU_SUBMITTED_LOCK` + Classroom cert stub |
| Teacher Classroom Board | 🟢 API + UI | Publisher Hub lite |
| Utah S.B. 149 / H.B. 273 | 🟢 Live path | Kid-readable copy; blocks HAL / tutor / milestones until accept |
| Admin governance | 🟢 Snapshot UI | `/governance` |
| Parent digest | 🟢 Dashboard | `/parent` Resilience / Friction scores (no raw drafts) |
| Google Workspace add-on | 🟡 Shipping scaffold | Disclosure + HAL + milestone + turn-in + cert |
| Microsoft 365 add-in | 🟡 Shipping scaffold | Disclosure gate + telemetry parity hooks |
| Canvas LTI 1.3 | 🟡 Present | Secondary host |
| Curriculum RAG | 🟡 Present | Ingest + slice filter; needs live soak |
| Friction → catalog recommend | 🟢 Wired | Teacher board + admin catalog badges |
| Reading dependency gate | 🟢 Wired | Policy + sandbox demowire |
| Citation Hall / trusted domains | 🟢 Code | `classifyCitationPaste` + governance registry |
| Platform Coming Soon | 🟢 Closed (Education) | Auth ungated; Author/GatedAI as configured |
| Classroom Human Effort stub | 🟢 Wired | `ags_status=classroom_stub` on submit |
| SpeedGrader / AGS passback | 🟡 Thin | Canvas route exists; not validated E2E |
| K–3 print hub | 🔴 Phase 3 | |

**QA shortcut:** `/demo` → Bootstrap (requires `EDUCATION_DEMO_BOOTSTRAP=1`, `EDUCATION_OPEN_LESSON_API=1`, migrations).  
**Docs soak:** [`DOCS_E2E_CHECKLIST.md`](./DOCS_E2E_CHECKLIST.md).  
**Tests:** `npm run test:education` in `packages/msgf`.

---

## 2. Phase overview

```
Phase 1 (MVP) ~84%               Phase 2 ~72%                 Phase 3 ~38%
─────────────────                ─────────────────────        ─────────────────────────
Classroom + Docs (HAL Lite)      Parent Resilience/Friction   Trusted domain registry
Admin books → teacher lessons    Reading gate wire            Citation Hall classify
Socratic + strength bridge       Friction → catalog rec       Admin governance domains
Milestone Gate + Turn-In Lock    M365 / Sheets still thin     K–3 / gamification deferred
Teacher Classroom Board          Subject models as bricks     UDL / district scale
Utah disclosure live             Friction heat polish
Canvas LTI secondary             Research / Citation harden
QA demo + unit tests
```

---

## 2b. Author SSoT → Education vectors

| Author Core | Education vector | Behavior | Delivery |
| :--- | :--- | :--- | :---: |
| HAL Ledger | HAL Lite / Human Effort Signal | Paste + velocity in Docs sidebar | 🟢 |
| Vault Seal | Student Privacy Gate | FERPA/COPPA; anon token | 🟢 |
| Cool Down Lock | Turn-In Lockout | Read-only after submit | 🟢 |
| Bicameral Audit | Milestone Gate | CER / outline before Socratic | 🟢 |
| Publisher Hub | Teacher Classroom Board | Cohort trends; no raw text | 🟢 |

State map: `STATE_SOVEREIGN`→`EDU_ACTIVE_DRAFTING`, `STATE_AUDIT`→`EDU_MILESTONE_CHECKING`, `STATE_COOLDOWN`→`EDU_SUBMITTED_LOCK`.

---

## 3. Feature ↔ pillar matrix (corrected alignment)

Legend: **Primary** = owning pillar · **Also** = read/write or enforcement dependency · Delivery: 🟢 wired · 🟡 partial · 🔴 not started

### Phase 1 — Core MVP

| Feature (masterdoc) | Primary | Also | Delivery | Notes |
| :--- | :---: | :---: | :---: | :--- |
| **"The Call" / HAL Lite** | **P4** | P6 | 🟢 | Classroom-light; Docs sidebar |
| **Baseline Human Effort Score** | **P4** | P6 | 🟡 | Confidence score; certificate export thin |
| **Paste / injection defense** | **P4** | P1, P6 | 🟢 | `PASTE_INJECTION` |
| **Workspace (Docs-first + sandbox fallback)** | **P5** | P2, P4 | 🟢 | Sandbox behind disclosure |
| **Socratic Tutor (no direct answers)** | **P2** | P1, P6 | 🟡 | Strength-bridge prompts; needs live soak |
| **Static context RAG (workbook)** | **P6** | P3 | 🟡 | Compiler ingest + shards |
| **Canvas LTI 1.3 SSO** | **P3** | P1 | 🟡 | Secondary path |
| **Gradebook / SpeedGrader token** | **P3** | P6 | 🔴 | AGS stub only |
| **Utah S.B. 149 disclosure** | **P1** | P3 | 🟢 | Live gate |
| **AI Allowance levels (0–4)** | **P1** | P2 | 🟢 | Layer B regulator |
| **Admin curriculum catalog** | **P1** | P6 | 🟢 | Grade-banded |
| **Teacher curriculum tree / lessons** | **P5** | P2 | 🟢 | Lesson builder |
| **`resource_context_id` slicing** | **P2** | P1, P3 | 🟢 | On lesson create |
| **Classroom-first launch** | **P3** | P1 | 🟡 | Mock QA ready; OAuth env pending |

### Phase 2 — Cross-curricular

| Feature | Primary | Also | Delivery | Notes |
| :--- | :---: | :---: | :---: | :--- |
| Math multi-step latency tracker | **P4** | P2, P6 | 🔴 | Subject-agnostic prose path first |
| Science lab / CER milestones | **P2** | P6 | 🟢 | Via Milestone Gate templates |
| Parent dashboard (Resilience / Friction) | **P5** | P3, P6 | 🟢 | Digest API + SPA dashboard |
| Subject-specific model routing | **P2** | P1 | 🟡 | Allowance + domain tags |
| Teacher friction heat map | **P5** | P6 | 🟢 | Classroom Board + catalog recommend |
| Google Workspace add-on | **P4** | P5, P6 | 🟡 | Needs Apps Script deploy soak |
| Microsoft 365 add-in | **P4** | P5, P6 | 🟡 | Disclosure + telemetry |
| Active session focus monitor | **P4** | P6 | 🟢 | Sidebar / task pane |
| Embedded research portal | **P5** | P4, P6 | 🟡 | Docs sidebar iframe |
| Citation Hall Engine | **P6** | P4 | 🟢 | Pure classify + route trust list |
| Trusted research domain registry | **P6** | P1 | 🟢 | Defaults + `EDUCATION_TRUSTED_DOMAINS` |
| Degraded telemetry modes | **P4** | P6 | 🟢 | CELL_MUTATION / FOCUS_DURATION |

### Phase 3 — Scale & compliance

| Feature | Primary | Also | Delivery | Notes |
| :--- | :---: | :---: | :---: | :--- |
| K–3 print worksheets hub | **P6** | P4, P3 | 🔴 | |
| Gamified practice from error log | **P5** | P6 | 🔴 | |
| Admin legal governance dashboard | **P1** | P3 | 🟡 | Snapshot + trusted domains |
| Universal admin settings | **P5** | P1 | 🔴 | |
| Dual-model cohort analytics | **P2** | P6 | 🔴 | |
| State laboratory launch | **P1** | P3 | 🔴 | |
| Friction-gap recommendation engine | **P6** | P1 | 🟢 | Board + catalog annotate |
| Reading dependency trigger | **P2** | P4, P5 | 🟢 | Policy + sandbox demowire |
| Socratic boundary sync (RAG slice) | **P6** | P2 | 🟡 | Filter wired in tutor controller |

---

## 4. Pillar delivery checklist (Syntax Education)

Use this with [`syntax_education_pillars.md`](./technical-specs/syntax_education_pillars.md) for acceptance criteria.

| Pillar | Education capability | Phase | Delivery |
| :--- | :--- | :---: | :---: |
| **P1** | AI Allowance Regulator + Utah S.B. 149 / H.B. 273 HALT | 1 | 🟢 |
| **P1** | Admin legal governance dashboard | 3 | 🟡 |
| **P2** | Structural milestone gates (CER / outline / explain) | 1 | 🟢 |
| **P2** | Math / science step gates (equation IDE) | 2 | 🔴 |
| **P2** | Socratic tutor CONVERGE (anti-answer prompts) | 1 | 🟡 |
| **P3** | Canvas LTI 1.3 + role matrix | 1 | 🟡 |
| **P3** | De-identified tokens for analytics | 1–2 | 🟢 |
| **P3** | Platform login + `syncPlatformEntitlement` (education) | 1 | 🟡 |
| **P3** | Google Classroom-first launch | 1 | 🟡 |
| **P4** | HAL Lite in Docs / add-on path | 1 | 🟢 |
| **P4** | HAL session → effort score pipeline | 1 | 🟡 |
| **P5** | Student workspace + disclosure gate | 1 | 🟢 |
| **P5** | Teacher dashboard / lesson builder / board | 1–2 | 🟢 |
| **P5** | Parent digest shell | 2 | 🟡 |
| **P6** | District curriculum ingest + layout tree | 1 | 🟢 |
| **P6** | Mistake hall + strength-based tutor memory | 1–2 | 🟡 |
| **P6** | Human Effort Certificate export | 1 | 🔴 |
| **P4** | External telemetry router (`ecosystem_source` + degraded modes) | 2 | 🟢 |
| **P4 / P5** | Google Workspace add-on (Docs / Sheets / Slides) | 2 | 🟡 |
| **P4 / P5** | Microsoft 365 add-in (Word / Excel / PowerPoint) | 2 | 🟡 |
| **P4** | Active session focus monitor | 2 | 🟢 |
| **P5 / P6** | Embedded research portal + reading-time tracker | 2–3 | 🟡 |
| **P6** | Citation Hall Engine | 2–3 | 🟡 |

---

## 5. Remaining build order (to close Phase 1 live)

1. Apply education migrations through `20260713210000_education_classroom_effort_cert.sql` on target Supabase.
2. Enable local QA: `EDUCATION_DEMO_BOOTSTRAP=1`, `EDUCATION_OPEN_LESSON_API=1` → prove `/demo` loop (+ Vault seed).
3. Configure `GOOGLE_CLASSROOM_*` and smoke real OAuth start/callback.
4. Soak Docs E2E via [`DOCS_E2E_CHECKLIST.md`](./DOCS_E2E_CHECKLIST.md).
5. Validate Canvas AGS passback in a Canvas staging course (after Classroom stub).
6. `bootstrapTenantBrain` probe for `syntax_education` in staging.

---

## 6. Reuse from monorepo (do not fork guardrails)

| Need | Reuse |
| :--- | :--- |
| HAL capture patterns | `apps/author-ecosystem/extension/` → education add-ons (lite vector) |
| Entitlement / profile | `MSGF.syncPlatformEntitlement` in `packages/msgf/lib/msgf-onboarding.ts` |
| RAG / compiler ingest | `packages/msgf/lib/services/document-compiler/` + education ingest |
| Tutor / consensus | `packages/msgf/lib/education/socratic-tutor-*` + Pulse |
| Pillar baseline | `bootstrapTenantBrain(admin, 'syntax_education', entityId)` |
| UI primitives | `@elphie-syntax/ui` education kit |

---

## 7. Alignment corrections (masterdoc ↔ MSGF SSOT)

| Topic | Informal / draft wording | Correct MSGF pillar |
| :--- | :--- | :--- |
| "The Call" ingestion | Sometimes grouped with P6 HAL Score | **P4** telemetry; **P6** stores derived score & error taxonomy |
| HAL charter file `.msgf/P1_HAL.md` | Filename says P1 | **P4** extension charter (see SSOT §3) |
| Static Ledger vs. Utah law | Education P1 description | Matches MSGF **P1 Static Ledger** ✅ |
| Entity / SSO / Canvas / Classroom | Education P3 | Matches MSGF **P3 Entity Profiles** ✅ |
| Redis hot session | Education P4 | Matches MSGF **P4 State Ledger** ✅ |
| Editor fonts / HUD | Education P5 | Matches MSGF **P5 Local Variables** ✅ |
| Genealogical tree / Hall | Education P6 | Matches MSGF **P6 Constraint Ledger** ✅ |

---

## 8. Success metrics (Phase 1 exit)

- [x] Pure E2E scenario tests green (`npm run test:education` in `packages/msgf`)
- [x] Code path: admin grade-tagged book → teacher lesson slice + milestone template
- [x] Code path: Utah disclosure gate before HAL Lite / tutor / milestones
- [x] Code path: Milestone Gate + Turn-In Lockout + Teacher Classroom Board
- [x] QA: `/demo` bootstrap + mock Classroom launch
- [x] Platform Education tab no longer Coming Soon for entitled personas
- [x] Human Effort certificate Classroom stub on submit (`classroom_stub`)
- [x] Demo Vault strength seeded for Socratic strength→friction bridge
- [ ] Live district DB: migrations through `20260713210000` + demo bootstrap succeeds
- [ ] Live Docs add-on: disclosure → HAL → paste flag → turn-in (+ cert id)
- [ ] Tutor uses ≥1 Vault strength against friction in a live LMS session
- [ ] Real Google Classroom OAuth launch (client credentials configured)
- [ ] Canvas LTI secondary smoke path validated
- [ ] Human Effort certificate reaches Canvas AGS / SpeedGrader
- [ ] `tenant_education` passes `bootstrapTenantBrain` / pillar baseline probe

---

## Changelog

| Date | Change |
| :--- | :--- |
| 2026-07-13 | **Offline ~80% package:** parent Resilience/Friction; reading-gate wire; friction→catalog; Citation Hall + trusted domains; full roadmap ~78% |
| 2026-07-13 | **~80% Phase 1 push:** Education auth ungated; Classroom effort cert stub; Vault demo seed; Docs E2E checklist; score → ~82% / ~65% full |
| 2026-07-13 | **Completion audit:** Phase 1 ~73%, full roadmap ~60%; pillar checklist refreshed; test-ready / demo / Utah / Classroom mock called out |
| 2026-07-13 | Classroom-first + Docs host; Author→Edu HAL Lite / Milestone / Turn-In / Classroom Board; assignment instances; demo bootstrap |
| 2026-05-18 | Initial roadmap; feature–pillar matrix; HAL on P4 per MSGF SSOT |
| 2026-05-18 | Phase 2/3 expansion: Google Workspace add-on, MS 365 add-in, focus monitor, embedded research portal, Citation Hall Engine |
| 2026-05-18 | Phase 2/3 expansion: admin curriculum catalog + recommendation engine, teacher slicing widget, Socratic boundary sync, reading dependency trigger |
