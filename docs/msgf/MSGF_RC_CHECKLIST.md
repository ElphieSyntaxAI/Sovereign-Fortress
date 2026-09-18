# MSGF 1.0 RC — Completion checklist (MSGF only)

**Scope:** `packages/msgf` + `msgf-pulse-guard` + ops deploy + **Stripe M3 for paid go-live**. **Out of scope:** Author 1.0 product, Education MVP, boss-demo theater.

**Gate for tag `msgf-v1.0.0`:** All **P0** and **P1** checked; **P0-M3** required before paid self-serve claims; **P2** documented or deferred with owner.

**SSoT context:** [`MSGF_V1_ROADMAP.md`](./MSGF_V1_ROADMAP.md) · [`MSGF_TESTING.md`](./technical-specs/MSGF_TESTING.md) · [`MSGF_BRAIN_ROUTING.md`](./technical-specs/MSGF_BRAIN_ROUTING.md) · [`MSGF_GLOBAL_BRAIN_TELEMETRY.md`](./technical-specs/MSGF_GLOBAL_BRAIN_TELEMETRY.md) · [`MSGF_DEV_TODO.md`](./MSGF_DEV_TODO.md) §2b

**Last updated:** 2026-09-18 (P7 closed loop + Shadow apply-on-activate in code; Stripe mock may still be ON)  
**Focus:** Apply Sept 18 schema → one-tenant staging smoke (incl. swarm + Shadow CTA + audit hub chips) → technical soft-RC; live Checkout smoke → mock-off. Confirm Sept 2026 schema (`20260914200000_shadow_trial_*`, `20260915120000_governance_audit_platform.sql`, `20260915130000_trusted_license_allowlist.sql`, `20260918010000_tenant_default_ai_provider.sql`, `20260918120000_p7_prompt_shadow_deferred.sql`) on staging/prod.  
**Readiness:** Technical soft-RC **~90%** · Paid self-serve **~82%** — P7/swarm/Shadow loop is **code-complete**; remaining = live schema + staging smoke. See [`MSGF_V1_ROADMAP.md`](./MSGF_V1_ROADMAP.md) §10.

---

## P0 — Automated gate (blocks RC)

Run from monorepo root. All must pass on a clean machine with env filled.

- [x] `npm run test:unit -w msgf` (includes Jul 24 suites + heal-queue / human-arbitration / remediation-circuit / stripe / TRI / PQC / shadow-proxy / swarm-guard / global-brain-swarm / **p7-observe**; re-green 2026-09-11 via `validate:deployment`; p7-observe added 2026-09-18)
- [x] `npm run test:stripe-entitlements -w msgf` (2026-08-02)
- [x] `npm run test:tri-consensus -w msgf` (2026-08-05)
- [x] `npm run test:hybrid-crypto -w msgf` / `test:hal-pqc` (2026-08-05)
- [ ] `npm run test:savings -w msgf` (full savings bundle; not included in `test:unit`)
- [x] **Build typing:** `showDirectoryPicker` fixed via `types/file-system-access.d.ts` (2026-08-02). Full `next build` re-confirmed via `validate:deployment` 2026-09-11.
- [x] `npm run deep-test:solo -w msgf` — 2026-09-11 green
- [x] `npm run verify:msgf-env -w msgf` — 2026-09-11 green
- [x] `npm run db:push` applied `20260802010000_p4_profiles_stripe_subscription.sql` (2026-08-02)
- [x] `npm run db:push` / verify for `20260805010000_tri_consensus_config.sql` (TRI + xAI provider) — 2026-08-06
- [x] `npm run db:push` for `20260806010000`–`20260806030100` (usage / period / shadow eval) — 2026-08-06
- [x] `npm run db:push` for `20260806200000_launch_governance_writers.sql` (proven/usage audit columns) — 2026-08-06
- [x] `npm run db:push:verify -w msgf` — 2026-08-06 green
- [x] `npm run validate:deployment` (unit + production `next build`) — 2026-09-11 green
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

- [x] `npm run test:heal-queue -w msgf` — covered by `test:unit` (2026-09-11)
- [x] `npm run test:human-arbitration -w msgf` — covered by `test:unit`
- [x] `npm run test:remediation-circuit -w msgf` — covered by `test:unit`
- [ ] `npm run test:savings -w msgf` (full savings bundle; not the same as `test:unit`)
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
- [ ] Swarm abort (Active or Pulse with child-agent headers) → HITL + tenant audit `blocked_keys`; Global Brain JSON has **no** key lists
- [ ] Shadow trial proof shows would-have promoted/blocked counts; **Start 3-day full access** applies deferred P7 once (`p7_applied_at` set)
- [ ] `/admin/ops` audit hub: `p7=promoted` / `p7=blocked` chips + `q=` matches `promoted_keys` / `blocked_keys`

---

## P0 — P7 closed loop (code Done 2026-09-18; schema + smoke open)

- [x] Live writes: swarm detected, ingest, HITL, Sentry quarantine, heal-queue APPROVE/DENY, confirm-pack, verify-result, Active gateway (`lib/services/p7-observe.ts`)
- [x] Read/steer: Active P7 poison wins over model-fitness; swarm admission prune; agent-context packs omit pruned tasks
- [x] Shadow observe-only + apply-once on 3-day CTA; paid Active never queues deferred P7
- [x] Decay (30-day half-life) + `prompt:{sha256}` resource keys; Session Replay **not** removed
- [x] `npm run test:p7-observe -w msgf` (included in `test:unit`)
- [x] `npm run db:push -w msgf` for `20260918120000_p7_prompt_shadow_deferred.sql` (prompt ledger CHECK + shadow `p7_*` columns) — 2026-09-18
- [x] `npm run verify:db-schema -w msgf` reports Shadow P7 columns + reputation ledger `'prompt'` — 2026-09-18
- [ ] Follow-up (does not block soft-RC): Pulse `x-msgf-prompt-hash` → `prompt:{sha256}` on PulseEngine hits (gateway already wired)

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

- [x] Stripe test Price IDs mapped (historical): Pro perpetual `price_1TzvlH45Z9uJcKXAiX8a5IF`; Startup monthly `price_1TzwGGH45Z9uJcKXaWckdzAt`
- [x] Live Price IDs on Cloud Run `msgf-api-00077-7qx` (2026-09-11): Pro perpetual `price_1UEN2uQjFFioI1PaY9uZ3XxO`; Startup monthly `price_1UEN30QjFFioI1Pamsh3dVyt`
- [x] Live `STRIPE_SECRET_KEY` + publishable key in Secret Manager (not plaintext env)
- [x] Live Dashboard webhook `we_1UENAyQjFFioI1PaFD1qdZgJ` + `STRIPE_WEBHOOK_SECRET` in Secret Manager
- [x] Startup Team checkout writes seats / `stripe_subscription_status=active` (code)
- [x] Subscription updated/deleted + payment_failed update profile status (code)
- [x] Apply `20260802010000_p4_profiles_stripe_subscription.sql` on remote (2026-08-02)
- [x] Stripe **identity verification** complete (charges + payouts enabled; `details_submitted`)
- [ ] Live Checkout smoke: Pro $99 → perpetual; Startup Team $49/mo → webhook entitlements
- [ ] Prod flip: `MSGF_STRIPE_WEBHOOK_LIVE=1` + `MSGF_ENTITLEMENT_MOCK_STRIPE_ACTIVE=0`
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
| Stripe live keys / mock-off | **Required for paid go-live (P0-M3)** — live keys + identity + webhook landed 2026-09-11; soft-RC still OK with mock ON until Checkout smoke + mock-off |
| Sentry Session Replay / Logging / Profiling | P2 — first-error baseline is errors + tracing only (**not** MSGF Session Replay — that ships on `/admin/ops#session-replay`) |
| `packages/msgf/apps/web` split | Optional M2 polish |
| Author BFF healing popout | Author 1.x |
| Education LTI / sandbox MVP | [`syntax-education/ROADMAP.md`](../syntax-education/ROADMAP.md) |
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
| 2026-09-18 | **P7 closed loop:** live writes across swarm/ingest/HITL/Sentry/heal-queue/confirm-pack/verify/Active; Shadow deferred apply-on-activate; audit hub promoted vs blocked lists; `test:p7-observe`. Schema `20260918120000` + staging smokes still open. Soft-RC stays ~90%. |
| 2026-09-17 | **Global Brain zero-text swarm telemetry** + `test:swarm-guard` / `test:global-brain-swarm` in `test:unit`. Docs re-sync with V1 roadmap: heal-queue unit tests marked covered by `test:unit`; remaining P0 = savings/brain/hal-word + integration + staging smoke. |
| 2026-09-11 | **P0-M3:** live Stripe keys + webhook + live Price IDs on `msgf-api-00077-7qx`; identity done. Mock still ON. Remaining paid: Checkout smoke + mock-off + BYOK. **P0 automated:** `validate:deployment`, `deep-test:solo`, `verify:msgf-env` green. |
| 2026-08-06 | Migrations `db:push:verify` green; Cloud Run `msgf-api-00068-v4d` got `MSGF_OPS_CRON_SECRET` + Sentry + Stripe Price IDs. Remaining soft-RC: staging smokes, heartbeat Action, `validate:deployment`. |
| 2026-08-05 | TRI + PQC unit gates noted; TRI migration still to push; readiness soft-RC ~84% / paid ~68%. |
| 2026-08-02 | Marked Stripe entitlement **code** + Sentry SDK local wiring done; added build blocker, Stripe migration, Sentry Cloud Run / verify smokes; P0-M3 still blocked on Prices + staging smoke + mock-off. |
| 2026-08-02 | Stripe M3 added as **P0-M3** (paid go-live gate); no longer “out of scope.” |
| 2026-07-24 | Prod-first focus; A4–A6 / I4–I5 suites + audit secrets + migration notes. Boss demo deferred. |
| 2026-05-20 | Initial MSGF-only RC checklist (P0–P2). |
| 2026-05-20 | Build fixes: `ide-connector` devSession default, `PostIngestHealingConsole` null queue, `PulseRoutingKind` alias, `heal-queue-audience` RemediationTask types. |
