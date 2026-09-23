# MSGF P7 — Source Audit & Resource Reputation

**SSoT for Pillar 7 (engineering).** Product summary: [`MSGF_PRODUCT_OVERVIEW.md`](../marketing/MSGF_PRODUCT_OVERVIEW.md) §3.1a · Roadmap: [`MSGF_V1_ROADMAP.md`](../MSGF_V1_ROADMAP.md) §2.1a · Learning loop: [`MSGF_LEARNING_AND_BIG_BRAIN.md`](./MSGF_LEARNING_AND_BIG_BRAIN.md)

---

## Purpose

P1–P6 store **what** the brain holds. **P7** records **which hashed sources** influenced DEFEND / CROSS-REF and steers the next Pulse / Active / swarm admission **before** tokens are spent. Prompt text is never written to the reputation ledger.

---

## Schema

| Object | Role |
| :--- | :--- |
| `msgf_resource_reputation` | Per-tenant scores in [-1, 1] from good / bad / high-drift counts |
| `msgf_source_downstream_impact` | Reverse impact: “what used this `content_hash` / `resource_key`?” |
| Shadow Eval `p7_deferred` / `p7_applied_at` | Observe-only hits during 7-day trial; apply once on 3-day full-access CTA |

Migrations:

- `20260810010000_msgf_p7_source_reputation.sql`
- `20260918120000_p7_prompt_shadow_deferred.sql` (**applied** on staging)

---

## Key behaviors

| Behavior | Rule |
| :--- | :--- |
| **Content hash** | `sha256` of injected chunk (CRLF→LF + trim) |
| **Prune** | `reputation_score < -0.3` removed from auto-GREEN (still audited `pruned: true`) |
| **Boost** | Score `> 0.3` boosts match |
| **P7 poison** | Wins over model-fitness (stay Small Brain) |
| **Attribution** | `internal_spec` · `permissive_oss` · `copyleft_risk` · `untrusted_external` · `unknown` — copyleft / untrusted block auto-GREEN |
| **prompt_hash** | `x-msgf-prompt-hash` → `prompt:{sha256}` only; Session Replay holds full text |
| **Hot path** | Audit / impact / reputation writes are **non-blocking** — never fail GATE/DEFEND |
| **Decay** | `MSGF_P7_REPUTATION_HALFLIFE_DAYS` (default 30; `0` disables) |

---

## Closed-loop writers

Hashed keys are **written** by: swarm abort, ingest, HITL resolve, Sentry quarantine, heal-queue APPROVE/DENY, confirm-pack, verify-result, Active gateway.

Next Pulse / Active / swarm admission **reads** via `loadReputationMap` / prune helpers before spending or spawning children.

Code: [`p7-observe.ts`](../../../packages/msgf/lib/services/p7-observe.ts) · [`source-audit.ts`](../../../packages/msgf/lib/services/source-audit.ts) · [`schemas/source-audit.ts`](../../../packages/msgf/lib/schemas/source-audit.ts) · [`emit-resource-usage.ts`](../../../packages/msgf/lib/services/emit-resource-usage.ts)

---

## Shadow deferred

Shadow mode (`x-msgf-mode: shadow`) **does not** mutate reputation. Hits land on `p7_deferred`. **Start 3-day full access** claims rows with `p7_applied_at IS NULL` and applies once. Paid Active never queues deferred P7. Spec companion: [`MSGF_SHADOW_PROXY.md`](./MSGF_SHADOW_PROXY.md).

---

## Surfaces

| Surface | Path |
| :--- | :--- |
| Dashboard | Source Audit panel · `GET /api/msgf/dashboard/source-audit` (`?mode=rank`, `?content_hash=`, `?resource_key=`) |
| Ops | Audit hub promoted/blocked lists; provenance search |
| Shadow proof | Promote/block counts on trial proof email / Reports |

Global Brain swarm JSON stays **zero-text** — no key lists. See [`MSGF_GLOBAL_BRAIN_TELEMETRY.md`](./MSGF_GLOBAL_BRAIN_TELEMETRY.md).

---

## Tests

Unit: `npm run test:unit -w msgf` includes `tests/p7-observe.test.ts` / related source-audit coverage. Staging: audit hub `p7=` chips; Shadow CTA apply still a smoke to confirm when exercising the 3-day clock.
