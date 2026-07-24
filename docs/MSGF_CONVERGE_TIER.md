# MSGF Part B — 3-tier dual CONVERGE

## Overview

Code deltas are classified into **TIER_1 / TIER_2 / TIER_3** (&lt;5ms heuristic, no LLM). Each tier runs a **dual-model pair**; disagreement escalates T1→T2→T3; **T3 failure auto-quarantines matching Vault wins** (no auto-Hall) and forces HITL on `/admin/ops`.

## Enable tiered converge

```bash
MSGF_CONVERGE_TIER_ENABLED=1
```

Optional model overrides: `MSGF_CONVERGE_TIER_1_A_MODEL`, `MSGF_CONVERGE_TIER_1_B_MODEL`, etc.

## T3 quarantine → HITL

When dual models still disagree at T3:

1. Matching Vault rows (lineage hits / path overlap) set `quarantine_status=QUARANTINED`
2. Redis telemetry recorded (`converge-tier:*`)
3. Pulse forces Hall persist + remediation circuit → admin HITL
4. Ops restores/demotes via existing quarantine panel (A3) — **never auto-Hall**

Pulse response fields:

- `tier_quarantine_applied`
- `tier_quarantine_vector_ids`
- `tier_quarantine_reason`

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

Migration: `20260724030400_msgf_company_tier_rules.sql`

Tests: `test:converge-tier-classifier`, `test:converge-tier-escalation`, `test:converge-tier-quarantine`, `test:hot-layer-fast-read`
