# MSGF — Dev TODO & production readiness

**Audience:** Jessica / MSGF engineering  
**Status:** Living checklist for **MSGF 1.0 production readiness** (gatedai + Pulse Guard + ops).  
**Last updated:** 2026-09-22 (staging smoke partial on gatedai; Post-MVP gates + prod mock prune still apply.)

**Priority now:** Remaining §1.4 gaps (Shadow CTA, Sentry, HITL POST, `/setup/projects`) → Checkout + mock-off → Lanes A3–A8. Signing stays in the repo for 1.1.

**Launch readiness (SSoT):** [`MSGF_V1_ROADMAP.md`](./MSGF_V1_ROADMAP.md) §10 — **soft-RC ~90%** · **paid self-serve ~82%**. Those two do not move on this partial smoke. Remaining = leftover staging gaps + Checkout + mock-off + Lanes A3–A8. Lane H hide + Lane B hero copy are in-repo.

**Related:** [`MSGF_RC_CHECKLIST.md`](./MSGF_RC_CHECKLIST.md) · [`MSGF_DEPLOY_CHECKLIST.md`](./MSGF_DEPLOY_CHECKLIST.md) · [`MSGF_V1_ROADMAP.md`](./MSGF_V1_ROADMAP.md) · [`MSGF_BUYER_WALKTHROUGH.md`](./marketing/MSGF_BUYER_WALKTHROUGH.md) · [`MSGF_SHADOW_PROXY.md`](./technical-specs/MSGF_SHADOW_PROXY.md) · [`MSGF_GLOBAL_BRAIN_TELEMETRY.md`](./technical-specs/MSGF_GLOBAL_BRAIN_TELEMETRY.md) · [`MSGF_PRODUCT_OVERVIEW.md`](./marketing/MSGF_PRODUCT_OVERVIEW.md) · [`MSGF_TESTING.md`](./technical-specs/MSGF_TESTING.md) · [`MSGF_BRAIN_ROUTING.md`](./technical-specs/MSGF_BRAIN_ROUTING.md) · [`MSGF_PQC_CRYPTO_AUDIT.md`](./technical-specs/MSGF_PQC_CRYPTO_AUDIT.md) · [`MSGF_SENTRY.md`](../integrations/technical-specs/MSGF_SENTRY.md)

---

## 0. How to use this list

- `[ ]` = not done · `[~]` = in progress · `[x]` = done  
- **Hide** = keep code, drop from 1.0 claims/UI/pricing; mock off in prod; do **not** delete  
- **Implement & test** = must work on a live tenant before you headline it  
- **P0** blocks soft-RC · **P0-M3** paid · **P0-Sentry / TRI / GitHub / PQ / SSO / SIEM** block those **claims** · **P0-GTM** front door · **Lane H** blocks a clean storefront  
- Do **not** block 1 Nov on boss-demo, Author/Education RC, or making DocuSign/MCP live.

---

## 0.1 Launch cut — 1 Nov 2026 (SSOT)

**North star:** MSGF sits **between** the consumer and the LLM. It does not become the model. It monitors and organizes context/memory so garbage does not become the next input.

**Enterprise 1.0** = SSO in + SIEM out + Sentry/TRI/GitHub/PQ smoked. It is **not** every Jul-24 logo.

### Hide (code stays; 1.0 must not sell or require it)

Do **not** delete these. Turn mocks **off** in prod. Ops panels may stay as *unconfigured* for 1.1.

| Surface | Hide from | 1.1 when |
| :--- | :--- | :--- |
| **DocuSign** team-invite envelopes | Homepage, `/features`, `/pricing`, Startup bullets, layout meta, Getting Started, password-reset “complete DocuSign” copy | A paying team needs `enforce_docusign` |
| **Dropbox Sign** (second signing provider) | Same as DocuSign | Customer asks for HelloSign instead of DocuSign |
| **Dropbox archive** of signed PDFs (I4) | Marketing, launch tour | After live signing exists |
| **Cursor MCP as a supported product** | Pricing, homepage, “1.0 includes MCP” | Integrator kit / `.cursor/mcp.json` recipe only — no SLA |
| **Signing mock** (`MSGF_SIGNING_MOCK` / `MSGF_DOCUSIGN_MOCK` / `MSGF_DROPBOX_ARCHIVE_MOCK`) | Prod env — must be **0 / unset** | Staging QA only |
| **GitHub App (org-wide)** | 1.0 claims | After picker works |
| **Sentry product** Session Replay / Profiling | Claims (MSGF Session Replay on `/admin/ops` **is** in 1.0) | Later observability |
| **PQ on Redis / Supabase / Pulse E2E** | Any “platform is post-quantum” line | Vendors; not our 1.0 |
| **Author fan hub** | Author nav, `/fan-management`, `/api/fan-hub`, `/api/fans` | After three-seat Author launch |
| **Author helper / Creative Guild** | Register helper seat, `/guild`, helper APIs | After three-seat Author launch |
| **Author / Education** product RC | MSGF launch checklist | Their own dates |

### Implement and test (must be true on a live tenant before you claim it)

| Lane | What “done” means | Smoke |
| :--- | :--- | :--- |
| **A Core** | Sandwich works; no mock dashboards; A6 signs; heartbeat | §1.4 Pulse/ingest/heal/Shadow/Active/spoof/swarm/P7 |
| **A2 Paid** | Real card → entitlement; BYOK $0 without Stripe | Checkout Pro + Startup + Enterprise monthly/yearly; mock off |
| **A3 Sentry** | Ops Load issues + crash→Vault quarantine | `sentry-test` then **delete route** |
| **A4 TRI** | High-drift Big Brain 2-of-3; default stays `balanced_dual` | One majority Pulse/CONVERGE; HITL still on ≥0.45 / no majority |
| **A5 GitHub picker** | Connect GitHub → map repos → `project_origin` | `/setup/projects` bulk-add |
| **A6 PQ** | App KEM on; **HTTPS PQ only if** GCLB `TargetHttpsProxy` exists | SSL policy `ENABLED` **or** drop HTTPS-PQ from copy |
| **A7 SSO** | Workspace domain allowlist; `gmail.com` → `/invite-only` | One company domain login attaches `company_id` |
| **A8 SIEM** | Customer HTTPS webhook + heartbeat drain | One HITL/swarm/audit event arrives at sink |
| **B Front door** | Shadow trial is the public door; waitlist ≠ signup | 10-minute SDK path |
| **S Staging** | Isolated Cloud Run + Supabase + Stripe test | `npm run smoke:staging` → `deploy_env=staging` |
| **C Trust pack** | Limitations, subprocessors (incl. xAI), A6 verify | Design partner on **their** repo |

**PQ-TLS gate:** client → load balancer only (`X25519MLKEM768`). If prod is Cloud Run domain mapping without a proxy, do **not** claim HTTPS is PQ — only `MSGF_HYBRID_KEM_ENABLED=1`.

---

## 0.2 GTM lanes (1 Nov)

### Lane H — Hide pass (P0-GTM storefront)

Code stays. Claims and buyer-facing copy go. Prod mocks off.

- [x] Homepage / layout meta: no DocuSign, Dropbox Sign, Dropbox archive, MCP-as-included (2026-09-21)
- [x] `/features` + shipped-capability cards: same (2026-09-21)
- [x] `/pricing` + `pricing-tiers.ts`: hosted BYOK; Pro $29/mo; Startup $49/workspace monthly+yearly; Enterprise $199/workspace monthly+yearly (2026-09-22)
- [x] Getting Started / pillar guide: already no “complete DocuSign”; MCP not a required step
- [x] Password-reset / invite: 1.0 never sets `enforce_docusign` (`createTeamInvite` forces false; reset UI only if flag) — 2026-09-21
- [x] Prod: `MSGF_SIGNING_MOCK=0`, `MSGF_DOCUSIGN_MOCK` unset, `MSGF_DROPBOX_ARCHIVE_MOCK` unset (code-level refuse on `DEPLOY_ENV=production` / `NODE_ENV=production`, 2026-09-22)
- [x] `/admin/ops` DocuSign panel: unmounted unless `MSGF_POST_MVP_SIGNING=1` (2026-09-22)
- [x] Runtime gates: delayed surfaces 404 `{ error: "feature_gated" }` and hide in UI (2026-09-22)
- [x] MCP: keep `msgf-ide-mcp-server.mjs`; process exits unless `MSGF_POST_MVP_MCP=1` — **not** `/pricing`

### Lane A — Core ready (P0)

- [ ] Feature freeze except Sentry / TRI / GitHub / PQ / SSO / SIEM smokes + hide pass + front-door copy
- [x] Prod: no mock eco / ticker / pillar health / `v32_mock_stream` (empty live fallbacks, 2026-09-22; restage `msgf-api` to pick up)
- [~] One-tenant staging smoke (Pulse, ingest, heal, Shadow, Active, spoof-tenant 403, swarm, P7 CTA) — §1.4 **partial** 2026-09-22 (Shadow CTA / Sentry / HITL POST / `/setup/projects` still open)
- [ ] A6 audit key required in prod (HITL must not skip signing)
- [ ] GH Actions `msgf-tier-heartbeat.yml` + `v32-heartbeat` dry-run 200 — **dry-run 200 on staging** 2026-09-22; GH Actions still open
- [x] `probe:solo` against staging gatedai URL — 2026-09-22
- [ ] Pulse Guard on one real workspace (`msgf.enabled` + token)
- [ ] Remaining tests: `test:savings`, `test:integration`, `test:ingest-workflow`, `test:v32-ultra`, `test:brain-routing`, `test:heal-queue-audience`

### Lane A2 — Paid (P0-M3) — §2b

- [ ] Live Checkout smoke: Pro $29/mo + Startup $49/mo|$490/yr + Enterprise $199/mo|$1,990/yr → webhook entitlements
- [ ] Recreate Stripe Price IDs (`STRIPE_PRICE_PRO_INDIVIDUAL` $29/mo, `_YEARLY` $290/yr; `STRIPE_PRICE_STARTUP_TEAM` $49/mo, `_YEARLY` $490/yr; `STRIPE_PRICE_ENTERPRISE` $199/mo, `_YEARLY` $1,990/yr — do not reuse $99 one-time)
- [x] Prod mock entitlements hard-off in code (2026-09-22). Still set `MSGF_STRIPE_WEBHOOK_LIVE=1` on Cloud Run after Checkout smoke
- [ ] Indie $0 hosted Free still works without Stripe
- [ ] Archive leftover live Stripe **Test product** ($19.99/mo) if unused

### Lane A3 — Sentry (P0-Sentry) — **in 1.0**

DSN/token already on Cloud Run. 1.0 means operators can **see issues and quarantine a crash-linked Vault win**.

- [ ] `/admin/ops` Sentry panel **Load issues** (token scopes cover org/project read)
- [ ] Crash → Vault quarantine: one real (or `sentry-test`) issue → win pulled from positive context → HITL restore/demote
- [ ] Rotate `SENTRY_AUTH_TOKEN` if scopes were copied from a personal token
- [ ] `GET /api/sentry-test` → issue in project `msgf` → **delete the route**
- [ ] Confirm P7 closed loop writes on Sentry quarantine (already coded 2026-09-18)

**Do not block 1.0 on:** Sentry product Session Replay, Sentry issue-create-from-Pulse-RED (P2).

### Lane A4 — TRI Big Brain (P0-TRI) — **in 1.0**

Code + migration + `test:tri-consensus` done. 1.0 means high-drift Pulse can take a **2-of-3** (Claude + Gemini + Grok), not that every Active call burns three apex models.

- [ ] `XAI_API_KEY` on staging + prod Cloud Run
- [ ] `MSGF_TRI_CONSENSUS_ENABLED=1` on staging + prod
- [ ] One staging Pulse (or CONVERGE) with drift above threshold → **TRI majority** visible in routing / Big Brain queue
- [ ] Tenant preset `tri_tribunal` selectable; default remains `balanced_dual` (cheap path)
- [ ] Soft-escalate + `bias_mitigated_dual` (Claude+Grok) smoke
- [ ] Human notify still opens on drift ≥ 0.45 / no majority / NON_HUMAN (TRI must not silently skip HITL)
- [ ] Document in runbook: TRI is **Big Brain / high drift**, not the Shadow trial path

**Do not block 1.0 on:** wiring TRI as the Active-gateway default, Grok on Indie $0, or synthesizing a single TRI chat completion.

### Lane A5 — GitHub picker (P0-GitHub) — **in 1.0**

Code + `/setup/projects` UI exist. 1.0 means a signed-in buyer can **Connect GitHub** and map repos to `project_origin` without a support call. Local folder picker stays as fallback.

- [ ] GitHub OAuth App (homepage + Supabase callback URL)
- [ ] Supabase Auth GitHub provider: `read:user` + `repo`; redirect allowlist includes `/auth/callback` and `/setup/projects`
- [ ] Prod: `MSGF_KMS_CRYPTO_KEY_PATH` (KMS envelope). Non-prod: `CRYPTO_SECRET_KEY` 32-byte
- [ ] Confirm migration `20260724010000_msgf_user_github_connections.sql` on live DB
- [ ] Smoke: Connect → list repos → **Add selected** → `msgf_user_projects` rows with correct `project_origin`
- [ ] Reconnect after token encrypt/decrypt (`GITHUB_NOT_CONNECTED` must not stick)
- [ ] Docs: GitHub maps **whole repos**; monorepo apps still use local subfolder / `msgf.productPath`

**Do not block 1.0 on:** GitHub App (org-wide), GitHub Actions deploy-gate as required CI.

### Lane A6 — PQ-TLS + app hybrid KEM (P0-PQ) — **in 1.0 with honest scope**

Two different layers. Do not merge them in copy.

**A. App layer (we control)** — already coded.

- [ ] Prod default `MSGF_HYBRID_KEM_ENABLED=1` for vault / GitHub token envelopes `0x03`
- [ ] HAL v2 ML-DSA remains flagged as **algorithm family FIPS 204**, not a FIPS-validated module
- [ ] Upstash / Redis: TLS on; **no** `rejectUnauthorized: false` in prod

**B. Platform PQ-TLS (Google, frontend only)** — [Cloud Load Balancing post-quantum TLS](https://docs.cloud.google.com/load-balancing/docs/post-quantum-tls) (`X25519MLKEM768`). Opt-in via SSL policy `post-quantum-key-exchange ENABLED`. Google plans **default ON October 2026**.

- [ ] Confirm how `elphiesgatedai.elphiesyntax.com` terminates TLS (GCLB `TargetHttpsProxy` vs Cloud Run domain mapping only)
- [ ] **If we own a TargetHttpsProxy:** create/attach SSL policy `ENABLED`; smoke with a PQ-capable client (Chrome 131+ / recent BoringSSL) and record cipher/group
- [ ] **If we do not own a proxy:** either add HTTPS LB + serverless NEG **or** drop PQ-TLS from 1.0 claims (keep app KEM only). Do not claim HTTPS is PQ
- [ ] Copy: “Client → gatedai load balancer can negotiate hybrid PQ KEX” — never “Pulse is E2E post-quantum” or “Supabase is PQ”

**Do not block 1.0 on:** PQ-TLS to Redis/Supabase (vendors), Pulse payload E2E encrypt.

### Lane A7 — Google Workspace SSO (P0-SSO) — **implement & test**

Code exists (`workspace-sso.ts`, company domains). 1.0 means a company logs in without shared Gmail.

- [ ] Supabase Google provider + `/auth/callback` allowlisted
- [ ] COMPANY_ADMIN adds one domain (`POST /api/msgf/workspace/company-domains`)
- [ ] Smoke: Workspace user on that domain → `company_id` attached → dashboard
- [ ] Smoke: `gmail.com` / unknown domain → `/invite-only` (not a silent tenant)
- [ ] Circuit fallback: email/password still works if Google flaps
- [ ] Copy: “Google Workspace SSO” on Startup Team only after this smoke

### Lane A8 — SIEM webhook (P0-SIEM) — **implement & test**

Code exists (`siem-exporter.ts`, `PUT /api/msgf/admin/siem-integrations`, heartbeat drain). 1.0 means events leave the building — not a Splunk-certified app.

- [ ] Ops: save webhook URL + secret on `/admin/ops#siem-integrations`
- [ ] Smoke: one HITL / swarm / audit event → HTTPS POST to sink (staging may use a request bin)
- [ ] Heartbeat batch drain (`v32-heartbeat`) pushes queued rows
- [ ] Copy: “OTel JSON webhook to your SIEM” — **not** Splunk/Sentinel marketplace
- [ ] Confirm SIEM never includes raw Global Brain prompt text

### Lane B — Front door (P0-GTM)

- [x] Homepage: one primary CTA = 7-day Shadow trial; H1 = layer between you and the model — 2026-09-21
- [x] `/sign-up` copy is waitlist, never “create account” (`BetaSignupForm`) — 2026-09-21
- [x] Getting started step 1 does **not** link waitlist as signup; Shadow trial first — 2026-09-21
- [ ] Trial page mints/shows key + 8-line SDK; clock starts on first call
- [x] Public eco widget hidden unless `source === "live"` — 2026-09-21
- [x] Pillar guide: tenant comes from license DB — never instruct `x-msgf-tenant-id` as source of truth — 2026-09-21
- [x] Secondary CTA only: Shadow trial + How it works (not five hero buttons) — 2026-09-21

### Lane S — Staging stack (blocks every §1.4 smoke)

Do not run 1.0 smokes against production. Staging = separate Supabase + Upstash + Cloud Run `*-staging` + Stripe test. See [`STAGING_AND_RELEASE.md`](../STAGING_AND_RELEASE.md).

- [x] Create Supabase project (ref `jlionibxmutsqxnjczii`, not production keys in `.env.staging.local`) — 2026-09-21
- [x] `npm run staging:prepare` green (isolation preflight) — 2026-09-21
- [x] `npm run db:push:staging` (Sept 2026 schema included) — 2026-09-21
- [~] Separate Upstash **done**; Stripe `sk_test_` still unset (mock entitlements ON until Checkout smoke)
- [x] `gcloud auth login` → Cloud Run `msgf-api-staging` + `author-bff-staging` + `author-client-staging` — 2026-09-21
- [~] `/health` `deploy_env=staging` on `msgf-api-staging-….run.app`; `robots.txt` still `Allow: /` until MSGF restage (`X-Robots-Tag: noindex` already on)
- [~] Cloud Run domain mappings created 2026-09-22 (`msgf-api-staging` / `author-*-staging`). DNS CNAMEs at Squarespace still required (`staging.elphiesgatedai`, `staging.authorecosystem`, `staging-api.authorecosystem` → `ghs.googlehosted.com.`)
- [ ] Staging Supabase Auth Site URL + `/auth/callback` (pretty host after DNS, or the `*.run.app` URL until then)

### Lane C — Trust pack (same week as 1 Nov OK)

- [ ] Limitations: not an LLM; GIGO = garbage does not become next context
- [ ] Subprocessors + no-train flags (include **xAI** once TRI is on) + date checked
- [ ] Isolation / spoof-tenant proof (`probe:solo` or documented script)
- [ ] How to verify one A6 HITL signature
- [ ] One design-partner Shadow week on **their** repo

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
- [x] Confirm Sept 2026 schema on live DB: `20260914200000_shadow_trial_7d_full_access.sql`, `20260915120000_governance_audit_platform.sql`, `20260915130000_trusted_license_allowlist.sql`, `20260918010000_tenant_default_ai_provider.sql`, `20260918120000_p7_prompt_shadow_deferred.sql` — 2026-09-18 `db:push:verify` (applied `18010000` + `18120000`; prior Sept rows were already present)

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
| Stripe live keys + live Price IDs + webhook secret | Paid path | **Done** Secret Manager on `msgf-api-00077-7qx` (2026-09-11); mock entitlements **hard-off in prod code** 2026-09-22 (restage to pick up) |
| `XAI_API_KEY` + `MSGF_TRI_CONSENSUS_ENABLED=1` | Big Brain TRI | **Required for 1.0 TRI claim** — §0.2 Lane A4 |
| `MSGF_HYBRID_KEM_ENABLED=1` | Vault / GitHub token envelopes `0x03` | **Required for 1.0 app-PQC claim** — Lane A6 |
| `MSGF_ACTIVE_AGGRESSIVENESS` | Active gateway default (`shard-and-route`) | Optional |
| `ALLOW_DEMO_TENANT` | Non-prod gateway demo tenant only | Never on prod |

- [x] Core secrets on prod Cloud Run `msgf-api` (ops cron + Sentry + Stripe prices) — 2026-08-06
- [ ] GH Actions `msgf-tier-heartbeat.yml` wired to use `MSGF_OPS_CRON_SECRET`
- [x] `/admin/ops` no mock pillar health (empty live when no events, 2026-09-22; restage `msgf-api`)
- [x] `v32-heartbeat` dry-run → 200 with new ops secret — staging 2026-09-22 (`auth_method: cron_secret` on `msgf-api-staging-00008-np6`)

### 1.4 Staging smoke (one real tenant)

- [x] Pledge → Pulse → ingest → heal-queue — 2026-09-22 seed + `probe:solo` Pulse 200 + ingest `lineage_map` + user heal-queue (`audience_scope: user`, no packages)
- [ ] Admin ARBITRATE → signed HITL audit verify — admin queue 200 with 1 swarm HITL row; POST `/human-arbitration` 500 `unrecognized_keys: arbitrate_audit_id`
- [ ] Safe Build / verify-result → deploy-gate green
- [ ] Sentry panel Load issues (token scopes)
- [ ] SDK: `GET /api/sentry-test` → delete route after — staging 503 (DSN not on staging)
- [ ] CONVERGE preset UI `/dashboard#token-savings` saves balanced_dual — dashboard live 2026-09-22; **save** not exercised
- [x] `probe:solo` against staging gatedai URL — 2026-09-22
- [x] Shadow Proxy: OpenAI client → `/api/v1/chat/completions` with `x-msgf-key` → shadow-eval panel shows projected row — 2026-09-22 OpenAI 200 + Anthropic 200; operator shadow-eval `recent` ≥ 1 projected row
- [x] Active mode: same request with `x-msgf-mode: active` → `x-msgf-routing` header present; spoofed `x-msgf-tenant-id` ignored — 2026-09-22 `SMALL_BRAIN_UPSTREAM`
- [x] Period reports PDF downloads for caller’s tenant only (403 on foreign tenant_id) — 2026-09-22 own PDF 200; buyer foreign 403
- [x] Swarm abort writes tenant `blocked_keys`; Global Brain JSON has no key lists — 2026-09-22 Pulse 409 `BOT_SWARM_DETECTED`, no key lists, HITL row present. Audit hub `p7=blocked` 200 / **0 events**
- [ ] Shadow 3-day CTA applies deferred P7 once — needs Shadow completions + trial clock
- [x] Audit hub `p7=` chips searchable — 2026-09-22 `/admin/ops?p7=blocked` UI + filter API 200; 0 matching events so `q=` content match not proven

### 1.5 Product surfaces

- [~] Landing / features / pricing / waitlist `/sign-up` / `/shadow-trial` / `/status` on staging `*.run.app` (2026-09-21 HTTP smoke); workspace / extension need a signed-in tenant. Front-door copy ships on next MSGF restage.
- [x] Marketing hide pass (Lane H): storefront copy 2026-09-21; invite never forces DocuSign; prod signing mocks still must be off; SSO/SIEM copy stays only after A7/A8 green
- [x] Marketing + product overview updated for Shadow Proxy / Active Governance / proven vs projected — 2026-08-06
- [ ] Pulse Guard: `msgf.enabled` + tenantKey + token on a real workspace

---

## 2. Integrations already built (finish smokes)

### Sentry — **1.0 in-cut** (Lane A3)

- [x] `@sentry/nextjs` wired
- [x] Cloud Run DSN + auth token + org/project on `msgf-api` (2026-08-06)
- [ ] Ops panel Load issues smoke; quarantine demote/restore — **blocks 1.0 Sentry claim**
- [ ] Rotate auth token if scopes insufficient for panel read — **blocks 1.0 Sentry claim**

### GitHub picker — **1.0 in-cut** (Lane A5)

- [ ] OAuth App + Supabase GitHub provider (`read:user`, `repo`)
- [ ] Prod KMS `MSGF_KMS_CRYPTO_KEY_PATH` (dev: `CRYPTO_SECRET_KEY`)
- [ ] Connect → `/setup/projects` bulk-map smoke — **blocks 1.0 GitHub claim**

### Signing (DocuSign / Dropbox Sign / Dropbox archive) — **HIDE from 1.0**

Do not implement live provider secrets for 1 Nov. Do not delete `lib/services/signing/*`.

- [x] Prod signing/archive mocks **off** (code-level refuse on production, 2026-09-22)
- [x] Runtime gate `MSGF_POST_MVP_SIGNING` / `MSGF_POST_MVP_DROPBOX_ARCHIVE` default off (APIs 404, no IDE lock, 2026-09-22)
- [x] Storefront hide pass (Lane H) — 2026-09-21
- [x] Team invite 1.0 path = email + pledge (no `enforce_docusign`) — 2026-09-21
- [ ] 1.1 later: set `MSGF_POST_MVP_SIGNING=1` + provider secrets → invite → webhook → IDE mint

### Cursor MCP — **HIDE from 1.0 as a supported product**

Keep `msgf-ide-mcp-server.mjs`. No 1.0 SLA, pricing bullet, or homepage claim. The stdio server exits unless `MSGF_POST_MVP_MCP=1`.

- [x] Off `/pricing` and homepage (2026-09-21)
- [x] Process-level gate (2026-09-22)
- [ ] 1.1: integrator kit recipe + `.cursor/mcp.json` only

### Workspace SSO — **1.0 in-cut** (Lane A7)

- [ ] Google provider + one allowlisted domain smoke — **blocks 1.0 SSO claim**

### SIEM export — **1.0 in-cut** (Lane A8)

- [ ] Webhook + heartbeat drain smoke — **blocks 1.0 SIEM claim**

### TRI / Grok — **1.0 in-cut** (Lane A4)

- [x] Config SSoT + Pulse majority + tenant API/UI + unit tests
- [x] `db:push` TRI migration (2026-08-06)
- [ ] `XAI_API_KEY` + `MSGF_TRI_CONSENSUS_ENABLED=1` on staging **and** prod — **blocks 1.0 TRI claim**
- [ ] One majority CONVERGE / high-drift Pulse smoke (Claude+Gemini+Grok)
- [ ] Soft-escalate + `bias_mitigated_dual` preset smoke (Claude+Grok BYOK)
- [ ] Default tenant preset stays `balanced_dual`; `tri_tribunal` is opt-in / high-drift

### PQC — **1.0 in-cut** (Lane A6)

- [x] Hybrid KEM `0x03` + ML-DSA HAL v2 + audit doc
- [ ] Prod `MSGF_HYBRID_KEM_ENABLED=1` — **blocks 1.0 app-PQC claim**
- [ ] Redis TLS: reject unauthorized CAs in prod
- [ ] Decide: GCLB SSL policy PQ KEX **ENABLED** **or** no HTTPS-PQ claim — **blocks 1.0 PQ-TLS claim**
- [ ] Document frontend-only scope ([`MSGF_PQC_CRYPTO_AUDIT.md`](./technical-specs/MSGF_PQC_CRYPTO_AUDIT.md) §6)

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
- [ ] Live Checkout smoke: Pro $29/mo + Startup $49/mo|$490/yr + Enterprise $199/mo|$1,990/yr → webhook writes entitlements
- [ ] Recreate Stripe Price IDs before smoke (do not reuse $99 one-time / per-seat IDs)
- [ ] Prod flip: `MSGF_STRIPE_WEBHOOK_LIVE=1` + `MSGF_ENTITLEMENT_MOCK_STRIPE_ACTIVE=0` (after smoke)
- [ ] Indie $0 hosted Free still works without Stripe
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
- [ ] Platform PQ-TLS (GCP LB) — **moved to 1.0 Lane A6 if TargetHttpsProxy exists**; still not Pulse/Supabase E2E
- [ ] Live DocuSign / Dropbox Sign / Dropbox archive (code stays; hide 1.0)
- [ ] Cursor MCP as a supported install / SLA

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
9. **Hide ≠ delete.** Signing and MCP stay in the repo. Unconfigured panels degrade. 1.0 does not sell them. Runtime flags (`MSGF_POST_MVP_*`, `AUTHOR_POST_MVP_*`) default off.

---

## Changelog

| Date | Note |
| :--- | :--- |
| 2026-09-22 | **Staging AI keys** from `.env.local` on `msgf-api-staging-00009-bvf`. Shadow/Active Anthropic 200 + projected eval rows. No `OPENAI_API_KEY` in `.env.local`. Still open: Shadow CTA, Sentry, HITL POST, `/setup/projects`. Soft-RC stays ~90%. |
| 2026-09-22 | **Staging smoke partial** on gatedai (`staging_readiness`). Checked: Pulse, ingest, user heal-queue, admin queue load, dashboard, period+PDF, buyer 403, Active routing, swarm 409, heartbeat dry-run, `p7=` chips, `probe:solo`. Still open: Shadow CTA, Sentry, HITL POST 500, `/setup/projects`. Soft-RC stays ~90%; paid stays ~82%. |
| 2026-09-22 | **Pricing:** BYOK **$0** hosted. Pro **$29/mo** or **$290/yr**. Startup **$49/mo** or **$490/yr** (≤5 people). Enterprise **$199/mo** or **$1,990/yr** with SSO/SIEM. Recreate Stripe Price IDs (do not reuse $99 one-time). |
| 2026-09-22 | **Pricing:** Free is hosted (Redis/Supabase included, BYOK = model keys only). Pro **$29/mo** subscription (not $99 perpetual). Team **$49/workspace/mo** up to 5 people. SSO/SIEM are Enterprise. Recreate Stripe Price IDs before Checkout smoke. |
| 2026-09-22 | **Buyer language:** storefront + hub + emails use industry terms (AI gateway, shadow mode, policy domains, cost-efficient vs frontier routing). Vault / Hall / Pulse Guard kept with gloss. APIs and env IDs unchanged. Restage required for live MSGF. |
| 2026-09-22 | **Prod mock-data prune:** production never returns fabricated ticker/eco/pillar/daily-report streams (empty live instead). Signing/archive mocks and Stripe entitlement mock are hard-off on production Cloud Run. Staging/local can still mock. Restage `msgf-api` to pick up. |
| 2026-09-21 | **Staging live + front door:** Cloud Run `msgf-api-staging` / `author-*-staging` + isolated Supabase/Upstash. `/health` `deploy_env=staging`. Lane B hero = Shadow trial + How it works. Invite `enforce_docusign` forced off. Remaining Lane S = Stripe test keys, Auth URLs, robots restage, optional DNS. |
| 2026-09-21 | **1 Nov launch cut (rev 3):** §0.1 split **Hide** (DocuSign, Dropbox Sign/archive, MCP-as-supported) vs **Implement & test** (core, paid, Sentry, TRI, GitHub, PQ, **SSO**, **SIEM**, front door). Lane H hide pass. Do not delete signing code. |
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
