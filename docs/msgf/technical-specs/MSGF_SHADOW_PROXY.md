# MSGF Shadow Proxy — Zero-Latency Proof Mode + Active Governance

**Audience:** Integrators / enterprise IT  
**Package:** `packages/msgf` (`/api/v1/*`) — not root `packages/core`  
**Last updated:** 2026-09-18 (P7 deferred apply-on-activate + zero-text Global Brain swarm telemetry + 7-day trial proof email)

Point OpenAI or Anthropic SDKs at MSGF to **prove projected bill savings** (shadow) or **apply live governance** (active) without changing app code.

## Glossary — three different “shadow” words

| Term | Meaning | Code |
| :--- | :--- | :--- |
| **DEFEND preflight** | Vault/Hall safety gate before Pulse / ingest | `lib/defend-preflight.ts` (aliases `lib/msgf-shadow.ts`) |
| **Passive IDE Scan** | Background IDE policy/shard scan (artifacts may use `.msgf/shadow-scan/`) | `msgf-pulse-guard` + `shadow-scan-shard-lookup.ts` |
| **Shadow Proxy / Shadow Eval** | Gateway pass-through + projected savings (`x-msgf-mode: shadow`) | `lib/gateway/*`, `lib/shadow-eval/*`, table `msgf_shadow_evaluation_logs` |

## 30-second onboard

### OpenAI SDK

```ts
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // still your provider key (pass-through)
  baseURL: "https://<MSGF_HOST>/api/v1",
  defaultHeaders: {
    "x-msgf-mode": "shadow", // or "active"
    "x-msgf-key": process.env.MSGF_LIVE_KEY!, // msgf_live_* / msgf_test_* / msgf_ide_*
  },
});

await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Hello" }],
});
```

### Anthropic SDK

```ts
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  // SDK appends `/v1/messages` — use `/api` (not `/api/v1`) as baseURL.
  baseURL: "https://<MSGF_HOST>/api",
  defaultHeaders: {
    "x-msgf-mode": "shadow",
    "x-msgf-key": process.env.MSGF_LIVE_KEY!,
  },
});
```

> **Do not** rely on `x-msgf-tenant-id` for auth. Tenant is forced from the license / IDE token DB record. Spoofed tenant headers are ignored.

Endpoints:

| SDK path | MSGF route | Upstream |
| :--- | :--- | :--- |
| Chat Completions | `POST /api/v1/chat/completions` | `api.openai.com/v1/chat/completions` |
| Messages | `POST /api/v1/messages` | `api.anthropic.com/v1/messages` |

## Modes

| `x-msgf-mode` | Behavior |
| :--- | :--- |
| **`shadow`** (default if header omitted) | Zero-latency pass-through. Async Shadow Eval writes **projected** savings. |
| **`active`** | Active Governance Orchestrator: hash completion cache → state-gate prune → drift label → sharded single-model upstream. Proven avoidance recorded. Kill-switch: `passthrough_fallback` (default on). |

### Active aggressiveness

Env `MSGF_ACTIVE_AGGRESSIVENESS` or header `x-msgf-active-aggressiveness`:

| Value | Behavior |
| :--- | :--- |
| `cache-only` | Cache hit short-circuit; else sharded pass-through |
| `shard-and-route` (**default**) | Cache + state-gate + Small Brain / single upstream |
| `full-consensus` | Same as shard-and-route; high-drift labeled `STATE_GATED_CONVERGE` (dual/TRI chat wire synthesis deferred) |

Audit response headers: `x-msgf-routing`, `x-msgf-tokens-saved`, `x-msgf-cache-hit`.

## Auth (hardened)

- **Upstream key:** `Authorization: Bearer …` (OpenAI) or `x-api-key` (Anthropic) — injected after allowlist sanitization (Cookie / `x-msgf-*` never forwarded).
- **MSGF key required:** `x-msgf-key` = `msgf_live_*` / `msgf_test_*` (SHA-256 → `msgf_licenses`) or `msgf_ide_*` (`verifyIdeToken`).
- **Demo tenant** (`shadow_demo`): only when `NODE_ENV !== 'production'` **and** `ALLOW_DEMO_TENANT=true` (alias: `MSGF_SHADOW_ALLOW_DEMO_TENANT=1`).

## What you see

- **Free 7-day trial:** `/shadow-trial` — email signup mints `msgf_test_*` key. The 7-day Shadow clock starts on first eval (unused keys expire after 14 days with no empty report). End-of-window proof email includes **Start 3-day full access** (Individual Pro for 72h on the same tenant). Cron: `POST /api/msgf/ops/shadow-trial-reports`.
- Trial keys force `x-msgf-mode: shadow` until the 3-day full-access window is live.
- Secondary-agent swarm is **observed only** in Shadow (no 409). Proof email includes **runaway agent waves** plus **would have promoted / blocked** hashed resource counts. Global Brain stores structural `bot_swarm_observed` — never the user prompt, never P7 key lists. Active mode **aborts that wave** + HITL. Spec: [`MSGF_GLOBAL_BRAIN_TELEMETRY.md`](./MSGF_GLOBAL_BRAIN_TELEMETRY.md).
- **P7 deferred:** Shadow Eval stores hashed promote/block hits on `msgf_shadow_evaluation_logs` (`p7_deferred`). Reputation is **not** mutated during the 7-day window. **Start 3-day full access** applies those hits once (`p7_applied_at IS NULL` claim) so Active starts warm.
- Reports → **Shadow Proxy** panel: eval count, actual pass-through $, **projected savings $** (footnote) plus the proof ledger (including P7 promote/block tiles)
- Weekly / monthly tables + PDF: **Shadow projected $** column (not proven eco)
- Active proven tokens → Redis + `msgf_proven_avoidance_events` (public eco when proven-only)
- Table: `msgf_shadow_evaluation_logs`

Projected ≠ proven. Public eco only moves on proven avoidance / pack deltas.

## Related code

- `lib/gateway/auth.ts` — `authenticateGatewayKey`
- `lib/gateway/header-sanitizer.ts` — upstream allowlist + Pulse trust strip
- `lib/gateway/provider-gateway.ts`
- `lib/gateway/shadow-fast-path.ts`
- `lib/gateway/prompt-ir.ts` / `active-orchestrator.ts` / `tenant-policy.ts`
- `lib/shadow-eval/*`
- `lib/auth/dashboard-guard.ts` — dashboard tenant IDOR guard
- `lib/services/swarm-guard.ts` + [`MSGF_GLOBAL_BRAIN_TELEMETRY.md`](./MSGF_GLOBAL_BRAIN_TELEMETRY.md)
