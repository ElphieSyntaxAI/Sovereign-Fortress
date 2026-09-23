# MSGF Staging Seed & Env

**SSoT for staging product-readiness accounts and Cloud Run flags.**  
**Code:** [`packages/msgf/lib/staging-readiness-seed.ts`](../../../packages/msgf/lib/staging-readiness-seed.ts)  
**UI:** `/admin/seed` (GLOBAL_ADMIN, staging only) · API `GET/POST /api/msgf/admin/staging-seed`  
**CLI:** `npm run seed:staging -w msgf`  
**Env file:** repo-root `.env.cloudrun.staging` (gitignored; regenerate via `npm run staging:prepare`)  
**Preflight:** `scripts/staging-preflight.mjs`

---

## Isolation

Seed **refuses** to run unless `DEPLOY_ENV=staging` and the Supabase host is not a production host (`assertStagingSeedTarget`). Never point seed at production.

---

## Operator + buyer (legacy readiness)

| Account | Role |
| :--- | :--- |
| First email in `MSGF_GLOBAL_ADMIN_EMAILS` | GLOBAL_ADMIN operator |
| `STAGING_BUYER_EMAIL` or `staging-buyer@elphiesyntax.test` | Checkout buyer |

Also ensures Pulse tenant `staging_readiness`, Author tenant `author_ecosystem`, licenses, wallets, pledge.

---

## Plan personas (commercial_plan QA)

Fixed password **`StagingReady!2026`** — reset on every seed run.

| Email | Plan / role |
| :--- | :--- |
| `pro_user@msgf.dev` | `commercial_plan=pro`, personal sandbox (`company_id` null) |
| `startup_admin@msgf.dev` | Startup company admin (`staging-startup-plan`, seat_limit 5) |
| `startup_dev@msgf.dev` | Same company · `team_platform_role=dev` |
| `startup_auditor@msgf.dev` | Same company · `auditor` |
| `startup_security@msgf.dev` | Same company · `security` |
| `enterprise_ciso@msgf.dev` | `commercial_plan=enterprise`, company `staging-enterprise-plan`, seat_limit **25**, admin |

Constants: `STAGING_PLAN_PASSWORD`, `STAGING_PLAN_PERSONAS` in the seed module.

---

## Staging Cloud Run flags (MSGF)

Set in `.env.cloudrun.staging` / `scripts/prepare-cloudrun-env.mjs` **STAGING_OVERRIDES**:

| Flag | Staging | Notes |
| :--- | :---: | :--- |
| `MSGF_TRI_CONSENSUS_ENABLED` | 1 | Platform Big Brain TRI |
| `MSGF_TENANT_TRI_CONSENSUS_ENABLED` | 1 | Tenant Tri-Tribunal save/runtime (still needs Startup/Enterprise plan) |
| `MSGF_POST_MVP_SIGNING` | 1 | Process gate — plan still requires Enterprise |
| `MSGF_POST_MVP_DROPBOX_ARCHIVE` | 1 | Same |
| `MSGF_POST_MVP_MCP` | 1 | Same |
| `MSGF_SIGNING_MOCK` | 1 | Allowed as **warning** in staging preflight; keep **0** on production |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | set | `/api/sentry-test` smoke |
| Author `AUTHOR_POST_MVP_*` | 0 / unset | Not MSGF enterprise workspace |

See [`MSGF_PLAN_ENTITLEMENTS.md`](./MSGF_PLAN_ENTITLEMENTS.md) for env ∧ plan rules.

---

## How to seed

1. Confirm staging DB migrations (`npm run db:push:staging -w msgf` when needed).
2. Sign in as GLOBAL_ADMIN → `/admin/seed` → **Seed staging tenant**, **or** `npm run seed:staging -w msgf`.
3. Deploy so Cloud Run picks up env: `.\deploy-staging.ps1` (or `./deploy-staging.sh`).

---

## Smoke checklist (staging)

| Check | Expect |
| :--- | :--- |
| Checkout success URL | Lands `/workspace?tab=projects` ([`MSGF_BILLING.md`](./MSGF_BILLING.md)) |
| `GET /api/downloads/pulse-guard` | 200 VSIX/ZIP |
| `GET /api/sentry-test` | 200 (`ok: true`, capture queued) |
| HITL resolve on `/admin/ops` | 200; unknown `arbitrate_audit_id` ignored by non-strict Zod |
| Plan personas | Sign-in with `StagingReady!2026`; Pro blocked from team/Tri; Startup opens Tri; Enterprise opens SSO/SIEM/quarantine |

Production migrate/deploy stays out of this doc’s scope.
