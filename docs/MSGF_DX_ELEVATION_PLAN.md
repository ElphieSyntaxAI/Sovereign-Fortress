# MSGF V3.2-ULTRA — Developer Experience (DX) Elevation Plan

**Status:** Canonical DX spec (HAL friction loop = P1/P2 extension work).

---

## I. Mission

Shift MSGF from passive boundary to **active engineering mentor**: reduce friction, protect against fatigue, route developers to **0-token** context before cloud spend.

---

## Goal-HAL-DX — Friction & burnout interception

**Contract:** [`packages/msgf/src/lib/universal/p1HalStandard.ts`](../packages/msgf/src/lib/universal/p1HalStandard.ts) (HAL telemetry charter; operational pillar P4).

**IDE (T2):** Rolling 15m heuristic on keystrokes/paste → non-blocking notice:

```text
[MSGF P4 Telemetry Notice]: High keystroke friction detected over the last 15 minutes.
Your local logic drift slope is fluctuating.
Action Recommended: Click 'Generate 0-Token Context Pack' to unblock this function without cloud token drain.
```

**CTA:** `GET /api/msgf/agent-context?mode=guided` — same as **Fix Myself** / 0-Token Context Pack.

**Author:** Server friction analytics exist in Author BFF; generic IDE uses local heuristic unless `product_surface=author`.

---

## Copy-paste for Codespaces / Cursor

Use the notice text verbatim in extension `halFrictionNotice` (planned). Link command `msgf.generateContextPack` → guided agent-context.

---

## Relation to agent matrix

| DX | Matrix |
|----|--------|
| Context pack CTA | Option A |
| Auto-Apply after manual choice | Option B via dev heal cycle |
