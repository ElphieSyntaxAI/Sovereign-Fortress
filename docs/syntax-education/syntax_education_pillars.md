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
| Immutable policy anchor | **AI Allowance Regulator** per assignment (L1 dictionary-only · L2 Socratic outline · L3 forbidden) |
| Legal HALT | **Utah S.B. 149** disclosure gate; **H.B. 273** — no auto-grade / IEP mutation without teacher sign-off |
| Gatekeeper | Block-paste extensions, grading-script tampering → `HALT` + admin notify |

**Code anchors (shared):** `packages/msgf/lib/msgf-legal.ts`, `brain-readiness` P1 baseline, education policy rows in tenant config (P5).

---

### P2 — Flow Sequence (deployment roadmap & milestone gates)

| MSGF role | Education operational role |
| :--- | :--- |
| State machine / gate orchestration | Sequential instructional locks |
| ELA/History | Outline → Hook → Argument → Evidence → Draft reflection |
| Mathematics | Problem → Variable map → Operations → Proof verification |
| Gatekeeper | Tutor evaluation **blocked** until P2 prerequisites satisfied |

**Code anchors:** Assignment `flow_state` in education schema (future); Pulse ordering in `PulseEngine` when tutor invokes MSGF.

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

**Code anchors:** `packages/msgf/lib/msgf-hot-layer.ts`, `p4_hal_ledger`, `src/lib/universal/p1HalStandard.ts` (legacy filename), browser extension / sandbox hooks.

> **Correction vs. informal docs:** "The Call" ingests at **P4**. P6 stores derived scores and error lineage, not raw key events.

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

**Code anchors:** `constraint-ledger.ts`, `pillar_vectors`, `IngestService`, curriculum PDF shard ingest.

---

## 3. Cross-pillar education flows

| User action | Pillars touched |
| :--- | :--- |
| Student opens assignment | P3 (role) → P1 (AI level + Utah disclosure) → P2 (first gate) |
| Student types in sandbox | P4 (The Call) → P5 (UI) |
| Student asks tutor | P2 (gate check) → P4 (context) → P2 CONVERGE → P6 (Vault/Hall) |
| Teacher views heat map | P3 (teacher scope) → P6 aggregates ← P4 telemetry |
| Parent views growth | P3 (parent-only) → de-identified P6/P4 rollups |
| Canvas grade passback | P3 (LTI) → P6 certificate token → external LMS |

---

## 4. Decision rules (agents & PRs)

1. **Keystroke / paste / flight time** → implement and query under **P4**, cite HAL charter (`.msgf/P1_HAL.md` is a *telemetry charter*, not P1 Static Ledger).
2. **Utah law, AI tier, auto-grade ban** → **P1** only; violations must HALT.
3. **Canvas roles, FERPA de-ID** → **P3**; never leak parent view into student draft text.
4. **Milestone locks** → **P2** before tutor CONVERGE.
5. **Curriculum RAG corpus & mistake taxonomy** → **P6** ingest + lineage metadata.
6. **Editor font / HUD / puzzle UI** → **P5** unless it must survive session end (then P4/P6).

---

## Changelog

| Date | Change |
| :--- | :--- |
| 2026-05-18 | Initial SSOT; P4/P6 split for HAL telemetry vs. score index per `MSGF_PILLAR_MAPPING_SSOT.md` |
