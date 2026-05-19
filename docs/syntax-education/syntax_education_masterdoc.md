# Elphie Syntax LLC — Stateful Logic Architecture

## Product specification: Cross-curricular Syntax Education Engine

**System classification:** Cursor project context — master design artifact (features & phases)  
**Tenant silo:** `tenant_education` · operational id `syntax_education` (see `packages/msgf/config/tenant-manifest.json`)  
**Production URL (target):** https://syntaxeducates.elphiesyntax.com  
**Repo home (today):** `apps/syntax-educates/`  
**Shared engine:** MSGF (`packages/msgf/`) — do not reimplement guardrails in the education app alone.

**Companion (behavioral rules):** [`syntax_education_pillars.md`](./syntax_education_pillars.md)  
**Delivery tracker:** [`ROADMAP.md`](./ROADMAP.md)  
**Platform pillar SSOT:** [`../MSGF_PILLAR_MAPPING_SSOT.md`](../MSGF_PILLAR_MAPPING_SSOT.md)

---

## 1. Strategic ecosystem roadmap (compliance-aligned era)

This roadmap outlines the structural implementation plan for deploying the state-gate educational system. Implementation focuses on architectural construction blocks that map to MSGF P1–P6 (not ad-hoc feature silos).

```
[ PHASE 1: THE CORE (MVP) ] ──► [ PHASE 2: CROSS-CURRICULAR ] ──► [ PHASE 3: COMPREHENSIVE SCALE ]
```

| Phase 1 (MVP) | Phase 2 | Phase 3 |
| :--- | :--- | :--- |
| "The Call" hook integration | Math multi-step tracking | K–3 print worksheets hub |
| ELA / History sandbox | Science lab report RAG | Advanced interactive games |
| Basic Socratic Tutor RAG | Subject-specific models | Universal admin settings |
| Canvas LTI 1.3 handshake | Parent dashboard live | State laboratory launch |

---

## 2. Phase specifications

### Phase 1: The Core MVP

- **Engineering target:** Native key-up/key-down telemetry hook (**"The Call"**) in the composition sandbox workspace.
- **Domain focus:** Middle school (grades 6–8) English/Language Arts (ELA) and History descriptive compositions.
- **Feature set:**
  - **The Socratic Sandbox:** Dual-pane layout — left: multi-modal editing workspace; right: Socratic Tutor terminal.
  - **Static context RAG:** Context window isolated to district-uploaded curriculum (single chapter/workbook PDF) sharded into the **1.1.1 genealogical tree** (MSGF P6 cold layer).
  - **The Baseline HAL Ledger:** Captures typing intervals ($D_{down}$, $I_{flight}$) → Human Effort Score; defends against block-pasting.
  - **Canvas LTI 1.3 handshake:** SSO and gradebook payload delivery to SpeedGrader.

### Phase 2: Cross-curricular expansion

- **Engineering target:** Adapt "The Call" for step-by-step math syntax and STEM variable entry.
- **Domain focus:** Mathematics (Pre-Algebra, Algebra 1, Geometry) and laboratory/general sciences.
- **Feature set:**
  - **Math multi-step latency tracker:** Execution delay patterns between equation lines.
  - **Science method compliance module:** Observational notes vs. lab conclusions consistency.
  - **Parent dashboard live:** Resilience Score and Friction Zones visualizations.

### Phase 3: Comprehensive scale & deep compliance

- **Engineering target:** Multi-model consensus auditing for cross-classroom analytics and UDL.
- **Domain focus:** K–12 district scale, IEP accommodations, state/district governance.
- **Feature set:**
  - **K–3 parental print hub (Utah H.B. 273):** Offline phonics/math/tactile packs from telemetry (zero-screen mandate).
  - **Gamified low-stakes practice paths:** Procedural adventures from error-log index.
  - **Admin legal governance dashboard:** Global AI usage caps, FERPA/COPPA overrides.

---

## 3. Functional specifications master document

### 3.1 Human Authorship Ledger (HAL) & authenticity engine

| Capability | Description |
| :--- | :--- |
| Biometric ingestion | "The Call" — $D_{down}$, $I_{flight}$ per keypress → cognitive baseline |
| External injection defense | Multi-character insertions without matching key events → flagged |
| Human Effort Certificate | Cryptographic authenticity token to Canvas SpeedGrader |

> **MSGF mapping:** HAL **telemetry** = **P4 State Ledger**; legal HALT on pledge = **P1**. See SSOT §2.1.

### 3.2 Socratic Tutor Assistant

| Capability | Description |
| :--- | :--- |
| Anti-cheating protocol | No direct answers, code, or finished sentences |
| Strength-based scaffolding | Historical performance → weakness tutoring via strengths |
| Context-isolated curriculum RAG | District workbooks only — no out-of-corpus hallucination |

> **MSGF mapping:** Tutor routing = **P2 CONVERGE** + **P6 Vault/Hall**; corpus = **P6** ingest/shard.

### 3.3 Cross-curricular adaptability

| Capability | Description |
| :--- | :--- |
| Algebra step monitor | Cadence per math step; paste vs. natural delay |
| Scientific logic validation | Lab report structural flow |
| Local literacy suite | In-editor dictionary/thesaurus (low token overhead) |

> **MSGF mapping:** Subject modules = **P5** UI/config shards; persistence = **P4** + **P6**.

### 3.4 Parent & teacher insight dashboards

| Capability | Description |
| :--- | :--- |
| Cognitive friction heat map | Paragraph / operation / concept blockages |
| Resilience & acceleration index | Mistake history contraction over time |
| Cohort analysis trends | Dual-model emergent failure alerts |

> **MSGF mapping:** Aggregates from **P4** + **P6**; role visibility = **P3**.

### 3.5 Legal & ethical protections

| Capability | Description |
| :--- | :--- |
| Utah S.B. 149 transparency gate | Upfront AI disclosure before processing |
| Utah H.B. 273 balance framework | No auto-grades / IEP changes without teacher authorization |
| Deidentified cryptographic vault | PII stripped at cache layer → ephemeral tokens |

> **MSGF mapping:** Hard rules = **P1**; de-ID = **P3**; audit trail = **P6**.

### 3.6 Universal external ecosystem integration

Native add-on wrappers extend P4 telemetry and P6 lineage into the document hosts students already use. Behavioral spec lives in [`syntax_education_pillars.md` §3](./syntax_education_pillars.md#3-universal-external-ecosystem-integration); this section captures product surfaces and phase ownership.

| Capability | Description |
| :--- | :--- |
| **Google Workspace add-on** (Docs · Sheets · Slides) | Apps Script `onEdit()` / `onChange()` + HTML service sidebar; ingests as `ecosystem_source=GOOGLE_EDIT` |
| **Microsoft 365 add-in** (Word · Excel · PowerPoint) | Office.js `Office.context.document.addHandlerAsync`; ingests as `ecosystem_source=MS_OFFICE_EDIT` |
| **Active session focus monitor** | `document.hidden` + window-blur events stall the active-time tracker instantly across all hosts |
| **Embedded research portal** | Iframe-sandboxed search inside the sidebar — tracks reading time, validates source domains, and pipes copy-pasted text to the P6 Citation Hall Engine for anchor verification |
| **Degraded telemetry modes** | `KEYSTROKE` (rich) · `CELL_MUTATION` (Sheets / Excel) · `FOCUS_DURATION` (Slides / PowerPoint) — automatically selected per host API capability |
| **Citation Hall Engine** | Pasted research without a Generate Citation Anchor click → logged to `3.0_RESEARCH → 3.1_CITATIONS → 3.1.2_UNATTRIBUTED_SOURCE_STRING` |

> **MSGF mapping:** External telemetry router = **P4** (§2.4.1); add-on UI surfaces = **P5**; citation anchors & research provenance = **P6** (§2.6.1); Layer A/B gates from **P1** still apply.

> **Phase ownership:** Google Workspace add-on and Office.js add-in target **Phase 2**; Embedded Research Portal + Citation Hall Engine target **Phase 2 → Phase 3** alongside the parent dashboard.

---

## 4. Approved materials pipeline & curriculum sharding

The platform's RAG corpus is **never** a free-form internet crawl. Every shard that feeds the Socratic Tutor traces back to an admin-approved title, sliced down to a teacher-specified page range, and bound to an assignment via a `resource_context_id`.

```
[ ADMIN PORTAL ]               [ TEACHER DASHBOARD ]                  [ STUDENT SANDBOX ]
  ├─ Ingest manifests             ├─ Browse approved catalog              ├─ Embedded reader pane
  ├─ ISBN / Pearson / McGraw       ├─ Curriculum tree picker               │   (iframe to chopped pages)
  ├─ LTI handshake tokens          │   (Unit ➔ Chapter ➔ Section)          ├─ Composition sandbox
  ├─ Friction-gap recommender      ├─ Generate `resource_context_id`       └─ Socratic Tutor
  └─ Saves to P1 inventory         └─ Saves to P2 flow_sequence                (RAG locked to resource_context_id)
```

### 4.1 Admin ingestion & recommendation engine

- **The Master Inventory Vault.** District super-admins can upload local curriculum files (PDF / EPUB) **or** provision active access keys to external major publishers via automated textbook APIs — Clever, ClassLink, EdTech LTI 1.3 handshakes (Pearson, McGraw-Hill, Houghton Mifflin Harcourt).
- **AI recommendation engine.** Evaluates historical district failure metrics stored inside the P6 Constraint Ledger's 1.1.1 genealogical tree. It scans the incoming library catalog to **automatically flag** specific textbook chapters, visual aids, or lesson modules designed to fix the district's active cognitive friction gaps. Output is rendered as a "Recommended for Active Friction Blocks" badge on the admin catalog grid.

> **MSGF mapping:** Catalog persistence = **P1** (cross-tenant guardrail §2.1.4); recommendation telemetry = **P6** rollup over `pillar_vectors`.

### 4.2 Teacher material slicing engine (the Scoping Widget)

- **Granular extraction protocol.** When creating an assignment, teachers select a title from the admin-approved vault. The UI generates a structural tree (Units ➔ Chapters ➔ Sections ➔ Page Arrays) from the title's stored layout JSON.
- **Context isolation.** The teacher selects specific blocks (e.g. *Chapter 4, Section 2 only*). The platform mints an explicit, isolated document reference pointer — a `resource_context_id` — and writes it into the `education_assignment_resources` junction with the chosen Unit / Chapter / Section / page bounds.
- **Deep linking injection.** Generates a secure tokenized external link asset (publisher deep link or signed Supabase Storage URL) alongside an embedded rendering container frame inside the student's view.

> **MSGF mapping:** Slicing surface = **P5** UI; assignment binding = **P2** flow sequence; tokenized link signing = **P3** privacy gate secret.

### 4.3 Student resource distribution layer

- **The Unified Workspace Canvas.** Students open their assignment to find the exact pages chosen by the teacher pre-loaded into their viewport, alongside the existing Layer A toolbox (§2.1.2) and the Layer B Socratic Tutor pane.
- **The Socratic Boundary Sync.** The Socratic Tutor Assistant reads the `resource_context_id` payload on every ask. It programmatically locks its vector RAG queries *only* to the embedding shards tagged with that `resource_context_id` — preventing the AI from fetching answers from future unassigned chapters or other approved titles.

> **MSGF mapping:** Reader pane = **P5**; RAG scope filter = **P6** match RPC; boundary enforcement asserted in `socratic-tutor-controller`.

---

## 5. Out of scope for this document

- Pillar gate behavior, HALT conditions, and Redis/Postgres split → **`syntax_education_pillars.md`**
- Sprint tasks, repo paths, and delivery status → **`ROADMAP.md`**
- Author Ecosystem or MSGF Gated AI product specs → see `docs/AUTHOR_ECOSYSTEM_ROADMAP.md`, `docs/MSGF_V1_ROADMAP.md`

---

## Changelog

| Date | Change |
| :--- | :--- |
| 2026-05-18 | Initial monorepo SSOT; aligned HAL to MSGF P4 per `MSGF_PILLAR_MAPPING_SSOT.md` |
| 2026-05-18 | Added §3.6 universal external ecosystem integration (Google Workspace add-on, MS 365 add-in, focus monitor, embedded research portal, Citation Hall Engine); cross-references pillars §3 / §2.4.1 / §2.6.1 |
| 2026-05-18 | Added §4 Approved materials pipeline (admin ingestion + recommendation engine, teacher slicing widget, student resource distribution); renumbered legacy §4 Out of scope → §5; cross-references pillars §2.1.4 + §2.2.1 |
