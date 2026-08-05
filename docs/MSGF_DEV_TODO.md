# MSGF — Dev TODO & production readiness

**Audience:** Jessica / MSGF engineering  
**Status:** Living checklist for **MSGF 1.0 production readiness** (gatedai + Pulse Guard + ops).  
**Last updated:** 2026-08-02

**Priority now:** Ship a production-ready MSGF product (RC gate) **including Stripe paid checkout (M3)**.  
**Deferred:** Boss demo narrative / Andrew repo mapping theater — see §4 (parked).

**Related:** [`MSGF_RC_CHECKLIST.md`](./MSGF_RC_CHECKLIST.md) · [`MSGF_DEPLOY_CHECKLIST.md`](./MSGF_DEPLOY_CHECKLIST.md) · [`MSGF_V1_ROADMAP.md`](./MSGF_V1_ROADMAP.md) · [`MSGF_TESTING.md`](./MSGF_TESTING.md) · [`MSGF_GITHUB_PROJECTS.md`](./MSGF_GITHUB_PROJECTS.md) · [`MSGF_SENTRY.md`](./MSGF_SENTRY.md) · [`MSGF_SOLO_INTEGRATION.md`](./MSGF_SOLO_INTEGRATION.md)

---

## 0. How to use this list

- `[ ]` = not done · `[~]` = in progress · `[x]` = done  
- **P0** blocks technical RC (gates, secrets, smoke) · **P0-M3** blocks **paid** go-live (Stripe) · **P1** product glue · **P2** polish  
- **Stripe is in plan** — webhook entitlement **code landed**; finish Dashboard prices + staging smoke before promising self-serve checkout  
- Do **not** block RC on boss-demo silos (parked §4). Part B CONVERGE tiers are **landed** (flag-gated).

---

## 1. Production gate (P0) — do these first

Canonical checklist: [`MSGF_RC_CHECKLIST.md`](./MSGF_RC_CHECKLIST.md). This section is the day-to-day execution order.

### 1.1 Schema on the live DB

- [x] I1/A1 migrations (`20260724020000`, `20260724020100`) applied locally via `npm run db:push`
- [x] Confirm GitHub connections migration `20260724010000` on remote (Jul 24 push wave)
- [x] Apply Jul 24 follow-ons on remote DB (2026-07-24 `db:push` + `verify:db-schema` green):
  - `20260724030000_pillar_vectors_compound_scope.sql`
  - `20260724030100_webhook_inbox_archive_status.sql`
  - `20260724030200_msgf_skip_audit.sql`
  - `20260724030300_msgf_arbitrate_audit.sql`
  - `20260724030400_msgf_company_tier_rules.sql`
- [x] `npm run verify:db-schema -w msgf` against the target DB after push
- [x] Apply Stripe entitlement migration `20260802010000_p4_profiles_stripe_subscription.sql` (`stripe_subscription_id` / `stripe_customer_id` on profiles; `seat_limit` on companies) via `npm run db:push -w msgf` (2026-08-02)

### 1.2 Automated gates (clean machine + env)

- [x] `npm run test:unit -w msgf` (2026-07-24 — green after A4 metadata schema fix)
- [x] `npm run test:stripe-entitlements -w msgf` (2026-08-02 — Startup Team + status sync + mock/live entitlement)
- [x] Fix production build blocker: `LocalSubfolderPickerPanel.tsx` / `window.showDirectoryPicker` — added `types/file-system-access.d.ts` (2026-08-02). Full `next build` still flaked once on Windows exit `3221226505` during webpack; no TypeScript picker error.
- [ ] `npm run deep-test:solo -w msgf` (clear locked `.next` on Windows/OneDrive if needed)
- [ ] `npm run validate:deployment` (unit + production `next build`)
- [ ] `npm run verify:msgf-env -w msgf`
- [x] Targeted: `test:a4-compound-scope`, `test:i5-webhook-queue`, `test:i4-dropbox-archive`, `test:a5-skip-audit`, `test:a6-arbitrate-audit`, `test:converge-tier-classifier`, `test:converge-tier-escalation`, `test:converge-tier-quarantine`, `test:hot-layer-fast-read`

### 1.3 Cloud Run / ops secrets (no mock authority)

| Env | Purpose |
| :--- | :--- |
| `REDIS_URL` / Upstash | Hot layer + job queue |
| `MSGF_OPS_CRON_SECRET` | Heartbeat, archive worker, audit fallbacks |
| `MSGF_SKIP_AUDIT_SECRET` | A5 skip-MSGF HMAC (or reuse ops cron) |
| `MSGF_ARBITRATE_AUDIT_KEY` | A6 HITL audit HMAC (or reuse ops cron) |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | `@sentry/nextjs` SDK (errors + tracing) |
| `SENTRY_AUTH_TOKEN` + `SENTRY_ORG_SLUG` + `SENTRY_PROJECT_SLUG` | Source maps + ops Sentry panel |
| DocuSign / Dropbox Sign / Dropbox archive | Only if those surfaces are live |

- [~] Local `.env.local` (msgf): Sentry DSN + org `elphie-syntax-llc` + project `msgf` + auth token + `SENTRY_BASE_URL=https://us.sentry.io` — **not yet on Cloud Run**
- [~] Local: `STRIPE_WEBHOOK_SECRET` set — **not yet on Cloud Run**; Price IDs / live flip still open
- [ ] Secrets present on staging + prod Cloud Run (ops cron, Redis, Sentry DSN + token, Stripe)
- [ ] GitHub Actions `msgf-tier-heartbeat.yml` uses `MSGF_OPS_CRON_SECRET` + `MSGF_APP_URL`
- [ ] `/admin/ops` loads **live** data (not mock pillar health)
- [ ] `POST /api/msgf/ops/v32-heartbeat` with `{"dry_run":true}` → 200

### 1.4 Staging smoke (one real tenant)

- [ ] Sign pledge → Pulse baseline
- [ ] Ingest → lineage / heal-queue
- [ ] Admin ARBITRATE resolve → row appears in **Signed HITL audit** + verify OK
- [ ] Safe Build / verify-result → deploy-gate green for that `project_origin`
- [ ] Sentry panel Load issues (token may need `event:read` — current token returned 403 on org API)
- [ ] SDK verify: `GET /api/sentry-test` → issue in Sentry project `msgf` → **delete route after**
- [ ] `npm run probe:solo -w msgf` against staging or production gatedai URL

### 1.5 Product surfaces that must work

- [ ] Landing, pricing, workspace, `/status`, extension download on staging/prod
- [ ] `/setup/projects` — GitHub and/or local mappings create correct `project_origin`
- [ ] Workspace team readiness (I6) + signing webhooks idempotent (I5) when configured
- [ ] Pulse Guard: `msgf.enabled` + tenantKey + token; async preflight default on

---

## 2. Ship what’s already built (integrations — still P0 for prod)

### GitHub repo picker

- [ ] GitHub OAuth App + Supabase Auth provider (`read:user` + `repo`) — [`MSGF_GITHUB_PROJECTS.md`](./MSGF_GITHUB_PROJECTS.md)
- [ ] `CRYPTO_SECRET_KEY` (dev) / KMS (prod) for provider token encrypt
- [ ] Redirect allowlist: `/auth/callback`, `/setup/projects`
- [ ] Smoke: Connect GitHub → multi-select → `/setup/projects` rows

### Native Sentry (SDK + admin ops)

See [`MSGF_SENTRY.md`](./MSGF_SENTRY.md).

- [x] `@sentry/nextjs` installed + wired (`instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation.ts`, `global-error.tsx`, `withSentryConfig`, `/monitoring` tunnel)
- [x] Local DSN + `SENTRY_ORG=elphie-syntax-llc` + `SENTRY_PROJECT=msgf` + auth token in `packages/msgf/.env.local`
- [ ] **Rotate** auth token (pasted in chat) and confirm scopes: CI/source maps **and** `event:read` / `project:read` / `org:read` for ops panel
- [ ] Smoke: `GET /api/sentry-test` → Issues dashboard (then delete route)
- [ ] Smoke: `/admin/ops` → Sentry → Load / Open / Resolve
- [ ] Quarantine HITL path: Sentry match → quarantine → demote/restore (A2/A3)
- [ ] DSN + auth token + org/project on staging/prod Cloud Run

### Solo / admin

- [ ] Clear locked `packages/msgf/.next` on Windows/OneDrive when builds flake
- [ ] Global admin emails / operator role correct for ops console

---

## 2b. Stripe / paid entitlements (P0-M3 — after technical P0, before paid claims)

**Code landed (2026-08-02):** Checkout metadata seats · `lib/services/stripe-entitlements.ts` · webhook handlers for Startup Team + subscription lifecycle + `invoice.payment_failed` → `past_due` · mock/live entitlement guard · `verify:msgf-env` requires Price IDs when `MSGF_STRIPE_WEBHOOK_LIVE=1` · migration `20260802010000_*` · `test:stripe-entitlements`.

### Stripe Dashboard / env

| Env | Purpose |
| :--- | :--- |
| `STRIPE_SECRET_KEY` | API (test first, then live) |
| `STRIPE_WEBHOOK_SECRET` | `POST /api/webhooks/stripe` signature |
| `STRIPE_PRICE_PRO_INDIVIDUAL` | $99 one-time Price ID (`mode: payment`) — test: `price_1TzvlH45Z9uJcKXAiX8a5IF` |
| `STRIPE_PRICE_STARTUP_TEAM` | $49/user/mo Price ID (`mode: subscription`) — test: `price_1TzwGGH45Z9uJcKXaWckdzAt` |
| `MSGF_STRIPE_WEBHOOK_LIVE=1` | Marks webhook as production-truth for entitlements |
| `MSGF_ENTITLEMENT_MOCK_STRIPE_ACTIVE=0` | Turn **off** mock once webhook writes `stripe_subscription_status` |

**Catalog note (2026-08-02 export):** Also created but **not wired** in `/pricing` yet — Startup Team yearly (`price_1TzwJ0H45Z9uJcKXMo5Fd83g`), Solo Pro monthly/yearly (`price_1TzvvnH45Z9uJcKXVQHBmqWi` / `price_1TzvxaH45Z9uJcKXo0eu9DnH`). Keep in Stripe; wire only if we expand tiers.

- [x] Stripe Products created — **test Price IDs** for Pro perpetual + Startup Team monthly mapped into local env
- [x] `STRIPE_SECRET_KEY` (`sk_test_…`) in local `.env.local` — **rotate** (pasted in chat)
- [~] Local webhook: `stripe listen --forward-to localhost:3000/api/webhooks/stripe` running; CLI `whsec_` written to `.env.local` (Dashboard endpoint still needed for staging/Cloud Run)
- [x] `STRIPE_WEBHOOK_SECRET` local — set to **stripe listen** secret for local smoke (rotate chat-pasted Dashboard secret; Cloud Run needs Dashboard endpoint secret)
- [ ] Secrets on staging Cloud Run in **test mode** (`sk_test_…`, test Price IDs, test webhook secret)
- [ ] **Live mode blocked on Stripe identity verification** — do not put `sk_live_…` / live Price IDs / `MSGF_STRIPE_WEBHOOK_LIVE=1` on prod until identity clears
- [ ] After identity: live keys + `npm run verify:msgf-env -w msgf` with `MSGF_STRIPE_WEBHOOK_LIVE=1`

### Webhook events

| Event | Expected profile effect | Status |
| :--- | :--- | :--- |
| `checkout.session.completed` + `pro_individual` | `activateIndividualPerpetualLicense` → lifetime + purchase date | **Done** |
| `checkout.session.completed` + `startup_team` | Company seats + monthly `active` + starter credits + admin role | **Done** (code) |
| `customer.subscription.updated` / `deleted` | Sync `stripe_subscription_status` (active / past_due / canceled) | **Done** (code) |
| `invoice.payment_failed` | Mark profile `past_due` (blocks Pulse when mock off) | **Done** (code) |
| `invoice.paid` (optional) | Confirm renewal / top-up credits policy | **TODO** (decide product rule) |

- [x] Implement Startup Team entitlement write on checkout complete
- [x] Subscription lifecycle → `p4_profiles.stripe_subscription_status`
- [x] Payment-failed path updates status (not only narrative log)
- [x] Unit coverage: `test:stripe-entitlements`
- [x] Apply migration `20260802010000_*` on remote DB (2026-08-02)
- [ ] Local/staging E2E with test cards (below) — `stripe listen` ready; start `npm run dev -w msgf` then `/pricing`

### Staging smoke (test mode)

- [ ] Sign in → `/pricing` → Pro $99 Checkout (test card) → success URL → profile shows perpetual / managed cloud year
- [ ] Sign in → Startup Team Checkout → subscription active → Pulse entitlement passes with mock **off**
- [ ] Cancel / fail invoice (test) → monthly Pulse blocked when live entitlements on
- [ ] Confirm Indie ($0) still works without Stripe (BYOK path unchanged)

### Go-live flip (prod) — after Stripe identity

- [ ] Stripe identity / business verification complete (unblocks live keys)
- [ ] Live keys + live Price IDs + live webhook secret on Cloud Run
- [ ] Set `MSGF_STRIPE_WEBHOOK_LIVE=1` and `MSGF_ENTITLEMENT_MOCK_STRIPE_ACTIVE=0` on prod
- [ ] One real $0.00 / test-to-live dry run with refund if needed — or Stripe test→live checklist signed off
- [ ] Sales copy: self-serve checkout is live (update [`MSGF_PRODUCT_OVERVIEW.md`](./MSGF_PRODUCT_OVERVIEW.md) §9.1 caveat)

---

## 3. Product glue (P1 — after P0 green)

Goal: one narrative — **map → monitor → verify → ship**.

```text
Setup Projects (GitHub / local)
        ↓  project_origin silos
   Dashboard + Pulse Guard (Small Brain)
        ↓  Safe Build / verify-result
Ops: Heal + Sentry + signed audits
        ↓  green verify
Deploy gate → external deploy (Starport etc.)
```

- [ ] Projects hub: last Pulse / last verify / Sentry count per mapping
- [ ] Document + ship verify-gate script for deploy CI (`GET /api/msgf/deploy-gate`)
- [ ] Ops strip: shared `project_origin` filter across Heal | Sentry | audits
- [ ] IDE onboarding: one token; change only `tenantKey` per repo
- [ ] Pulse Guard: quick-switch `tenantKey` when multiple mappings

---

## 4. Parked — boss demo (do not prioritize)

Keep [`MSGF_BOSS_DEMO_RUNBOOK.md`](./MSGF_BOSS_DEMO_RUNBOOK.md) for later. **Not** on the production-ready critical path.

- [ ] Layered demo silos (Starmap / Devlish / Starport)
- [ ] Break → Safe Build fail → Hall → fix → Vault green (live for boss)
- [ ] One-slide narrative for external stack pairing

---

## 5. Explicitly later (P2+)

- [x] Part B: 3-tier dual CONVERGE + T3 quarantine (code landed; enable with `MSGF_CONVERGE_TIER_ENABLED=1`) — [`MSGF_CONVERGE_TIER.md`](./MSGF_CONVERGE_TIER.md)
- [ ] Native Sentry issue create from Pulse RED
- [ ] Session Replay / Logging / Profiling on `@sentry/nextjs` (first-error baseline = errors + tracing only)
- [ ] GitHub App install (org-wide)
- [ ] Nanosecond hot-layer **SLO claim** (infra wired; marketing SLA → 1.1)
- [ ] Stripe Customer Portal / self-serve cancel + invoice history UI (beyond Checkout)

---

## 6. Integration principles

1. **`project_origin` is the join key** across GitHub, local, Sentry, deploy gate, audits.  
2. **MSGF owns governance memory**; Sentry owns runtime; deploy tools own ship.  
3. **UI cross-links**, does not reimplement.  
4. **Unconfigured is OK** — panels degrade; never block admin login.  
5. **RC > demo** — production secrets, migrations, and automated gates before theater.

---

## Changelog

| Date | Note |
| :--- | :--- |
| 2026-08-02 | Stripe webhook entitlement **code done** (§2b); Sentry Next.js SDK wired + local DSN/org/project/token; build blocker + Cloud Run secrets + smokes still open. |
| 2026-08-02 | **Stripe (M3) back in plan** as §2b P0-M3 (after technical P0, before paid claims). Removed from §5 later. |
| 2026-07-24 | Refocus: production RC first; boss demo parked in §4. Added Jul 24 migrations + A5/A6 secrets. |
| 2026-07-24 | `db:push` applied remote Jul 24 migrations incl. company tier rules; Part B + hot layer marked landed. |
| 2026-07-23 | Initial list: GitHub picker + Sentry ship tasks, integration exploration, boss demo. |
