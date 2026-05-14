# P6 — RAG (Universal World Model)  
**MSGF v3.2 · Universal World Model Pillar**

This document governs **P6 only**. It must not define keystroke telemetry (P1), governance consensus (P2), author identity stylometry (P3), revision cooling (P4), or immutable audit sharding (P5).

---

## 1. Scope

**Semantic vector retrieval:** pgvector-backed search, ranking, and contextual assembly of **world knowledge** and manuscript-adjacent corpora authorized for retrieval.

**Contextual mapping:** binding retrieved passages to **categories** (e.g., canon vs. inference vs. marketing) before they may influence user-visible answers.

---

## 2. Universal definitions (authoritative for P6)

| Term | Definition |
|------|----------------|
| **Sovereignty Boundary** | No blob may live in the hot retrieval plane unless it is **vector-mapped to a declared category** with explicit tenant scope and audience rules. |
| **30-Day Automatic Purge** | Any object that fails categorization/mapping within **30 days** of ingestion enters automated deletion or archival per policy—**P6-owned** hygiene. |
| **World Bible** | The canonical semantic corpus for a tenant’s fictional/world-building truth; **only P6** may treat it as authoritative context for generative answers. |

---

## 3. Logic (mandatory behaviors)

1. **Category or purge:** on ingest, assign a **category vector lane**; if none is assignable, start the purge clock immediately.
2. **Retrieval isolation:** character bible, outline, and spoiler tiers must remain **physically or logically partitioned** in index metadata so fan vs. author surfaces cannot cross-retrieve.
3. **No rhythm court:** embeddings here must not be used to prove human typing (P1) or 3σ author identity (P3) without a separate, explicit export contract—by default, **forbidden**.
4. **Hall interaction policy:** P6 may read Hall **labels** as retrieval filters but must not silently rewrite Hall records; mutation of negative indexes belongs to P2’s governance flows.

---

## 4. Separation (explicit non-responsibilities)

| Pillar | P6 must never |
|--------|----------------|
| P1 | Replace HAL rhythm acquisition or session slicing. |
| P2 | Short-circuit Vault/Hall admissibility because “the model found a passage.” |
| P3 | Serve as the primary identity baseline for stylometric drift. |
| P4 | Encode revision lock timers or RED/YELLOW/GREEN states. |
| P5 | Append immutable audit instances; P6 may only emit **opaque retrieval request IDs** into audits when another pillar asks. |

---

## 5. MSGF v3.2 alignment note

HNSW indexes and embedding dimensions are operational concerns, but **meaning ownership** stops at P6. Any feature that “explains why the user paused writing” belongs to P5/P4, not to lore retrieval.
