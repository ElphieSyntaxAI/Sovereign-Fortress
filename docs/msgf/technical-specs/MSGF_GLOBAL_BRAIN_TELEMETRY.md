# MSGF Global Brain — zero-text swarm telemetry

**Audience:** Engineering, ops, security / legal.  
**Last updated:** 2026-09-17  
**Legal version:** `2026.09.18-UTAH-SAFE` ([`lib/msgf-legal.ts`](../../../packages/msgf/lib/msgf-legal.ts))

When a secondary agent trips swarm-guard (`409 BOT_SWARM_DETECTED`), Global Brain stores **how the wave failed**, never **what the user said**.

Companion: swarm abort/HITL ([`swarm-guard.ts`](../../../packages/msgf/lib/services/swarm-guard.ts)) · Small/Big Brain ([`MSGF_BRAIN_ROUTING.md`](./MSGF_BRAIN_ROUTING.md)) · learning loop ([`MSGF_LEARNING_AND_BIG_BRAIN.md`](./MSGF_LEARNING_AND_BIG_BRAIN.md)) · Shadow proof ([`MSGF_SHADOW_PROXY.md`](./MSGF_SHADOW_PROXY.md)) · Session Replay ([`MSGF_ADMIN_HUB.md`](./MSGF_ADMIN_HUB.md)).

---

## Two envelopes (do not mix)

| Envelope | Who | Contains | Never contains |
| :--- | :--- | :--- | :--- |
| **Tenant HITL / ops** | Operators on `/admin/ops` | Entity to freeze, hashed agent ids, Hall `1.1.1_BOT_SWARM`, ARBITRATE package | Raw prompt/completion in Global Brain JSON |
| **Global Brain telemetry** | Cross-tenant absorb / export | Cause codes, graph topology, token burn, mandate SHA-256, `silo_ref`, drift **factors**, catalog fixes | Prompt, completion, tenant id, agent ids, paths, emails, **P7 `promoted_keys` / `blocked_keys`** |

Schema: [`global-brain-swarm-telemetry.ts`](../../../packages/msgf/lib/schemas/global-brain-swarm-telemetry.ts). Builder: [`global-brain-swarm-telemetry.ts`](../../../packages/msgf/lib/services/global-brain-swarm-telemetry.ts) (service).

Example (structural only):

```json
{
  "schema_version": "1.0",
  "kind": "bot_swarm_detected",
  "enforced": true,
  "cause_codes": ["mandate_mismatch", "fanout_exceeded"],
  "cause_composite": "MANDATE_MISMATCH+FANOUT_EXCEEDED",
  "spawn_depth": 3,
  "parent_child_edge": true,
  "sibling_edge": false,
  "token_burn": 4200,
  "mandate_sha256": "e3b0c442…",
  "silo_ref": "a1b2c3d4e5f6g7",
  "primary_fix_id": "narrow_mandate",
  "suggested_fixes": [{ "id": "narrow_mandate", "rank": 1 }]
}
```

**Not stored for training:** “The subagent was asked to write a medical summary for Patient X…”

Shadow / 7-day trial uses the same schema as `bot_swarm_observed` (`enforced: false`) — no 409, no HITL. Proof email counts **runaway agent waves**.

---

## Drift cause + practical fixes (no extra LLM)

- **What caused drift:** `cause_codes` + `cause_composite` + numeric `drift.factors` from [`logic-drift.ts`](../../../packages/msgf/lib/services/logic-drift.ts) (vault contradiction, HAL, biometric, entropy). Mandate miss/mismatch is “off the original prompt” without storing the prompt.
- **Most practical fixes:** `primary_fix_id` + two alts from [`swarm-fix-catalog.ts`](../../../packages/msgf/lib/services/swarm-fix-catalog.ts) (`narrow_mandate`, `revoke_child_byok`, `cap_inflight`, `require_parent_edge`, `freeze_this_entity`). Catalog copy only — no model narration.

Audit hub search: kind `bot_swarm_detected` / `bot_swarm_observed`; `q` matches `cause_codes`, `suggested_fix_id`, and tenant-audit `promoted_keys` / `blocked_keys`. Those key lists live on **tenant HITL / SIEM** metadata only — never on the Global Brain envelope. `reputation_prune` is an extra swarm cause when a child agent or mandate score is `< -0.3` (parent Pulse is not auto-demoted).

---

## Synthetic failure reconstruction

Deterministic **fake** mandates (`SYNTHETIC_MSGF_STRESS …`) replay against swarm-guard until the same cause trips. These strings are ours, never user-derived.

```bash
npm run export:swarm-synthetic -w msgf
npm run export:swarm-synthetic -w msgf -- --out=./swarm-synthetic.jsonl
```

Code: [`swarm-synthetic-catalog.ts`](../../../packages/msgf/lib/services/swarm-synthetic-catalog.ts). Real-event histograms (`dpCountSwarmComposites`) only emit a composite if it appeared ≥ **k=5** times; optional Laplace noise via `MSGF_SWARM_DP_EPSILON` is **count DP**, not DP text.

Out of v1: selling the dataset, partner contracts, training a model on the JSONL.

---

## Terms (honest split)

Pledge guarantees in `PLATFORM_PLEDGE` (`CURRENT_LEGAL_VERSION = 2026.09.18-UTAH-SAFE`):

1. Prompts/outputs are **never used to train** Elphie or partner models.
2. **Global Brain / swarm safety telemetry is zero-text structural only.**
3. **Published or licensed research/benchmarks use only synthetically generated structural test cases.**
4. **`msgf_prompt_sessions` (Session Replay)** remains tenant legal/security retention — **not** a training corpus and **not** the Global Brain feed.

Onboarding pledge beats are keyed by legal version. After this bump, tenants must accept `2026.09.18-UTAH-SAFE` for Pulse.

---

## Tests

- `npm run test:swarm-guard -w msgf`
- `npm run test:global-brain-swarm -w msgf` (or `test:unit`, which includes both)
