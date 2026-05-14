# P3 — Stylometry  
**MSGF v3.2 · Universal Identity Pillar**

This document governs **P3 only**. It must not redefine rhythm telemetry (P1), governance gates (P2), revision calendars (P4), audit sharding (P5), or RAG/world semantics (P6).

---

## 1. Scope

**Cold Layer identity snapshots:** durable, low-entropy summaries of linguistic habit (e.g., TTR, sentence-length moments, punctuation/function-word habits) tied to **verified human sessions** as upstream policy defines them.

**Genealogical drift:** comparison of a current snapshot against **historical session averages** and lineage anchors stored for retrieval—not against raw keystroke streams.

---

## 2. Universal definitions (authoritative for P3)

| Term | Definition |
|------|----------------|
| **3σ Identity Standard** | A session is “in-family” only if its stylometric features lie within three standard deviations of the author’s rolling baseline distribution, after declared recalibration windows. |
| **pgvector lineage scans** | Retrieval of **nearest prior sessions / shards** in embedding space to explain drift or stability—never to replace governance verdicts (P2). |
| **Identity consistency** | “Is this the **same** human author profile?”—distinct from P1’s “human vs. non-human rhythm.” |

---

## 3. Logic (mandatory behaviors)

1. **Assumption of human signal:** P3 analyses **begin** from the premise that upstream rhythm classification already marked the slice as human-eligible; P3 does not re-run P1 detectors.
2. **Baseline hygiene:** rolling averages and views must respect **recalibration boundaries** so pre-reset sessions do not poison post-reset identity comparisons.
3. **Drift, not morality:** stylometric divergence is reported as **statistical distance**, not as narrative canon violations (P6) or legal narrative audit (P5).
4. **Vector discipline:** embeddings used here are **identity-lineage** embeddings; they must not be repurposed as World Bible semantic search indexes.

---

## 4. Separation (explicit non-responsibilities)

| Pillar | P3 must never |
|--------|----------------|
| P1 | Re-score keystroke latency or IME composition. |
| P2 | Vote Vault vs. Hall admissibility for logic deltas. |
| P4 | Enforce revision lock timers or RED/YELLOW/GREEN cooling calendars. |
| P5 | Mint `p4_narrative_logs` shards or define 1.1.1 categories. |
| P6 | Retrieve lore paragraphs, character bibles, or enforce 30-day purge on unmapped blobs. |

---

## 5. MSGF v3.2 alignment note

Cold-layer tables and HNSW indexes serve **identity continuity**, not marketing correlation or marketplace analytics. Any join that mixes storefront metrics with HAL belongs outside P3’s normative surface.
