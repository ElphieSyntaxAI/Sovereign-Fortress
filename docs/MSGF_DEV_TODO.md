# MSGF — Dev TODO & production readiness

**Audience:** Jessica / MSGF engineering  
**Status:** Living checklist for **MSGF 1.0 production readiness** (gatedai + Pulse Guard + ops).  
**Last updated:** 2026-08-06

**Priority now:** `db:push` usage/shadow/governance migrations → staging smoke + Cloud Run secrets + green `validate:deployment` → technical soft-RC; then Stripe test Checkout smoke → paid go-live after identity.

**Launch readiness (SSoT):** [`MSGF_V1_ROADMAP.md`](./MSGF_V1_ROADMAP.md) §10 — **soft-RC ~84%** · **paid self-serve ~68%**.

**Related:** [`MSGF_RC_CHECKLIST.md`](./MSGF_RC_CHECKLIST.md) · [`MSGF_DEPLOY_CHECKLIST.md`](./MSGF_DEPLOY_CHECKLIST.md) · [`MSGF_V1_ROADMAP.md`](./MSGF_V1_ROADMAP.md) · [`MSGF_SHADOW_PROXY.md`](./MSGF_SHADOW_PROXY.md) · [`MSGF_PRODUCT_OVERVIEW.md`](./MSGF_PRODUCT_OVERVIEW.md) · [`MSGF_TESTING.md`](./MSGF_TESTING.md) · [`MSGF_BRAIN_ROUTING.md`](./MSGF_BRAIN_ROUTING.md) · [`MSGF_PQC_CRYPTO_AUDIT.md`](./MSGF_PQC_CRYPTO_AUDIT.md) · [`MSGF_SENTRY.md`](./MSGF_SENTRY.md)

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
- [ ] Apply TRI consensus migration `20260805010000_tri_consensus_config.sql` (`msgf_tenant_consensus_config` + xAI provider CHECK)
- [ ] Apply provider usage / proven savings migration `20260806010000_provider_usage_proven_savings.sql`
- [ ] Apply period savings reports migration `20260806020000_period_savings_reports.sql`
- [ ] Apply shadow evaluation logs migration `20260806030000_shadow_evaluation_logs.sql` (+ `…30100` shadow USD column)
- [ ] Apply launch governance writers migration `20260806200000_launch_governance_writers.sql` (proven/usage audit columns)
- [ ] `npm run db:push:verify -w msgf` after TRI + usage + shadow + governance migrations

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
- [ ] `npm run validate:deployment` (unit + production `next build`) — confirm after Windows flake
- [ ] `npm run deep-test:solo -w msgf`
- [ ] `npm run verify:msgf-env -w msgf`

### 1.3 Cloud Run / ops secrets

| Env | Purpose | Status |
| :--- | :--- | :--- |
| `REDIS_URL` / Upstash | Hot layer + gateway completion cache | Confirm on staging/prod |
| `MSGF_OPS_CRON_SECRET` | Heartbeat / audits | **Open** on Cloud Run |
| Sentry DSN + auth token + org/project | SDK + ops panel | Local **[~]**; Cloud Run **open** |
| Stripe test keys + Price IDs + webhook secret | Paid path | Local **[~]**; Cloud Run **open** |
| `XAI_API_KEY` + `MSGF_TRI_CONSENSUS_ENABLED=1` | Big Brain TRI | Optional until TRI live |
| `MSGF_HYBRID_KEM_ENABLED=1` | Quantum-ready envelopes | Optional; document when on |
| `MSGF_ACTIVE_AGGRESSIVENESS` | Active gateway default (`shard-and-route`) | Optional |
| `ALLOW_DEMO_TENANT` | Non-prod gateway demo tenant only | Never on prod |

- [ ] Secrets on staging + prod Cloud Run
- [ ] GH Actions `msgf-tier-heartbeat.yml` wired
- [ ] `/admin/ops` live data (not mock pillar health)
- [ ] `v32-heartbeat` dry-run → 200

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

### 1.5 Product surfaces

- [ ] Landing / features / pricing / workspace / `/status` / extension download on staging
- [x] Marketing copy updated (TRI, Sentry, DocuSign/Dropbox Sign, quantum-ready) — 2026-08-05
- [x] Marketing + product overview updated for Shadow Proxy / Active Governance / proven vs projected — 2026-08-06
- [ ] Pulse Guard: `msgf.enabled` + tenantKey + token on a real workspace

---

## 2. Integrations already built (finish smokes)

### Sentry

- [x] `@sentry/nextjs` wired
- [ ] Rotate auth token; Cloud Run DSN; panel smoke; quarantine demote/restore

### GitHub picker

- [ ] OAuth App + `CRYPTO_SECRET_KEY` / KMS; Connect → `/setup/projects` smoke

### Signing (DocuSign / Dropbox Sign)

- [ ] Provider secrets when live; invite → webhook → IDE mint unlocked

### TRI / Grok

- [x] Config SSoT + Pulse majority + tenant API/UI + unit tests
- [ ] `db:push` TRI migration; enable flags on staging with `XAI_API_KEY`
- [ ] Soft-escalate + bias_mitigated preset smoke (Claude+Grok BYOK)

### PQC

- [x] Hybrid KEM `0x03` + ML-DSA HAL v2 + audit doc
- [ ] Decide prod default for `MSGF_HYBRID_KEM_ENABLED` (off until ops ready)
- [ ] Platform PQ-TLS checklist on Cloud Run LB ([`MSGF_PQC_CRYPTO_AUDIT.md`](./MSGF_PQC_CRYPTO_AUDIT.md) §6)

### Provider gateway

- [x] Shadow Proxy + Active Orchestrator + auth/header hardening (code)
- [ ] Staging smoke items in §1.4
- [ ] Document Cloud Run CORS / timeout for long SSE if needed

---

## 2b. Stripe / paid entitlements (P0-M3)

**Code Done (2026-08-02):** Startup Team + subscription lifecycle + `past_due` + test Price IDs + migration.

- [x] Test Price IDs mapped; entitlement writers; unit tests
- [~] Local `stripe listen` webhook secret
- [ ] Staging Checkout smoke (Pro + Startup) with test cards
- [ ] Stripe **identity verification** (blocks live keys)
- [ ] Prod flip: live keys + `MSGF_STRIPE_WEBHOOK_LIVE=1` + mock off
- [ ] Indie $0 BYOK still works without Stripe

---

## 3. Product glue (P1 — after P0 green)

- [ ] Projects hub: last Pulse / verify / Sentry count per mapping
- [ ] Deploy-gate CI script documented
- [ ] Ops strip: shared `project_origin` filter
- [ ] Pulse Guard: quick-switch `tenantKey`
- [ ] Post-proxy onboarding funnel: Shadow projected → enable Active → proven dashboard

---

## 4. Parked — boss demo

Not on critical path. See [`MSGF_BOSS_DEMO_RUNBOOK.md`](./MSGF_BOSS_DEMO_RUNBOOK.md).

---

## 5. Explicitly later (P2+)

- [x] Part B CONVERGE tiers (flagged)
- [x] TRI Big Brain + tenant presets (flagged)
- [x] Hybrid PQC envelopes (flagged)
- [x] Shadow Proxy + Active Governance (launch cut — hash cache / state-gate; embedding semantic + dual chat wire deferred)
- [ ] Embedding semantic similarity cache on `/api/v1`
- [ ] Dual/TRI chat completion synthesis on Active escalate
- [ ] Sentry issue create from Pulse RED
- [ ] Session Replay / Logging / Profiling
- [ ] GitHub App (org-wide)
- [ ] Nanosecond hot-layer **SLO claim**
- [ ] Stripe Customer Portal UI
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

---

## Changelog

| Date | Note |
| :--- | :--- |
| 2026-08-06 | Launch hardening Done (auth, sanitizer, IDOR, Active orchestrator, docs/marketing); unit suite re-green; remaining = migrations `db:push` + staging gateway smoke. |
| 2026-08-05 | Rebaseline: TRI + PQC code Done; soft-RC ~84% / paid ~68%; remaining = validate + staging + secrets + Stripe smoke/identity. |
| 2026-08-02 | Stripe entitlement code + Sentry SDK local; build typing fixed. |
| 2026-07-24 | Production RC focus; Jul 24 migrations; Part B landed. |
