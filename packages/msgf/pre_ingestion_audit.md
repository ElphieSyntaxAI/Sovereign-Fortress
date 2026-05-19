# MSGF V3.2-ULTRA Pre-Ingestion Audit

**Spec:** [`docs/references/MSGF_v3_2_masterdoc.pdf`](../../docs/references/MSGF_v3_2_masterdoc.pdf) · **Release plan:** [`docs/MSGF_V1_ROADMAP.md`](../../docs/MSGF_V1_ROADMAP.md) (SWEEP step §2.6).

## INIT Phase Status
- SWEEP completed in analysis mode (no refactor performed).
- Scope reviewed: `app/api/msgf/*`, `lib/*`, `utils/msgf/*`, `supabase/migrations/*`, ingestion and gate modules.
- **Ancestral Root mapped:** confirmed initial "worked" deltas and "known-bad" deltas are now classifiable into Vault vs Hall pathways before CONVERGE.

---

## 1) Logic Audit & Drift Scan

### Linguistic & Logic Baseline (Human Signature)
- The codebase shows strong "human signature" traits: iterative comments, defensive fallbacks, explicit tradeoff notes, and evolving heuristics.
- Drift pattern observed: rapid feature layering into route handlers has produced orchestration-heavy endpoints and partial duplication across modules.
- Positive signal: major flows are decomposed into named modules (`P4`, `msgf-consensus`, `msgf-shadow`, `msgf-index`) and already encode audit intent.

### State Gates Mapped to 6-Pillar Core
- **P1 Static Ledger:** legal/version constraints in `lib/msgf-legal.ts`; init guards in `msgf-init.js`.
- **P2 Flow Sequence:** orchestration in `app/api/msgf/pulse/route.ts` (gate -> verify -> arbitrate -> persist).
- **P3 Entity Profiles:** user/session/pledge checks via Supabase auth + legal version checks.
- **P4 State Ledger:** keystroke chunking, beat storage, adaptive biometric baseline in `lib/P4.ts` + `lib/msgf-consensus.ts`.
- **P5 Local Variables:** client buffering and trigger rules in `utils/msgf/pulse-client.ts`.
- **P6 Constraint Ledger:** Vault/Hall abstractions in `lib/msgf-shadow.ts` and lineage lookup in `lib/msgf-index.ts`.

### Logic-of-Meaning (LOM) Weaknesses
- Some security-critical checks depend on metadata conventions (`pillar_vectors.metadata`) without strict DB-level schema enforcement.
- A few "confidence heuristics" (HAL, overlap matching, lexical fallback) can be confidently wrong if uncalibrated against production distributions.
- Multiple modules rely on environment-based fallback behavior that may hide failures in early validation.

---

## 2) Genealogical Bug Indexing (1.1.1)

### Proposed 1.1.1 Sharding Map (Current Snapshot)

| 1.0 Category | 1.1 Branch | 1.1.1 Instance (Snapshot / Fix Delta Candidate) |
|---|---|---|
| Auth | session_legal_gate | `pulse/route.ts`: auth + legal gate + baseline prompt enforcement |
| Orchestration | arbitrate_retry_persist | `pulse/route.ts`: retry escalation, tie-break threshold, PERSIST to Vault |
| State | keystroke_chunking | `P4.ts`: chunking + beat append + legal version stamping |
| State | adaptive_hal | `msgf-consensus.ts`: biometric/linguistic/integrity weighted HAL |
| Safety | shadow_preflight | `msgf-shadow.ts`: Vault/Hall cross-ref with RED tier fast-path |
| Index | lineage_scan | `msgf-index.ts`: pgvector lineage retrieval with lexical fallback |
| Ingest | day_zero_sweep | `msgf-ingest.ts` + `ingest/route.ts`: shard + embed + cold-layer insert |
| Client | pulse_buffer_policy | `pulse-client.ts`: idle/volume/logic-break trigger model |

### Ancestral Root (Fix Deltas to Archive in Vault)
- Delta A: legal-version stamping in `state_beats` for defensible audit trail.
- Delta B: adaptive HAL with recalibration dampening to avoid false RED spikes.
- Delta C: arbitration retry threshold (`>3`) with explicit human tie-break protocol.
- Delta D: SWEEP ingestion route creating a reproducible Day-Zero audit artifact.
- Delta E: Shadow preflight Hall short-circuit for immediate RED-tier rejection.

---

## 3) RED Tier Vulnerabilities

1. **Service-role exposure risk path**  
   `lib/supabase.ts` can fall back to anon key and is directly importable by server modules; a misconfigured env can silently degrade authority assumptions.

2. **Hot-path route concentration**  
   `app/api/msgf/pulse/route.ts` currently handles auth, legal, profiling, consensus, arbitration, and persistence in one path; failure blast radius is high.

3. **Metadata-schema coupling without strong contracts**  
   Vault/Hall and lineage logic assumes metadata keys (e.g., `ledger`, `instance`, `index_type`) are always present and correct; malformed entries can cause false inferences.

4. **Consensus dependency fragility**  
   Dual-model calls are synchronous in critical flow; upstream model outages can stall pulse ingestion unless explicit circuit-break/backoff is added.

5. **Embedding fallback quality drift**  
   Deterministic fallback embeddings in `lib/ai-utils.ts` preserve uptime but can poison semantic quality if used for long periods without visibility flags.

6. **Unbounded trust in user-provided approvedDelta**  
   `approvedDelta` may be persisted with limited normalization; requires stricter length/content policy and provenance marks.

---

## 3.1) Impact vs Effort SWEEP Matrix

| Finding | Impact | Effort | Non-destructive routing |
|---|---:|---:|---|
| Service-role exposure risk path | High | Medium | P1 Static Ledger HALT candidate; record as `1.0_AUTH -> 1.1_SERVICE_ROLE -> 1.1.1_ENV_DEGRADE` before any refactor. |
| Hot-path route concentration | High | High | P2 Flow Sequence refactor candidate; preserve existing route behavior while extracting gate/converge/persist modules. |
| Metadata-schema coupling | High | Medium | P6 Constraint Ledger hardening; add typed metadata tests before DB mutations. |
| Consensus dependency fragility | High | Medium | CONVERGE resilience; require dual-provider fallback and clear HITL incident routing. |
| Embedding fallback quality drift | Medium | Low | SHARD observability; keep fallback deterministic but match `vector(1536)` and mark degraded quality. |
| approvedDelta provenance gap | Medium | Medium | ARBITRATE/PERSIST hardening; require operator provenance before Vault persistence. |

**SWEEP guarantee:** this matrix is analysis-only. It maps risk by **Impact vs Effort** and records lineage targets without mutating source files, migrations, or tenant data.

---

## 4) Hall of Hallucinations Seed List (Negative Index)

Shard these as initial Hall entries (`P6`, `ledger=hall`) to block recurrence:
- Monolithic API route orchestration anti-pattern (gate + consensus + persist in one function).
- Silent fallback embeddings used as production semantic truth.
- Metadata-driven logic without schema validation / enum constraints.
- Retry counter inference from mutable metadata without transaction-bound guarantees.
- "AI certainty" from heuristic overlap scoring alone (without confidence calibration).

Recommended Hall labels:
- `hall.route.overloaded_orchestrator`
- `hall.embedding.fallback_semantic_drift`
- `hall.metadata.contract_ambiguity`
- `hall.retry.counter_non_atomic`
- `hall.shadow.lexical_false_positive`

---

## 5) Directives for CONVERGE (Refactor Phase)

1. Extract `pulse/route.ts` into composable handlers: `gate`, `consensus`, `arbitrate`, `persist`.
2. Introduce typed metadata contracts (Zod/TypeScript schema) for Vault/Hall/Lineage records.
3. Add Redis Hot Layer for active slices and retry counters to reduce DB churn and tighten arbitration latency.
4. Add explicit quality flag when fallback embedding path is used; prevent fallback vectors from entering canonical ancestry unless marked.
5. Add a scheduled Hall purge policy for low-tier negatives (30-day TTL) and keep critical Hall entries pinned.
6. Add transaction-safe increment path for retry counters (DB function or Redis atomic op).
7. Integrate `msgf-shadow.preFlightCheck()` and `msgf-index.getLogicLineage()` directly into pre-consensus path with consistent confidence envelopes.

---

## Checklist Completion
- [x] Summary of Linguistic & Logic Baseline (Human Signature)
- [x] RED Tier logic vulnerabilities
- [x] Proposed 1.1.1 Sharding Map for refactor
- [x] Direct instructions for CONVERGE phase

**Acknowledgement:** The **Ancestral Root has been mapped** and is ready for Vault seeding prior to CONVERGE.

