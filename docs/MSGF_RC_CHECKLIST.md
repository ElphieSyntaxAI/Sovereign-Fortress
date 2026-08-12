# MSGF 1.0 RC — Completion checklist (MSGF only)

**Scope:** `packages/msgf` + `msgf-pulse-guard` + ops deploy + **Stripe M3 for paid go-live**. **Out of scope:** Author 1.0 product, Education MVP, boss-demo theater.

**Gate for tag `msgf-v1.0.0`:** All **P0** and **P1** checked; **P0-M3** required before paid self-serve claims; **P2** documented or deferred with owner.

**SSoT context:** [`MSGF_V1_ROADMAP.md`](./MSGF_V1_ROADMAP.md) · [`MSGF_TESTING.md`](./MSGF_TESTING.md) · [`MSGF_BRAIN_ROUTING.md`](./MSGF_BRAIN_ROUTING.md) · [`MSGF_DEV_TODO.md`](./MSGF_DEV_TODO.md) §2b

**Last updated:** 2026-08-11 (bug inbox closed loop)  
**Focus:** Staging smoke + `validate:deployment` + Stripe Checkout. Migrations + core Cloud Run secrets (`MSGF_OPS_CRON_SECRET`, Sentry, Stripe prices) landed on `msgf-api-00068-v4d`.  
**Readiness:** Technical soft-RC **~84%** · Paid self-serve **~68%** — see [`MSGF_V1_ROADMAP.md`](./MSGF_V1_ROADMAP.md) §10.

---

## P0 — Automated gate (blocks RC)

Run from monorepo root. All must pass on a clean machine with env filled.

- [x] `npm run test:unit -w msgf` (includes Jul 24 suites; re-green 2026-08-06 with shadow-proxy / launch hardening)
- [x] `npm run test:stripe-entitlements -w msgf` (2026-08-02)
- [x] `npm run test:tri-consensus -w msgf` (2026-08-05)
- [x] `npm run test:hybrid-crypto -w msgf` / `test:hal-pqc` (2026-08-05)
- [ ] `npm run test:savings -w msgf`
- [x] **Build typing:** `showDirectoryPicker` fixed via `types/file-system-access.d.ts` (2026-08-02). Re-confirm full `next build` / `validate:deployment`.
- [ ] `npm run deep-test:solo -w msgf`
- [ ] `npm run verify:msgf-env -w msgf`
- [x] `npm run db:push` applied `20260802010000_p4_profiles_stripe_subscription.sql` (2026-08-02)
- [x] `npm run db:push` / verify for `20260805010000_tri_consensus_config.sql` (TRI + xAI provider) — 2026-08-06
- [x] `npm run db:push` for `20260806010000`–`20260806030100` (usage / period / shadow eval) — 2026-08-06
- [x] `npm run db:push` for `20260806200000_launch_governance_writers.sql` (proven/usage audit columns) — 2026-08-06
- [x] `npm run db:push:verify -w msgf` — 2026-08-06 green
- [ ] `npm run validate:deployment` (unit + production `next build`)
- [x] Jul 24 pitfall/integration unit suites: `test:a4-compound-scope`, `test:i5-webhook-queue`, `test:i4-dropbox-archive`, `test:a5-skip-audit`, `test:a6-arbitrate-audit`, `test:converge-tier-classifier`, `test:converge-tier-escalation`, `test:converge-tier-quarantine`, `test:hot-layer-fast-read`
- [x] Migration `20260724030400_msgf_company_tier_rules.sql` applied on remote (2026-07-24 `db:push`)
- [x] Migration `20260802010000_p4_profiles_stripe_subscription.sql` applied on remote (2026-08-02)
- [x] Launch hardening code: gateway auth, header allowlist, dashboard IDOR, Active Orchestrator (2026-08-06)

**Integration (needs Supabase / Redis env):**

- [ ] `npm run test:integration -w msgf`
- [ ] `npm run test:ingest-workflow -w msgf`
- [ ] `npm run test:v32-ultra -w msgf`
- [ ] `npm run bootstrap:solo -w msgf` → `npm run probe:solo -w msgf` (staging URL)

**Heal / brain / HAL:**

- [ ] `npm run test:heal-queue -w msgf`
- [ ] `npm run test:human-arbitration -w msgf`
- [ ] `npm run test:remediation-circuit -w msgf`
- [ ] `npm run test:brain-routing -w msgf`
- [ ] `npm run test:heal-queue-audience -w msgf`
- [ ] `npm run test:hal-word-chunk -w msgf`

---

## P0 — Staging smoke (manual, one tenant)

Document date + operator + tenant id in changelog when done.

- [ ] Sign pledge → Pulse baseline (cookie or license)
- [ ] `POST /api/msgf/ingest` — confirm `lineage_map`, `brain_readiness`
- [ ] `GET /api/msgf/heal-queue` — user session: `audience_scope: user`, no arbitration packages
- [ ] Admin session: full queue + `POST .../human-arbitration` on circuit-open row (if present)
- [ ] `/admin/dashboard#token-savings` + `#big-brain-issues` load live data
- [ ] Reports: period history + Shadow Proxy panel; PDF download for own tenant
- [ ] `POST /api/v1/chat/completions` shadow mode with valid `x-msgf-key` → projected eval row
- [ ] Active mode returns `x-msgf-routing`; spoofed `x-msgf-tenant-id` does not change attribution
- [ ] Foreign `tenant_id` on period-reports / shadow-eval → 403
- [ ] `POST /api/msgf/ops/v32-heartbeat` with `{"dry_run":true}` — 200 + expected summary
- [ ] `/setup/projects` — monorepo preset creates row with correct `project_origin`
- [ ] Sentry SDK: `GET /api/sentry-test` → issue in project `msgf` → delete route

---

## P1 — V3.2 engine (§2.6 three partials → Done)

### CROSS-REF

- [ ] Pulse route uses thin-handler / pipeline path with Vault/Hall `preFlightCheck` on live requests
- [ ] Invalid `bug_index` / pillar metadata rejected before consensus (Zod + DB trigger aligned)
- [ ] Staging RED path: DEFEND preflight block or CROSS-REF short-circuit observable in response metadata

### CONVERGE

- [ ] Staging: logic drift above threshold invokes dual-model (`global_converge` or documented bypass with reason)
- [ ] IDE dev-event / dev-session paths confirmed **never** hit biometric → CONVERGE chain
- [ ] `npm run test:savings-qa-checkpoints -w msgf` (checkpoints 18–19) green

### ARBITRATE

- [ ] LOM harness: `MSGF_ENABLE_LOM_TEST=1` + `test:lom-disagreement` on staging dev server
- [ ] Live Cloud Run: heal-queue E2E — circuit breaker → human arbitration approve/deny
- [ ] Cron skips `PENDING_HUMAN_ARBITRATION` (verify in heartbeat logs)

### Bug inbox (closed loop)

- [x] Schema: `inbox_status` + reopen RPC applied (`20260811010000` / `20260811020000`) — 2026-08-11
- [ ] Staging: onscreen FAB on `/dashboard` → row appears in `/admin/ops#bug-inbox` as `open`
- [ ] Staging: **Promote** → `msgf_incidents` USER_SENTINEL pending in ARBITRATE
- [ ] Staging: **Dismiss** then re-submit same message/location → inbox reopens as `open`

---

## P1 — Production ops (no mock authority)

- [x] `MSGF_OPS_CRON_SECRET` on Cloud Run `msgf-api` (2026-08-06 revision `00068-v4d`)
- [ ] GitHub Actions `msgf-tier-heartbeat.yml` wired to that secret
- [~] `MSGF_SKIP_AUDIT_SECRET` and/or `MSGF_ARBITRATE_AUDIT_KEY` (may reuse ops cron secret — confirm fallback works)
- [x] Jul 24 + Aug 2026 migrations applied on remote (`db:push:verify` 2026-08-06)
- [x] Upstash on Cloud Run — hot layer configured
- [x] Supabase service role on deploy
- [ ] Eco rollups / public eco metrics: UI gated on `source === "live"` or errors surfaced
- [ ] Demo streams (`v32_mock_stream`, fake ticker events) disabled or ops-only in production
- [ ] `npm run verify:brain-routing -w msgf` on staging (live smoke)
- [ ] Ops: Signed HITL audit verify + Skip-MSGF audit panels load for an admin session
- [ ] `v32-heartbeat` dry-run → 200 with ops secret

### Sentry (SDK + ops)

- [x] `@sentry/nextjs` wired in `packages/msgf` (errors + tracing; tunnel `/monitoring`)
- [x] Local env: DSN, `SENTRY_ORG_SLUG=elphie-syntax-llc`, `SENTRY_PROJECT_SLUG=msgf`, auth token, `SENTRY_BASE_URL=https://us.sentry.io`
- [x] Cloud Run: `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` + auth token + org/project (2026-08-06)
- [ ] Rotate auth token; ensure scopes cover ops panel read (+ Resolve if needed)
- [ ] Ops panel Load issues smoke
- [ ] Delete `app/api/sentry-test` after first verified event

---

## P1 — MSGF product surface (gatedai)

- [ ] Landing, pricing, workspace, `/status`, extension download routes work on staging
- [ ] Token savings panel (user) + admin catalog + pulse routing mix — live Redis counters
- [ ] Credit guard / reservation: 402 path tested with reservation enabled
- [ ] Solo integrator: license mint + `probe:solo` against production/staging gatedai URL

---

## P0-M3 — Stripe / paid entitlements (blocks paid claims)

Full detail: [`MSGF_DEV_TODO.md`](./MSGF_DEV_TODO.md) §2b.

**Code (2026-08-02):** Startup Team checkout activation · subscription updated/deleted · `invoice.payment_failed` → `past_due` · entitlement mock/live · env verifier Price IDs when live · `test:stripe-entitlements`.

- [x] Stripe test Price IDs mapped: Pro perpetual `price_1TzvlH45Z9uJcKXAiX8a5IF` → `STRIPE_PRICE_PRO_INDIVIDUAL`; Startup monthly `price_1TzwGGH45Z9uJcKXaWckdzAt` → `STRIPE_PRICE_STARTUP_TEAM` (Solo Pro + yearly kept in Stripe, not in app yet)
- [x] `STRIPE_SECRET_KEY` (test) + Price IDs in local `.env.local`
- [x] Price IDs on Cloud Run `msgf-api` (2026-08-06)
- [~] Local `stripe listen` → `localhost:3000/api/webhooks/stripe` (CLI `whsec_` in `.env.local`); staging Dashboard webhook still open
- [x] Startup Team checkout writes seats / `stripe_subscription_status=active` (code)
- [x] Subscription updated/deleted + payment_failed update profile status (code)
- [x] Apply `20260802010000_p4_profiles_stripe_subscription.sql` on remote (2026-08-02)
- [ ] Staging/local smoke (test cards): Pro $99 → perpetual; Startup Team → Pulse with mock off
- [ ] **Live / paid claims** blocked until Stripe **identity verification** completes
- [ ] Prod flip (post-identity): live keys + `MSGF_STRIPE_WEBHOOK_LIVE=1` + `MSGF_ENTITLEMENT_MOCK_STRIPE_ACTIVE=0`
- [ ] Indie $0 BYOK path still works without Stripe

---

## P2 — MSGF RC sign-off (M6)

- [ ] **Runbook:** deploy (`validate:deployment` → `./deploy.sh` / `setup-cloud.sh`), cron, rollback, on-call for arbitration queue
- [ ] **Load smoke:** concurrent Pulse + ingest on staging (modest RPS)
- [ ] **Prancer:** `npm run security:prancer-pillars` green on PR
- [ ] **§7.1 audit:** each mock/dead-end route either fixed, gated, or listed as ops-only in runbook
- [ ] Tag `msgf-v1.0.0` with release notes pointing to this checklist

---

## Explicitly not required for MSGF technical soft-RC

| Item | Track |
| :--- | :--- |
| Stripe live keys / mock-off | **Required for paid go-live (P0-M3)** — soft-RC + test-mode checkout OK; live blocked on Stripe identity |
| Sentry Session Replay / Logging / Profiling | P2 — first-error baseline is errors + tracing only |
| `packages/msgf/apps/web` split | Optional M2 polish |
| Author BFF healing popout | Author 1.x |
| Education LTI / sandbox MVP | [`syntax-education/ROADMAP.md`](./syntax-education/ROADMAP.md) |
| Nanosecond hot-layer SLO | 1.1 |
| Full Pulse monolith → modular route refactor | 1.1 minimum if RED path green |

---

## Ecosystem minimum (optional for RC tag — only if M5 in gate)

MSGF can RC without these; include if your gate requires M5:

- [ ] `npm run probe:author-ecosystem -w msgf` on staging
- [ ] One `tenant_education` Pulse smoke

---

## Changelog

| Date | Note |
| :--- | :--- |
| 2026-08-06 | Migrations `db:push:verify` green; Cloud Run `msgf-api-00068-v4d` got `MSGF_OPS_CRON_SECRET` + Sentry + Stripe Price IDs. Remaining soft-RC: staging smokes, heartbeat Action, `validate:deployment`. |
| 2026-08-05 | TRI + PQC unit gates noted; TRI migration still to push; readiness soft-RC ~84% / paid ~68%. |
| 2026-08-02 | Marked Stripe entitlement **code** + Sentry SDK local wiring done; added build blocker, Stripe migration, Sentry Cloud Run / verify smokes; P0-M3 still blocked on Prices + staging smoke + mock-off. |
| 2026-08-02 | Stripe M3 added as **P0-M3** (paid go-live gate); no longer “out of scope.” |
| 2026-07-24 | Prod-first focus; A4–A6 / I4–I5 suites + audit secrets + migration notes. Boss demo deferred. |
| 2026-05-20 | Initial MSGF-only RC checklist (P0–P2). |
| 2026-05-20 | Build fixes: `ide-connector` devSession default, `PostIngestHealingConsole` null queue, `PulseRoutingKind` alias, `heal-queue-audience` RemediationTask types. |
