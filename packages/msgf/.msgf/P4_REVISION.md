# P4 — Revision (Temporal Gate)  
**MSGF v3.2 · Universal Temporal Gate Pillar**

This document governs **P4 only**. It must not own rhythm telemetry (P1), consensus/Vault logic (P2), stylometric identity envelopes (P3), narrative audit instances (P5), or semantic world retrieval (P6).

---

## 1. Scope

**P4 State Ledger:** authoritative record of **where a manuscript (or beat stream) sits in time**—drafting, locked, auditing, ready for handoff, etc.

**Tiered batching:** quantized batches of allowed edits or review windows, aligned to lock tiers—not to stylometric drift thresholds.

---

## 2. Universal definitions (authoritative for P4)

| Tier | Cooling / gate duration | Semantics |
|------|---------------------------|-----------|
| **RED** | **Immediate** stop: no further edits until the gate’s exit criteria are satisfied. |
| **YELLOW** | **6 hours** cooling: limited or read-only operations per policy. |
| **GREEN** | **24 hours** cooling: permissive lane with still-monotonic state transitions. |

> **Separation note:** calendar weeks used elsewhere for long-form publishing (e.g., multi-week manuscript locks) are **orthogonal contracts**; they must be modeled as separate state axes and must not silently redefine RED/YELLOW/GREEN without amending **this** pillar.

---

## 3. Logic (mandatory behaviors)

1. **Monotonicity:** state transitions advance only along declared edges; rollbacks require a new audited transition record (owned outside P4 if narrative proof is required—see P5).
2. **Time is the judge here:** P4 stores **when** transitions may occur and **what** operational mode is legal; it does not infer **why** a user paused (P5) or whether lore agrees (P6).
3. **Batch integrity:** a batch commits or aborts as a unit; partial writes that violate the active tier are rejected at the ledger boundary.
4. **No semantic counsel:** cooling messages shown to users must be **policy text**, not LLM-generated canon advice.

---

## 4. Separation (explicit non-responsibilities)

| Pillar | P4 must never |
|--------|----------------|
| P1 | Interpret keystroke streams or paste flags. |
| P2 | Run Claude/Gemini consensus or Hall scans. |
| P3 | Compute 3σ stylometric drift or pgvector lineage. |
| P5 | Author immutable narrative instances; P4 may emit timestamps consumed by P5 but does not draft audit prose. |
| P6 | Query World Bible vectors or enforce semantic purge rules. |

---

## 5. MSGF v3.2 alignment note

Hot Redis layers may cache active slices for **speed**, but **authoritative** temporal truth for revision gating lives in the P4 ledger model. Redis TTLs must not contradict committed P4 states after reconciliation.
