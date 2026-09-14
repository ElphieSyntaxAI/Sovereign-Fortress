# MSGF — Native Sentry (SDK + admin ops)

**Purpose:** (1) Instrument the gatedai Next.js app with `@sentry/nextjs` (errors + tracing). (2) Show Sentry runtime issues inside MSGF **Ops console** (`/admin/ops`) next to ARBITRATE and DocuSign.

**API (ops panel):** `GET/PUT /api/msgf/admin/sentry` (operators only — `GLOBAL_ADMIN` / `COMPANY_ADMIN`)

---

## Env — SDK (required for error capture)

| Variable | Required | Purpose |
| :--- | :---: | :--- |
| `NEXT_PUBLIC_SENTRY_DSN` | Yes (client) | Browser DSN |
| `SENTRY_DSN` | Yes (server/edge) | Server/edge DSN (may match public) |
| `SENTRY_AUTH_TOKEN` | Build | Source map upload via `withSentryConfig` |
| `SENTRY_ORG` / `SENTRY_ORG_SLUG` | Build | Org slug for source maps |
| `SENTRY_PROJECT` / `SENTRY_PROJECT_SLUG` | Build | Project slug for source maps |
| `SENTRY_ENVIRONMENT` | No | e.g. `production` / `staging` |

Config files: `instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation.ts`, `app/global-error.tsx`. Tunnel: `/monitoring` (excluded from middleware).

**Verify:** with DSN set, `GET /api/sentry-test` then check Sentry Issues — **delete that route after confirmation**.

---

## Env — Ops panel / quarantine

| Variable | Required | Purpose |
| :--- | :---: | :--- |
| `SENTRY_AUTH_TOKEN` | Yes | Sentry org auth token (Bearer) |
| `SENTRY_ORG_SLUG` | Yes | Organization slug (e.g. `dealstar`) |
| `SENTRY_PROJECT_SLUG` | No | Optional default project filter |
| `SENTRY_BASE_URL` | No | Default `https://sentry.io` (self-hosted override) |

Without `SENTRY_AUTH_TOKEN` + `SENTRY_ORG_SLUG`, the panel shows **unconfigured** (same pattern as DocuSign) — admin pages still load.

### Create a token

1. Sentry → **Settings → Auth Tokens** (org)
2. Scopes: at least **`event:read`**, **`project:read`**, **`org:read`**; add **`event:admin`** (or issue write) if you want **Resolve** from MSGF
3. Paste into Cloud Run / `.env.local` as `SENTRY_AUTH_TOKEN`
4. Set `SENTRY_ORG_SLUG` to your org slug (URL path after `/organizations/`)

Redeploy or restart `npm run dev -w msgf`.

---

## Operator flow

1. Sign in at `/admin/sign-in`
2. Open **Ops console** → **Sentry**
3. **Load issues** (default query `is:unresolved`)
4. **Open** → Sentry UI · **Resolve** → `PUT` issue status via Sentry API

---

## Split of responsibility

| Tool | Watches |
| :--- | :--- |
| **Sentry** (this panel) | Runtime exceptions, releases, prod noise |
| **MSGF** Pulse / Vault / heal | AI/dev deltas, Safe Build verify, consensus |
| **Starport** `sentry` CLI | Same Sentry API from deploy/ops automation |

MSGF does **not** replace the Sentry SDK in your apps — instrument Starmap/etc. as you do today; MSGF only **reads** (and optionally resolves) via the org token.

---

## Crash → Vault quarantine (A2)

`POST /api/msgf/ops/sentry-webhook`

| Variable | Purpose |
| :--- | :--- |
| `SENTRY_WEBHOOK_SECRET` | Bearer token or `x-sentry-webhook-secret` / `sentry-hook-signature` |
| `SENTRY_VAULT_MATCH_THRESHOLD` | Default `0.75` — quarantine only at/above this lexical confidence |

On match: sets `pillar_vectors.quarantine_status=QUARANTINED` (blocked from Vault retrieval). **Does not** auto-demote to Hall — HITL on `/admin/ops` is A3.

Optional scope tags on the Sentry issue: `company_id`, `project_origin` (or headers `x-msgf-company-id` / `x-msgf-project-origin`).

Ops alert: `msgf_tenant_vault_log` kind `sentry_vault_quarantine`.

### HITL review (A3)

`/admin/ops` → **Quarantine review** panel.

- `GET/POST /api/msgf/admin/vault-quarantine`
- **Restore** → `RESTORED` (eligible for Vault retrieval again)
- **Demote to Hall** → `persistToHall` + `DEMOTED_HALL` (still blocked from Vault wins)

Operators only (`GLOBAL_ADMIN` / `COMPANY_ADMIN`); developers get 403.

---

## Related

- [`MSGF_ADMIN_HUB.md`](../../msgf/technical-specs/MSGF_ADMIN_HUB.md) — admin surfaces
- [`MSGF_SIGNING.md`](./MSGF_SIGNING.md) — DocuSign / Dropbox Sign
- Starport: `starport sentry issues` (client-side tooling; separate from this SaaS panel)
