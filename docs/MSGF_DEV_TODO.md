# MSGF — Dev TODO & production readiness

**Audience:** Jessica / MSGF engineering  
**Status:** Living checklist for **MSGF 1.0 production readiness** (gatedai + Pulse Guard + ops).  
**Last updated:** 2026-07-24

**Priority now:** Ship a production-ready MSGF product (RC gate).  
**Deferred:** Boss demo narrative / Andrew repo mapping theater — see §4 (parked).

**Related:** [`MSGF_RC_CHECKLIST.md`](./MSGF_RC_CHECKLIST.md) · [`MSGF_DEPLOY_CHECKLIST.md`](./MSGF_DEPLOY_CHECKLIST.md) · [`MSGF_V1_ROADMAP.md`](./MSGF_V1_ROADMAP.md) · [`MSGF_TESTING.md`](./MSGF_TESTING.md) · [`MSGF_GITHUB_PROJECTS.md`](./MSGF_GITHUB_PROJECTS.md) · [`MSGF_SENTRY.md`](./MSGF_SENTRY.md) · [`MSGF_SOLO_INTEGRATION.md`](./MSGF_SOLO_INTEGRATION.md)

---

## 0. How to use this list

- `[ ]` = not done · `[~]` = in progress · `[x]` = done  
- **P0** blocks production RC / soft go-live · **P1** next sprint · **P2** polish  
- Do **not** treat Stripe as required (deferred per V1 plan)  
- Do **not** block RC on Part B 3-tier CONVERGE or boss-demo silos

---

## 1. Production gate (P0) — do these first

Canonical checklist: [`MSGF_RC_CHECKLIST.md`](./MSGF_RC_CHECKLIST.md). This section is the day-to-day execution order.

### 1.1 Schema on the live DB

- [x] I1/A1 migrations (`20260724020000`, `20260724020100`) applied locally via `npm run db:push`
- [ ] Confirm GitHub connections migration `20260724010000` on **staging + prod**
- [ ] Apply Jul 24 follow-ons on staging/prod: A4 compound scope, I5 webhook inbox, A5 skip audit, A6 arbitrate audit
  - `20260724030000_pillar_vectors_compound_scope.sql`
  - `20260724030100_webhook_inbox_archive_status.sql`
  - `20260724030200_msgf_skip_audit.sql`
  - `20260724030300_msgf_arbitrate_audit.sql`
- [ ] `npm run verify:db-schema -w msgf` against the target DB after push

### 1.2 Automated gates (clean machine + env)

- [x] `npm run test:unit -w msgf` (2026-07-24 — green after A4 metadata schema fix)
- [ ] `npm run deep-test:solo -w msgf` (clear locked `.next` on Windows/OneDrive if needed)
- [ ] `npm run validate:deployment` (unit + production `next build`)
- [ ] `npm run verify:msgf-env -w msgf`
- [x] Targeted: `test:a4-compound-scope`, `test:i5-webhook-queue`, `test:i4-dropbox-archive`, `test:a5-skip-audit`, `test:a6-arbitrate-audit`

### 1.3 Cloud Run / ops secrets (no mock authority)

| Env | Purpose |
| :--- | :--- |
| `REDIS_URL` / Upstash | Hot layer + job queue |
| `MSGF_OPS_CRON_SECRET` | Heartbeat, archive worker, audit fallbacks |
| `MSGF_SKIP_AUDIT_SECRET` | A5 skip-MSGF HMAC (or reuse ops cron) |
| `MSGF_ARBITRATE_AUDIT_KEY` | A6 HITL audit HMAC (or reuse ops cron) |
| `SENTRY_AUTH_TOKEN` + `SENTRY_ORG_SLUG` | Ops Sentry panel |
| DocuSign / Dropbox Sign / Dropbox archive | Only if those surfaces are live |

- [ ] Secrets present on staging + prod Cloud Run
- [ ] GitHub Actions `msgf-tier-heartbeat.yml` uses `MSGF_OPS_CRON_SECRET` + `MSGF_APP_URL`
- [ ] `/admin/ops` loads **live** data (not mock pillar health)
- [ ] `POST /api/msgf/ops/v32-heartbeat` with `{"dry_run":true}` → 200

### 1.4 Staging smoke (one real tenant)

- [ ] Sign pledge → Pulse baseline
- [ ] Ingest → lineage / heal-queue
- [ ] Admin ARBITRATE resolve → row appears in **Signed HITL audit** + verify OK
- [ ] Safe Build / verify-result → deploy-gate green for that `project_origin`
- [ ] Sentry panel Load issues (if token set)
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

### Native Sentry (admin ops)

- [ ] Token scopes: read (+ write if Resolve from UI)
- [ ] Smoke: `/admin/ops` → Sentry → Load / Open / Resolve
- [ ] Quarantine HITL path: Sentry match → quarantine → demote/restore (A2/A3)

### Solo / admin

- [ ] Clear locked `packages/msgf/.next` on Windows/OneDrive when builds flake
- [ ] Global admin emails / operator role correct for ops console

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

- [ ] Part B: 3-tier dual CONVERGE (flagged post-RC)
- [ ] Native Sentry issue create from Pulse RED
- [ ] GitHub App install (org-wide)
- [ ] Stripe / paid entitlements (M3)
- [ ] Nanosecond hot-layer SLO

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
| 2026-07-24 | Refocus: production RC first; boss demo parked in §4. Added Jul 24 migrations + A5/A6 secrets. |
| 2026-07-23 | Initial list: GitHub picker + Sentry ship tasks, integration exploration, boss demo. |
