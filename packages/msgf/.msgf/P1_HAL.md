# P1 — HAL (Human Authorship Ledger)  
**MSGF v3.2 · Universal Telemetry Pillar**

This document governs **P1 only**. It must not define governance rules (P2), identity stylometry (P3), temporal gates (P4), narrative audit taxonomy (P5), or world-model retrieval (P6).

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
