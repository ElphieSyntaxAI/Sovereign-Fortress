# Elphie Syntax LLC — Stateful Logic Architecture

## Behavioral specification: MSGF 6-pillar system (Syntax Education)

**System classification:** Cursor project context — behavioral framework (rules & gates)  
**Features & phases:** [`syntax_education_masterdoc.md`](./syntax_education_masterdoc.md)  
**Delivery tracker:** [`ROADMAP.md`](./ROADMAP.md)  
**Engineering pillar numbers:** [`../MSGF_PILLAR_MAPPING_SSOT.md`](../MSGF_PILLAR_MAPPING_SSOT.md) — **master-spec P1–P6 win** over education-only nicknames.

---

## 1. Architectural flow (education overlay on MSGF)

```
                    ┌───────────────────────────────────────┐
                    │         P1: STATIC LEDGER             │
                    │   (Utah law & admin rules gate)       │
                    └───────────────────┬───────────────────┘
                                        │
                                        ▼
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                              THE CORE ROUTING AXIS                                        │
├───────────────────────────────┬───────────────────────────────┬───────────────────────────┤
│       P2: FLOW SEQUENCE       │       P3: ENTITY PROFILE      │     P4: STATE LEDGER      │
│     (assignment milestones)   │     (SSO / roles / privacy)   │  ("The Call" + hot Redis) │
└───────────────────────────────┴───────────────────────────────┴───────────────────────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    │         P5: LOCAL VARIABLES             │
                    │   (editor UI, fonts, live HUD state)    │
                    └───────────────────┬───────────────────┘
                                        ▼
                    ┌───────────────────────────────────────┐
                    │      P6: CONSTRAINT LEDGER              │
                    │  (HAL score index, mistake hall 1.1.1)  │
                    └───────────────────────────────────────┘
```

**V3.2 directive overlay (runtime):** SWEEP → SHARD (P4 hot) → DEFEND (P1 shadow) → CROSS-REF (P6) → CONVERGE (P2 tutor pulse) → PERSIST (Vault/Hall).

---

## 2. Six-pillar core mapping (Syntax Education)

### P1 — Static Ledger (global configuration & hard rules)

| MSGF role | Education operational role |
| :--- | :--- |
| Immutable policy anchor | **Two-Dimensional Control Schema** — `grade_cohort` (Layer A toolbox) × `ai_allowance_level` (Layer B LLM boundary) |
| Legal HALT | **Utah S.B. 149** disclosure gate; **H.B. 273** — no auto-grade / IEP mutation without teacher sign-off |
| Gatekeeper | Block-paste extensions, grading-script tampering → `HALT` + admin notify |

#### 2.1.2 Layered workspace control schema

The workspace configuration is resolved by processing two **independent** parameters: the student’s permanent **`grade_cohort`** (physical environment tooling) and the teacher’s active **`ai_allowance_level`** on the assignment (LLM prompt scaffolding boundaries). Neither parameter overrides the other.

| Dimension | Source | Governs | Pillar touch |
| :--- | :--- | :--- | :---: |
| **Layer A** | `grade_cohort` on privacy-gated student token (P3) | Frontend toolbox assets (calculators, manipulatives, IDE) | P5 UI |
| **Layer B** | `ai_allowance_level` on assignment (teacher config) | Whether / how the Socratic sidebar and CONVERGE run | P1 + P2 |

```
                    ┌─────────────────────────────────────┐
                    │  P1: grade_cohort  +  ai_allowance  │
                    │         (resolved at gate)          │
                    └──────────────┬──────────────────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              ▼                                         ▼
     ┌─────────────────┐                    ┌─────────────────┐
     │  Layer A (P5)   │                    │  Layer B (P1/P2) │
     │  Grade toolbox  │                    │  LLM boundaries  │
     └─────────────────┘                    └─────────────────┘
```

##### Layer A: The permanent grade-appropriate toolbox

The frontend checks the student’s de-identified token (`grade_cohort`) and injects the matching environmental assets **regardless of AI allowance level**:

| `grade_cohort` | Toolbox assets (non-exhaustive) |
| :--- | :--- |
| **K–3** | Local audio dictionary, visual interactive number lines, virtual fraction blocks, oral read-along speech diagnostics |
| **4–6** | Four-function calculator, interactive visual ruler, spelling / synonym popups |
| **7–9** | Scientific calculator, unit converters (metric / imperial), coordinate graphing grid |
| **10–12** | Graphing calculator (Desmos API sandbox), periodic table, universal formula sheets |
| **12+** | Full IDE developer-tools sandbox, advanced financial / statistical calculation packages |

> Layer A is always available when the assignment permits the workspace (even at AI Level 0). Level 1 explicitly routes students to Layer A only.

##### Layer B: The teacher’s AI allowance regulator

The LLM orchestration engine reads the assignment’s active `ai_allowance_level` to set the system-prompt boundary (see `p1-static-ledger.ts`, Socratic tutor CONVERGE):

| Level | Name | Behavior |
| :---: | :--- | :--- |
| **0** | Absolute Zero | AI chat sidebar **disabled**. **The Call** telemetry streams only to verify human writing authorship (P4 → P6 HAL index). |
| **1** | Resource Gate | AI conversation **locked**. Student may use **Layer A** toolbox features only. |
| **2** | Scaffold Engine | AI may provide outline formats, structural blueprints, or **empty** data tables. **No** prose generation or formula calculations. |
| **3** | Socratic Dialogue | Strength-based tutoring enabled. AI parses the draft and asks diagnostic, open-ended questions via the **1.1.1** error tree. **No** direct answers, solutions, or pre-written sentences (P1 hard rule). |
| **4** | Open Sandbox | Full interactive co-writing / co-calculating enabled, **heavily logged** (P4 + P6). Requires explicit teacher unlock per assignment; still subject to Utah **S.B. 149** disclosure and **H.B. 273** (no auto-grade or IEP mutation without teacher sign-off). |

**Resolution rule:** At runtime, `effective_workspace = layer_a(grade_cohort) ∩ layer_b(ai_allowance_level)`. Example: a grade 7 student on Level 2 receives scientific-calculator tooling (Layer A) but only structural scaffolds from the tutor (Layer B).

**Code anchors (shared):** `packages/msgf/lib/msgf-legal.ts`, `packages/msgf/lib/education/p1-static-ledger.ts`, `packages/msgf/lib/education/socratic-tutor-prompt.ts`, assignment policy rows (future `education_assignments`), P5 sandbox HUD.

#### 2.1.4 Pillar 1 system update: content governance invariants

The Approved Materials Pipeline (masterdoc §4) introduces durable inventory rows that must obey the same legal-HALT discipline as the rest of P1.

- **The Cross-Tenant Guardrail.** Material records approved in P1 are explicitly bound to the `district_tenant_id`. **No entity** outside the validated administrative permission tree can mutate or delete core inventory configurations. Enforced via Postgres RLS on `education_district_curriculum_catalog` (admin role + tenant match) and a server-side `assertAdminForCatalogMutation()` check on every controller mutation.
- **Persistence boundary.** Catalog rows live in `education_district_curriculum_catalog`; per-assignment slices live in `education_assignment_resources`. P1 owns the catalog row; **P2** owns the slice row. Deleting a catalog row HALTs if any active `assignment_resources` reference it (FK + custom error code `EDU_CATALOG_IN_USE`).
- **Tokenized deep-link signing.** External publisher deep-links are signed with `EDUCATION_PRIVACY_GATE_SECRET` (P3) so the student-side iframe URL cannot be reused outside the issued assignment / session window.

**Code anchors:** `packages/msgf/lib/education/curriculum-catalog.ts`, `packages/msgf/lib/education/assignment-resources.ts`, RLS in `20260518220000_education_curriculum_catalog.sql`.

---

### P2 — Flow Sequence (deployment roadmap & milestone gates)

| MSGF role | Education operational role |
| :--- | :--- |
| State machine / gate orchestration | Sequential instructional locks |
| ELA/History | Outline → Hook → Argument → Evidence → Draft reflection |
| Mathematics | Problem → Variable map → Operations → Proof verification |
| Gatekeeper | Tutor evaluation **blocked** until P2 prerequisites satisfied |

**Code anchors:** Assignment `flow_state` in education schema (future); Pulse ordering in `PulseEngine` when tutor invokes MSGF.

#### 2.2.1 Pillar 2 system update: material milestone gates

The Approved Materials Pipeline (masterdoc §4) adds a new milestone class — *reading dependency* — that the P2 state machine must enforce before the sandbox unlocks composition / lab tooling.

- **The Reading Dependency Trigger.** If the teacher checks "Require focused reading" when slicing the resource, P2 enforces an **un-skippable reading timer milestone**. The workspace prevents a student from unlocking the active text-entry box (ELA / History) or the lab calculations matrix (Math / Science) until the **P4 telemetry** logs show a verified focus block on the embedded reading link asset.
- **Verification signal.** "Verified focus block" = a `state_beats` window of contiguous `focus_resume` → no `focus_pause` for ≥ `min_focus_block_ms` (default **120 000 ms / 2 min**) while the embedded reader pane is the active surface. Driven by `focusEvents[]` ingested via the §2.4.1 router and tagged with `pillar_extension = "P2_READING_GATE"`.
- **Unlock contract.** When the threshold is met, the controller emits a `reading_gate_satisfied` beat (label `reading_gate_satisfied`, metadata `{ resource_context_id, focus_block_ms }`) which the P5 sandbox observes to enable the editor. Until then the editor renders read-only with a sidebar prompt: *"Read the assigned pages before composing."*

| Gate | Owns | Code anchor |
| :--- | :--- | :--- |
| Outline / Hook (ELA) | P2 | future `flow_state` machine |
| Reading dependency | **P2 + P4** | `packages/msgf/lib/education/reading-gate.ts`, `state_beats(label='reading_gate_satisfied')` |
| Variable map (Math) | P2 | future |
| Hypothesis (Science) | P2 | future |

> **Privacy:** Focus beats carry only de-identified `entity_id`; the embedded reader URL is signed and short-TTL so a focus session cannot be replayed off-platform.

**Code anchors:** `packages/msgf/lib/education/reading-gate.ts`, `packages/msgf/lib/services/p4-state-ledger-controller.ts` (focus beat emission), `packages/msgf/app/api/msgf/education/teacher/assignment-resources/route.ts` (`requireReadingBlock` flag).

---

### P3 — Entity Profiles (roles, permissions, privacy vault)

| MSGF role | Education operational role |
| :--- | :--- |
| Multi-tenant ACL | Canvas LTI 1.3 → roles: District Super-Admin, Teacher, Student, Parent (read-only analytics) |
| Privacy vault | De-identification: real names → `Student_Gamma_888` tokens before analytics export |
| Platform login personas | Student, Teacher, Administration/IT (see `platform-persona-auth` education map) |

**Code anchors:** `p4_profiles` + `user_metadata.tenant_id` = `syntax_education`; RLS via `tenant_education` manifest.

---

### P4 — State Ledger ("The Call" hot layer + session beats)

| MSGF role | Education operational role |
| :--- | :--- |
| Flight recorder | **The Call** — every $D_{down}$ / $I_{flight}$ → Redis hot slice |
| Session context | Active paragraph, equation line, or chart coordinate cached for tutor loops |
| HAL telemetry | **Canonical MSGF home for keystroke biometrics** (not P1, not P6) |
| External telemetry router | Tag transactions with `ecosystem_source` (`SANDBOX_NATIVE`, `GOOGLE_EDIT`, `MS_OFFICE_EDIT`) — see §2.4.1 |

**Code anchors:** `packages/msgf/lib/msgf-hot-layer.ts`, `packages/msgf/lib/education/the-call-telemetry.ts`, `p4_hal_ledger`, `src/lib/universal/p1HalStandard.ts` (legacy filename), browser extension / sandbox hooks.

> **Correction vs. informal docs:** "The Call" ingests at **P4**. P6 stores derived scores and error lineage, not raw key events.

#### 2.4.1 Pillar 4 extension: external telemetry routing

When data arrives from an external application (e.g. Google Sheets, PowerPoint), the P4 ingestion router tags the transaction with an `ecosystem_source` string flag so cohort dashboards can segment authenticity per host environment:

| `ecosystem_source` | Origin | Host API |
| :--- | :--- | :--- |
| `SANDBOX_NATIVE` | Native composition sandbox | Web `KeyboardEvent` |
| `GOOGLE_EDIT` | Docs / Sheets / Slides add-on | Apps Script `onEdit()` / `onChange()` + HTML sidebar |
| `MS_OFFICE_EDIT` | Word / Excel / PowerPoint add-in | Office.js `Office.context.document.addHandlerAsync` |

**Keystroke optimization (sandboxed hosts).** Where true key-up / key-down microsecond latency is restricted by host API sandboxes (e.g. Google Sheets cells), the router degrades smoothly to surrogate signals that still produce a Human Effort Score:

- **Cell-Mutation Velocity** — per-cell mutation count / Δt, with paste vs. mutation discrimination.
- **Focus Duration Intervals** — `document.visibilityState` and add-in `taskpane`/`dialog` focus dwell.

Both surrogates carry the same `ecosystem_source` tag plus a `telemetry_mode` flag (`KEYSTROKE` | `CELL_MUTATION` | `FOCUS_DURATION`) so P6 can normalize cross-host comparisons before persisting to the HAL score index.

**Code anchors:** `packages/msgf/lib/education/the-call-telemetry.ts` (add `ecosystem_source`, `telemetry_mode`), `lib/services/p4-state-ledger-controller.ts`, future `apps/syntax-educates/addons/{google,office}/`.

---

### P5 — Local Variables (site-specific module data)

| MSGF role | Education operational role |
| :--- | :--- |
| Ephemeral UI state | Cursor, dictionary popup, OpenDyslexic font, spoiler HUD for tutor |
| Low-stakes games | Live puzzle score profiles without Postgres round-trips |
| Tenant manifest | `tenant_education` whitelist paths in `tenant-manifest.json` |

**Code anchors:** `packages/msgf/config/tenant-manifest.json`, dashboard/sandbox React state, Redis-adjacent session prefs (non-persistent).

---

### P6 — Constraint Ledger (compliance & error history)

| MSGF role | Education operational role |
| :--- | :--- |
| Vault / Hall | Successful tutor shards vs. policy violations / hallucinations |
| 1.1.1 genealogical tree | e.g. `1.0 Math → 1.2 Fractions → 1.2.1 Inverse sign error` |
| HAL score index | **Derived** authenticity metrics from P4 telemetry (paste gaps, effort score) |
| Socratic memory | Ongoing weakness tags for strength-based hints |
| Research / citation hall | External research provenance + citation gap alerts (see §2.6.1) |

**Code anchors:** `constraint-ledger.ts`, `pillar_vectors`, `IngestService`, curriculum PDF shard ingest.

#### 2.6.1 Pillar 6 extension: research mismatch alerts

The **Citation Hall Engine** tracks text blocks imported via the Embedded Research Portal (§3.2). If a student moves research material into a Google Doc, Word doc, or PowerPoint deck **without clicking the sidebar's "Generate Citation Anchor" feature**, the system logs an automatic citation-gap incident onto the genealogical tree.

| Tier | Slug |
| :--- | :--- |
| Category | `3.0_RESEARCH` |
| Branch | `3.1_CITATIONS` |
| Instance | `3.1.2_UNATTRIBUTED_SOURCE_STRING` |

| Trigger | Behavior |
| :--- | :--- |
| Pasted text matches a recent research-portal snippet | Log `Hall` incident at `3.0_RESEARCH → 3.1_CITATIONS → 3.1.2_UNATTRIBUTED_SOURCE_STRING` |
| Snippet matches but anchor exists | Log `Vault` entry under `3.1.1_ANCHORED_SOURCE_STRING` (positive index) |
| Snippet is from non-trusted domain | Add `domain_trust=low` metadata; surfaces in teacher heat map |

**Code anchors:** `packages/msgf/lib/services/constraint-ledger.ts`, `lib/education/learning-breakdown-index.ts` (add `research.*` presets), `lib/schemas/vault-hall-metadata.ts` (genealogical schema relaxation: accept `3.0_*` / `3.1_*` / `3.1.x_*` roots in addition to the legacy `1.x` regex).

> **Schema note:** The current `GenealogicalBugIndexSchema` regex enforces `1.0_` / `1.1_` / `1.1.1_` roots. Supporting `3.0_RESEARCH` requires relaxing the regex to `^\d+\.0[_A-Z0-9]+$` / `^\d+\.\d+[_A-Z0-9]+$` / `^\d+\.\d+\.\d+[_A-Z0-9]+$`. Existing 1.x rows remain valid.

---

## 3. Universal external ecosystem integration

Native add-on wrappers extend the same P4 ingestion + P6 lineage guarantees to documents authored **outside** the standalone composition sandbox. Layer A toolbox visibility (P5) and Layer B AI allowance (P1) still apply — the host editor only changes the telemetry source, never the gates.

### 3.1 Cross-platform add-on matrix

The system deploys native add-on wrappers to securely track student telemetry outside the standalone workspace sandbox.

| Host suite | Hook surface | Telemetry mode | Pillars touched |
| :--- | :--- | :--- | :--- |
| **Google Workspace** (Docs · Sheets · Slides) | Apps Script `onEdit()` / `onChange()` event hooks + client-side HTML service sidebar triggers stream delta inputs | `KEYSTROKE` (Docs) / `CELL_MUTATION` (Sheets) / `FOCUS_DURATION` (Slides) | **P4** ingest · **P5** sidebar UI · **P6** score index |
| **Microsoft 365** (Word · Excel · PowerPoint) | Unified Office.js JavaScript API — `Office.context.document.addHandlerAsync` logs document manipulation and slide arrangement timelines | `KEYSTROKE` (Word) / `CELL_MUTATION` (Excel) / `FOCUS_DURATION` (PowerPoint) | **P4** ingest · **P5** task-pane UI · **P6** score index |

All add-on transactions enter MSGF via the P4 controller with `ecosystem_source` set per §2.4.1; no add-on may write to the Vault/Hall directly.

### 3.2 Research activity & time tracking engine

The workspace add-on is responsible for two compliance-relevant signals that the native sandbox already emits: **active focus** and **research provenance**.

#### Active session focus monitor

- Monitors browser visibility state (`document.hidden`) and application-window blur events.
- Stalls the active-time tracker **instantly** when the student switches away from the assignment environment.
- Resumes only after host focus returns; pauses are written as `state_beats` labels (`label = 'focus_pause'`) so the parent / teacher dashboards can render uninterrupted concentration vs. distraction zones (P5 → P6 rollup).

#### Embedded research portal

Provides an iframe-sandboxed internet search window inside the sidebar / task pane. When active, it tracks:

| Signal | Purpose | Persisted to |
| :--- | :--- | :--- |
| Total reading time per query result | Distinguishes scanning vs. study behavior | P4 → P6 score index |
| Source domain validation logs | Cross-references trusted scholarly source list | P6 (`domain_trust` metadata) |
| Copy-pasting from research windows | Pipes text directly into the **P6 Constraint Ledger** to verify correct citation formatting (Citation Hall Engine, §2.6.1) | P6 Vault (anchored) or Hall (`3.1.2_UNATTRIBUTED_SOURCE_STRING`) |

> **Privacy boundary:** Research portal queries are scoped to the de-identified `entity_id` token (P3); raw query strings are never persisted alongside legal names.

**Code anchors (planned):** `apps/syntax-educates/addons/google/`, `apps/syntax-educates/addons/office/`, `packages/msgf/lib/education/research-portal.ts` (P6 citation gap detector), `lib/education/the-call-telemetry.ts` (focus pause beats).

---

## 4. Cross-pillar education flows

| User action | Pillars touched |
| :--- | :--- |
| Student opens assignment | P3 (role + `grade_cohort`) → P1 (`ai_allowance_level` + Utah disclosure) → P5 (Layer A toolbox) → P2 (first gate) |
| Student types in sandbox | P4 (The Call) → P5 (UI) |
| Student types in Google Doc add-on | P4 (`ecosystem_source=GOOGLE_EDIT`) → P5 (sidebar) → P6 (score index) |
| Student edits Excel cells | P4 (`telemetry_mode=CELL_MUTATION`) → P6 |
| Student tabs away from assignment | P4 (focus pause beat) → P6 (focus duration aggregate) |
| Student pastes research without anchor | P4 (`ecosystem_source` paste) → P6 Hall (`3.1.2_UNATTRIBUTED_SOURCE_STRING`) |
| Student asks tutor | P1 (Layer B ≥ 3) → P2 (gate check) → P4 (context) → P2 CONVERGE → P6 (Vault/Hall) |
| Teacher views heat map | P3 (teacher scope) → P6 aggregates ← P4 telemetry |
| Parent views growth | P3 (parent-only) → de-identified P6/P4 rollups |
| Canvas grade passback | P3 (LTI) → P6 certificate token → external LMS |

---

## 5. Decision rules (agents & PRs)

1. **Keystroke / paste / flight time** → implement and query under **P4**, cite HAL charter (`.msgf/P1_HAL.md` is a *telemetry charter*, not P1 Static Ledger).
2. **Utah law, `ai_allowance_level` (0–4), `grade_cohort` toolbox** → **P1** (Layer B) + **P5** (Layer A); violations must HALT.
3. **Canvas roles, FERPA de-ID** → **P3**; never leak parent view into student draft text.
4. **Milestone locks** → **P2** before tutor CONVERGE.
5. **Curriculum RAG corpus & mistake taxonomy** → **P6** ingest + lineage metadata.
6. **Editor font / HUD / puzzle UI** → **P5** unless it must survive session end (then P4/P6).
7. **External add-on telemetry (Google / Microsoft)** → **P4** ingest with `ecosystem_source` tag; never bypass P1/P2 gates from inside the add-on.
8. **Research portal pastes** → **P6** Citation Hall Engine; missing anchors HALT to `3.1.2_UNATTRIBUTED_SOURCE_STRING`.

---

## Changelog

| Date | Change |
| :--- | :--- |
| 2026-05-18 | Initial SSOT; P4/P6 split for HAL telemetry vs. score index per `MSGF_PILLAR_MAPPING_SSOT.md` |
| 2026-05-18 | P1 §2.1.2 — two-dimensional control schema (`grade_cohort` × `ai_allowance_level` 0–4) replaces legacy L1–L3 matrix |
| 2026-05-18 | Added §3 Universal external ecosystem integration (Google / Microsoft add-ons, focus monitor, research portal); P4 §2.4.1 `ecosystem_source` + degraded telemetry modes; P6 §2.6.1 Citation Hall Engine (`3.0_RESEARCH` root). Renumbered legacy §3 → §4 and §4 → §5. |
| 2026-05-18 | Added §2.1.4 P1 content governance invariants (cross-tenant guardrail, catalog → assignment FK HALT) and §2.2.1 P2 material milestone gates (reading dependency trigger via §2.4.1 focus beats). |
