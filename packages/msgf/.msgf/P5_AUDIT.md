# P5 — Audit (Immutable Narrative Ledger)  
**MSGF v3.2 · Universal Forensic Gate Pillar**

This document governs **P5 only**. It must not capture keystroke telemetry (P1), run consensus/Vault gates (P2), score stylometric identity (P3), own revision timers (P4), or manage World Bible vectors (P6).

---

## 1. Scope

**Immutable Narrative Ledger:** append-only, tenant-scoped records of **what happened**, **who acted**, and **with what severity**, suitable for downstream forensic UI and compliance export.

**Observer role:** P5 **witnesses** system behavior; it does not substitute for P2’s admissibility court or P4’s temporal enforcement.

---

## 2. Universal definitions (authoritative for P5)

| Term | Definition |
|------|----------------|
| **1.1.1 Sharding Standard** | Every event is stored as **`Category → Branch → Instance`** in a hierarchical tree (e.g., `Orchestration.arbitrate_retry_persist.instance_uuid`). |
| **Instance** | The smallest non-fungible audit atom: one discrete emission to the ledger with stable metadata shape. |
| **pre_ingestion_audit artifact** | Human-readable sweep output (e.g., `pre_ingestion_audit.md`) that **catalogues** risk; creation is P5’s duty, **remediation** is not. |

---

## 3. Logic (mandatory behaviors)

1. **Append-only discipline:** corrections arrive as **new** instances referencing prior IDs; historical rows are never mutated.
2. **Typed severity:** each instance carries a normalized severity enum suitable for alerting and retention policies **without** embedding full manuscript text unless explicitly allowed by policy.
3. **No operational halt:** P5 must not block user drafting solely because an audit line was written; halting belongs to P2/P4 per their charters.
4. **Shard integrity:** metadata must include enough lineage to reconstruct **which pillar emitted** the event, without co-mingling foreign pillar payloads.

---

## 4. Separation (explicit non-responsibilities)

| Pillar | P5 must never |
|--------|----------------|
| P1 | Sample keystroke intervals or IME composition. |
| P2 | Replace Vault/Hall consensus with narrative prose. |
| P3 | Compute rolling TTR or vector similarity for identity. |
| P4 | Set RED/YELLOW/GREEN cooling clocks. |
| P6 | Embed or purge lore chunks; P5 may **reference** chunk IDs only as opaque pointers. |

---

## 5. MSGF v3.2 alignment note

Dashboards may **read** P5 streams for transparency, but must not use them as the sole authorization primitive for Vault writes—that remains P2. P5’s job is permanent, ordered **observation**, not **prevention** unless another pillar explicitly consumes its severity signals.
