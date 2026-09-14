# MSGF Part B — 3-tier dual CONVERGE

## Overview

Code deltas are classified into **TIER_1 / TIER_2 / TIER_3** (&lt;5ms heuristic, no LLM). Each tier runs a **dual-model pair** (cost ladder); disagreement escalates T1→T2→T3; **T3 failure auto-quarantines matching Vault wins** (no auto-Hall) and forces HITL on `/admin/ops`.

**Coexistence with TRI consensus:** The tier ladder is a **risk/cost path** (which pair runs first). Platform **Big Brain** vote truth when `MSGF_TRI_CONSENSUS_ENABLED=1` is **Claude + Gemini + Grok majority** ([`MSGF_BRAIN_ROUTING.md`](./MSGF_BRAIN_ROUTING.md)). Tier force headers still classify risk; Pulse chunk voting uses consensus config. Do **not** put Grok on every T1 call — keep TRI for high-drift Big Brain / tenant `tri_tribunal` preset.

## Enable tiered converge

```bash
MSGF_CONVERGE_TIER_ENABLED=1
# Optional Big Brain TRI (separate flag):
MSGF_TRI_CONSENSUS_ENABLED=1
MSGF_TENANT_TRI_CONSENSUS_ENABLED=1   # tenant tri_tribunal / 3-way custom_byok
XAI_API_KEY=...                       # platform Grok
```

Optional model overrides: `MSGF_CONVERGE_TIER_1_A_MODEL`, `MSGF_CONVERGE_TIER_1_B_MODEL`, etc.

## T3 quarantine → HITL

When dual models still disagree at T3:

1. Matching Vault rows (lineage hits / path overlap) set `quarantine_status=QUARANTINED`
2. Redis telemetry recorded (`converge-tier:*`)
3. Pulse forces Hall persist + remediation circuit → admin HITL
4. Ops restores/demotes via existing quarantine panel (A3) — **never auto-Hall**

Under TRI Big Brain, a **2-of-3 HUMAN majority** can pass without HITL even if one model disagrees — unless original drift ≥ human notify threshold (default 0.45) or security/`NON_HUMAN`/quarantine applies.

Pulse response fields:

- `tier_quarantine_applied`
- `tier_quarantine_vector_ids`
- `tier_quarantine_reason`
- `consensus_mode` / `vote_tally` (when TRI metadata present)

Live Pulse also quarantines when classifier tier is `TIER_3` and Gemini/Claude disagree (even if `MSGF_CONVERGE_TIER_ENABLED` is off).

## Company path rules

Table: `msgf_company_tier_rules`  
API: `GET/POST/PATCH/DELETE /api/msgf/workspace/tier-rules` (COMPANY_ADMIN)

Example: `{ "path_glob": "**/payment/**", "force_tier": "TIER_3" }`

## Pulse telemetry

Response fields when classifier runs:

- `converge_tier`
- `converge_routing_profile`

Force tier (admin/debug): header `x-msgf-converge-tier: TIER_1|TIER_2|TIER_3`

## Hot layer (nanosecond gate)

- `readActiveSliceFast` — Redis read with `readLatencyNs`
- `validateP4GateFast` — pledge/gate stamp in Redis
- `MSGF_HOT_LAYER_PRIMARY=1` (default) — skip cold Postgres beat fetch on hot hit
- P4 ingest returns `hotLayerReadLatencyNs`, `gateValidationLatencyNs`

Migration: `20260724030400_msgf_company_tier_rules.sql` · TRI config: `20260805010000_tri_consensus_config.sql`

Tests: `test:converge-tier-classifier`, `test:converge-tier-escalation`, `test:converge-tier-quarantine`, `test:hot-layer-fast-read`, `test:tri-consensus`
