# P4 Telemetry Extension — HAL (Human Authorship Ledger)  
**MSGF v3.2 · Human input rhythm layer (State Ledger scope)**

> **Naming note (read first):** The filename `P1_HAL.md` is **legacy** and does **not** denote V3.0/V3.2 **P1 — Static Ledger** (security constants, init guards, immutable global rules, legal versions that **HALT** on violation). Per the master specifications, that role belongs to **P1 Static Security** — see [`docs/MSGF_PILLAR_MAPPING_SSOT.md`](../../../docs/MSGF_PILLAR_MAPPING_SSOT.md) and `lib/msgf-legal.ts`.
>
> **This file** represents the **P4 Telemetry Extension: Human Authorship Ledger (HAL)**, capturing keystroke dynamics (rhythm, dwell, flight, paste/system-event markers). It is governed operationally under the **State Ledger** infrastructure (`lib/P4.ts`, `p4_hal_ledger`, `state_beats`, hot active slices) and the Author Ecosystem to avoid naming collisions with P1 Static Security.

This charter governs **HAL telemetry only**. It must not define static security rules (engineering **P1**), governance consensus (engineering **P2**), identity stylometry (engineering **P3** / `.msgf/P3_STYLOMETRY.md`), revision lock calendars (`.msgf/P4_REVISION.md`), immutable narrative audit taxonomy (`.msgf/P5_AUDIT.md`), or world-model retrieval (`.msgf/P6_RAG.md`).

---

## 1. Scope

**Active Slices:** nanosecond-scale windows of **behavioral telemetry** (keystroke rhythm, dwell, flight, paste/system-event markers, composition/IME boundaries).

P1 records **how** input arrived, not **what** the text means and not **who** the person is beyond the session-bound rhythm envelope.

---

## 2. Universal definitions (authoritative for P1)

| Term | Definition |
|------|----------------|
| **Rhythm signature** | A lossless-enough statistical fingerprint of inter-event timing and modality flags for a slice. |
| **Biometric Standard** | Mandatory minimum: every gated interaction must yield a **rhythm signature** suitable for downstream pillars to treat as a signal artifact. |
| **Human vs. Non-Human** | Binary classification at the telemetry layer only: organic typing rhythm vs. patterns consistent with paste, macro, or non-human injection—**without** semantic parsing of manuscript content. |

---

## 3. Logic (mandatory behaviors)

1. **Slice integrity:** each Active Slice is timestamp-ordered, bounded, and immutable once sealed for handoff.
2. **Rhythm-first:** scoring, anomaly flags, and “training phase” dampening operate **only** on timing/modality features defined in this pillar.
3. **No content court:** P1 must not invoke LLMs, embeddings, or narrative judges. It emits **telemetry facts** only.
4. **No identity court:** P1 does not answer “is this the correct author?”—only “does this slice look human-produced at the rhythm layer?”

---

## 4. Separation (explicit non-responsibilities)

| Pillar | P1 must never |
|--------|----------------|
| P2 | Enforce consensus, Vault/Hall lineage, or LOM verdicts. |
| P3 | Compute stylometric drift, TTR baselines, or pgvector genealogy. |
| P4 | Own revision lock state, cooling calendars, or manuscript lifecycle enums. |
| P5 | Author `p4_narrative_logs` instances or 1.1.1 shard trees. |
| P6 | Map vectors to lore, World Bible nodes, or purge schedules. |

---

## 5. MSGF v3.2 alignment note

Hot-path buffers and client trigger policy may coexist with P1, but **only** material that feeds **rhythm signatures** belongs under this pillar’s normative spec. Any feature that interprets text meaning or canon belongs elsewhere.
