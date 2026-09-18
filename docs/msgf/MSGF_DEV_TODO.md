# MSGF — Dev TODO & production readiness

**Audience:** Jessica / MSGF engineering  
**Status:** Living checklist for **MSGF 1.0 production readiness** (gatedai + Pulse Guard + ops).  
**Last updated:** 2026-09-18 (P7 closed loop + Shadow apply-on-activate in code; Global Brain zero-text swarm telemetry; live Stripe keys still mock-ON until Checkout smoke)

**Priority now:** Apply Sept 18 schema → one-tenant staging smoke (incl. swarm + Shadow CTA + audit hub) → technical soft-RC; then live Checkout smoke → flip `MSGF_STRIPE_WEBHOOK_LIVE=1` + mock off.

**Launch readiness (SSoT):** [`MSGF_V1_ROADMAP.md`](./MSGF_V1_ROADMAP.md) §10 — **soft-RC ~90%** · **paid self-serve ~82%** (P0 automated gates green 2026-09-11; P7/swarm code landed 2026-09-18; remaining RC = live schema + smoke; remaining paid = Checkout + mock-off).

**Related:** [`MSGF_RC_CHECKLIST.md`](./MSGF_RC_CHECKLIST.md) · [`MSGF_DEPLOY_CHECKLIST.md`](./MSGF_DEPLOY_CHECKLIST.md) · [`MSGF_V1_ROADMAP.md`](./MSGF_V1_ROADMAP.md) · [`MSGF_BUYER_WALKTHROUGH.md`](./marketing/MSGF_BUYER_WALKTHROUGH.md) · [`MSGF_SHADOW_PROXY.md`](./technical-specs/MSGF_SHADOW_PROXY.md) · [`MSGF_GLOBAL_BRAIN_TELEMETRY.md`](./technical-specs/MSGF_GLOBAL_BRAIN_TELEMETRY.md) · [`MSGF_PRODUCT_OVERVIEW.md`](./marketing/MSGF_PRODUCT_OVERVIEW.md) · [`MSGF_TESTING.md`](./technical-specs/MSGF_TESTING.md) · [`MSGF_BRAIN_ROUTING.md`](./technical-specs/MSGF_BRAIN_ROUTING.md) · [`MSGF_PQC_CRYPTO_AUDIT.md`](./technical-specs/MSGF_PQC_CRYPTO_AUDIT.md) · [`MSGF_SENTRY.md`](../integrations/technical-specs/MSGF_SENTRY.md)

---

## 0. How to use this list

- `[ ]` = not done · `[~]` = in progress · `[x]` = done  
- **P0** blocks technical soft-RC · **P0-M3** blocks **paid** go-live · **P1** product glue · **P2** polish  
- Do **not** block soft-RC on boss-demo (§4) or Education/Author full product RC.

---

## 1. Production gate (P0) — do these first

Canonical: [`MSGF_RC_CHECKLIST.md`](./MSGF_RC_CHECKLIST.md).

### 1.1 Schema on the live DB

- [x] Jul 24 wave + Stripe entitlement migration applied (2026-07-24 / 2026-08-02)
- [x] Apply TRI consensus migration `20260805010000_tri_consensus_config.sql` (`msgf_tenant_consensus_config` + xAI provider CHECK) — 2026-08-06 `db:push`
- [x] Apply provider usage / proven savings migration `20260806010000_provider_usage_proven_savings.sql` — 2026-08-06
- [x] Apply period savings reports migration `20260806020000_period_savings_reports.sql` — 2026-08-06
- [x] Apply shadow evaluation logs migration `20260806030000_shadow_evaluation_logs.sql` (+ `…30100` shadow USD column) — 2026-08-06
- [x] Apply launch governance writers migration `20260806200000_launch_governance_writers.sql` (proven/usage audit columns) — 2026-08-06
- [x] `npm run db:push:verify -w msgf` after TRI + usage + shadow + governance migrations — 2026-08-06 green
- [x] Apply bug inbox migrations `20260811010000_p4_active_incidents_bug_inbox.sql` + `20260811020000_p4_upsert_reopen_bug_inbox.sql` — 2026-08-11 `db:push`
- [ ] Confirm Sept 2026 schema on live DB: `20260914200000_shadow_trial_7d_full_access.sql`, `20260915120000_governance_audit_platform.sql`, `20260915130000_trusted_license_allowlist.sql`, `20260918010000_tenant_default_ai_provider.sql`, `20260918120000_p7_prompt_shadow_deferred.sql`

### 1.1b Launch hardening (code Done 2026-08-06)

- [x] Gateway auth hardening (`authenticateGatewayKey` — never trust `x-msgf-tenant-id`; `msgf_live_*` / `msgf_test_*` / `msgf_ide_*`)
- [x] Upstream header allowlist + Pulse trust-header strip
- [x] Dashboard tenant IDOR guard on shadow/period/savings/security routes
- [x] Active Governance Orchestrator (`x-msgf-mode: active` — PromptIR + cache + state-gate + sharded upstream)
- [x] DEFEND / Passive IDE Scan disambiguation (aliases + docs; Shadow Proxy name reserved)
- [x] Durable proven/usage PG writers (Redis hot path + best-effort insert)
- [x] `npm run test:unit -w msgf` green including `test:shadow-proxy` (2026-08-06)
- [x] Product overview + marketing cards + Shadow Proxy doc refreshed (2026-08-06)

### 1.2 Automated gates

- [x] `npm run test:unit -w msgf` (re-green 2026-08-06 after launch hardening)
- [x] `npm run test:stripe-entitlements -w msgf`
- [x] `npm run test:tri-consensus -w msgf` (majority vote + presets + notify threshold)
- [x] `npm run test:hybrid-crypto -w msgf` / `test:hal-pqc` (PQC)
- [x] Build typing: `showDirectoryPicker` via `types/file-system-access.d.ts`
- [x] `npm run validate:deployment` (unit + production `next build`) — 2026-09-11 green (Windows `.next` EPERM reuse if OneDrive locks the cache)
- [x] `npm run deep-test:solo -w msgf` — 2026-09-11 green
- [x] `npm run verify:msgf-env -w msgf` — 2026-09-11 green (optional: `MSGF_ENABLE_LOM_TEST`, `MSGF_INGEST_API_KEY`)

### 1.3 Cloud Run / ops secrets

| Env | Purpose | Status |
| :--- | :--- | :--- |
| Upstash Redis | Hot layer + gateway completion cache | **Done** on `msgf-api` (REST URL + token) |
| `MSGF_OPS_CRON_SECRET` | Heartbeat / audits | **Done** — generated + deployed `msgf-api-00068-v4d` (2026-08-06) |
| Sentry DSN + auth token + org/project | SDK + ops panel | **Done** on Cloud Run (copied from local) |
| Stripe live keys + live Price IDs + webhook secret | Paid path | **Done** Secret Manager on `msgf-api-00077-7qx` (2026-09-11); mock entitlements still ON |
| `XAI_API_KEY` + `MSGF_TRI_CONSENSUS_ENABLED=1` | Big Brain TRI | Optional until TRI live |
| `MSGF_HYBRID_KEM_ENABLED=1` | Quantum-ready envelopes | Optional; document when on |
| `MSGF_ACTIVE_AGGRESSIVENESS` | Active gateway default (`shard-and-route`) | Optional |
| `ALLOW_DEMO_TENANT` | Non-prod gateway demo tenant only | Never on prod |

- [x] Core secrets on prod Cloud Run `msgf-api` (ops cron + Sentry + Stripe prices) — 2026-08-06
- [ ] GH Actions `msgf-tier-heartbeat.yml` wired to use `MSGF_OPS_CRON_SECRET`
- [ ] `/admin/ops` live data (not mock pillar health)
- [ ] `v32-heartbeat` dry-run → 200 with new ops secret

### 1.4 Staging smoke (one real tenant)

- [ ] Pledge → Pulse → ingest → heal-queue
- [ ] Admin ARBITRATE → signed HITL audit verify
- [ ] Safe Build / verify-result → deploy-gate green
- [ ] Sentry panel Load issues (token scopes)
- [ ] SDK: `GET /api/sentry-test` → delete route after
- [ ] CONVERGE preset UI `/dashboard#token-savings` saves balanced_dual
- [ ] `probe:solo` against staging gatedai URL
- [ ] Shadow Proxy: OpenAI client → `/api/v1/chat/completions` with `x-msgf-key` → shadow-eval panel shows projected row
- [ ] Active mode: same request with `x-msgf-mode: active` → `x-msgf-routing` header present; spoofed `x-msgf-tenant-id` ignored
- [ ] Period reports PDF downloads for caller’s tenant only (403 on foreign tenant_id)
- [ ] Swarm abort writes tenant `blocked_keys`; Global Brain JSON has no key lists
- [ ] Shadow 3-day CTA applies deferred P7 once; audit hub `p7=` chips searchable

### 1.5 Product surfaces

- [ ] Landing / features / pricing / waitlist `/sign-up` / `/shadow-trial` / workspace / `/status` / extension download on staging
- [x] Marketing copy updated (TRI, Sentry, DocuSign/Dropbox Sign, quantum-ready) — 2026-08-05
- [x] Marketing + product overview updated for Shadow Proxy / Active Governance / proven vs projected — 2026-08-06
- [ ] Pulse Guard: `msgf.enabled` + tenantKey + token on a real workspace

---

## 2. Integrations already built (finish smokes)

### Sentry

- [x] `@sentry/nextjs` wired
- [x] Cloud Run DSN + auth token + org/project on `msgf-api` (2026-08-06)
- [ ] Ops panel Load issues smoke; quarantine demote/restore
- [ ] Rotate auth token when convenient (scopes cover panel read)

### GitHub picker

- [ ] OAuth App + `CRYPTO_SECRET_KEY` / KMS; Connect → `/setup/projects` smoke

### Signing (DocuSign / Dropbox Sign)

- [ ] Provider secrets when live; invite → webhook → IDE mint unlocked

### TRI / Grok

- [x] Config SSoT + Pulse majority + tenant API/UI + unit tests
- [x] `db:push` TRI migration (2026-08-06); enable flags on staging with `XAI_API_KEY` still open
- [ ] Soft-escalate + bias_mitigated preset smoke (Claude+Grok BYOK)

### PQC

- [x] Hybrid KEM `0x03` + ML-DSA HAL v2 + audit doc
- [ ] Decide prod default for `MSGF_HYBRID_KEM_ENABLED` (off until ops ready)
- [ ] Platform PQ-TLS checklist on Cloud Run LB ([`MSGF_PQC_CRYPTO_AUDIT.md`](./technical-specs/MSGF_PQC_CRYPTO_AUDIT.md) §6)

### Provider gateway

- [x] Shadow Proxy + Active Orchestrator + auth/header hardening (code)
- [ ] Staging smoke items in §1.4
- [ ] Document Cloud Run CORS / timeout for long SSE if needed

---

## 2b. Stripe / paid entitlements (P0-M3)

**Code Done (2026-08-02):** Startup Team + subscription lifecycle + `past_due` + test Price IDs + migration.  
**Live keys (2026-09-11):** Secret Manager on `msgf-api-00077-7qx`; live webhook `we_1UENAyQjFFioI1PaFD1qdZgJ`; identity submitted (charges + payouts enabled). Mock entitlements still ON until Checkout smoke.

- [x] Test Price IDs mapped; entitlement writers; unit tests
- [x] Live Price IDs on Cloud Run `msgf-api` — Pro perpetual `price_1UEN2uQjFFioI1PaY9uZ3XxO`; Startup monthly `price_1UEN30QjFFioI1Pamsh3dVyt` (2026-09-11)
- [x] Live secret + publishable keys in Secret Manager (`stripe-secret-key` / `stripe-publishable-key`)
- [x] Live Dashboard webhook + `STRIPE_WEBHOOK_SECRET` in Secret Manager
- [x] Stripe **identity verification** (account `details_submitted`; charges + payouts enabled)
- [ ] Live Checkout smoke: Pro $99 perpetual + Startup Team $49/mo → webhook writes entitlements
- [ ] Prod flip: `MSGF_STRIPE_WEBHOOK_LIVE=1` + `MSGF_ENTITLEMENT_MOCK_STRIPE_ACTIVE=0` (after smoke)
- [ ] Indie $0 BYOK still works without Stripe
- [ ] Archive leftover live Stripe product **Test product** ($19.99/mo) if unused

---

## 3. Product glue (P1 — after P0 green)

- [ ] Projects hub: last Pulse / verify / Sentry count per mapping
- [ ] Deploy-gate CI script documented
- [ ] Ops strip: shared `project_origin` filter
- [ ] Pulse Guard: quick-switch `tenantKey`
- [ ] Post-proxy onboarding funnel: Shadow projected → enable Active → proven dashboard

---

## 4. Parked — boss demo

Not on critical path. See [`MSGF_BOSS_DEMO_RUNBOOK.md`](./marketing/MSGF_BOSS_DEMO_RUNBOOK.md).

---

## 5. Explicitly later (P2+)

- [x] Part B CONVERGE tiers (flagged)
- [x] TRI Big Brain + tenant presets (flagged)
- [x] Hybrid PQC envelopes (flagged)
- [x] Shadow Proxy + Active Governance (launch cut — hash cache / state-gate; embedding semantic + dual chat wire deferred)
- [x] **P7 Source Audit & Resource Reputation** (closed loop 2026-09-18: live writes on swarm/ingest/HITL/Sentry/heal-queue/confirm-pack/verify/Active; read-steer on Active + swarm + agent context; Shadow deferred apply-on-activate; decay + `prompt:{hash}`; non-blocking; prune/boost; attribution_class; reverse impact). Remaining: Pulse `x-msgf-prompt-hash` wiring + live schema.
- [x] Admin provenance search + `/account` hub + Stripe Customer Portal API (nav/ops pass)
- [x] **Bug inbox** — `p4_active_incidents` triage → promote to ARBITRATE / dismiss; FAB on dashboard + workspace; self-heal upserts inbox; reopen dismissed on re-report
- [ ] Embedding semantic similarity cache on `/api/v1`
- [ ] Dual/TRI chat completion synthesis on Active escalate
- [ ] Sentry issue create from Pulse RED
- [ ] **Sentry** Session Replay / Logging / Profiling (P2 — distinct from MSGF Session Replay on `/admin/ops#session-replay`, which is **shipped**)
- [ ] GitHub App (org-wide)
- [ ] Nanosecond hot-layer **SLO claim**
- [ ] Stripe Customer Portal **invoice history UI** (`/account` + portal session API already shipped)
- [ ] Platform PQ-TLS (GCP LB)

---

## 6. Integration principles

1. **`project_origin` is the join key.**  
2. **MSGF owns governance memory**; Sentry owns runtime.  
3. **Unconfigured is OK** — panels degrade.  
4. **RC > demo.**  
5. **Do not claim “HTTPS is post-quantum”** without platform PQ-TLS — claim **app-layer hybrid KEM** for vault secrets / HAL v2.  
6. **Shadow projected ≠ proven eco** — never merge in public eco or sales slides.  
7. **Gateway tenant always from license/IDE DB** — never from client `x-msgf-tenant-id`.  
8. **Global Brain swarm telemetry is zero-text** — never train on prompts; Session Replay is tenant legal/security, not the Global Brain feed ([`MSGF_GLOBAL_BRAIN_TELEMETRY.md`](./technical-specs/MSGF_GLOBAL_BRAIN_TELEMETRY.md)).

---

## Changelog

| Date | Note |
| :--- | :--- |
| 2026-09-18 | **P7 closed loop** (no longer Pulse-only): live writes + steer + Shadow apply-on-activate + audit hub lists + `test:p7-observe`. Add `20260918120000` / `20260918010000` to live schema confirm. Remaining = schema apply + staging smoke + Checkout smoke + mock-off. Optional follow-up: Pulse `x-msgf-prompt-hash`. |
| 2026-09-17 | **Global Brain zero-text swarm telemetry** + pledge `2026.09.18-UTAH-SAFE`. Docs re-sync with V1 roadmap + buyer walkthrough. Added Sept 2026 schema confirm (shadow trial / governance audit / trusted-OSS). Remaining = staging smoke + Checkout smoke + mock-off. |
| 2026-09-11 | **Live Stripe:** identity done; live keys + webhook + live Price IDs on `msgf-api-00077-7qx` via Secret Manager. Mock still ON. Next = live Checkout smoke → mock-off. Supabase project restored from pause; `/health` healthy. **P0 gates:** `validate:deployment`, `deep-test:solo`, `verify:msgf-env` green. |
| 2026-08-11 | **Bug inbox** + FAB closed loop (migrations applied); account hub + Stripe portal API; provenance search; ops `project_origin` + resolved incidents; prefrontal marketing. |
| 2026-08-10 | P7 Source Audit shipped (migration + Pulse hooks + dashboard API/panel + unit tests). Apply remote schema via `db:push:verify`. |
| 2026-08-06 | Cloud Run `msgf-api-00068-v4d`: `MSGF_OPS_CRON_SECRET` + Sentry + Stripe Price IDs deployed; schema already pushed. Next = staging smokes + heartbeat Action + `validate:deployment`. |
| 2026-08-06 | Launch hardening Done (auth, sanitizer, IDOR, Active orchestrator, docs/marketing); unit suite re-green; migrations `db:push:verify` green. |
| 2026-08-05 | Rebaseline: TRI + PQC code Done; soft-RC ~84% / paid ~68%; remaining = validate + staging + secrets + Stripe smoke/identity. |
| 2026-08-02 | Stripe entitlement code + Sentry SDK local; build typing fixed. |
| 2026-07-24 | Production RC focus; Jul 24 migrations; Part B landed. |
