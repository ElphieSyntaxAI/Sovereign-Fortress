# MSGF cross-repo testing runbook

**Goal:** Wire every monorepo product surface through MSGF so operators see **real telemetry** — pulses, token savings, tenant-scoped dashboards, and governance events — not siloed mocks.

**When to run:** After roadmap pages and beta gates are deployed to production. Staging Supabase is for pre-prod smoke; **cross-repo testing uses production MSGF + production tenant data** unless explicitly noted.

**Companions:** [`MONOREPO_PRODUCTS.md`](../../MONOREPO_PRODUCTS.md) · [`MSGF_TESTING.md`](../technical-specs/MSGF_TESTING.md) · [`MSGF_GLOBAL_BRAIN_TELEMETRY.md`](../technical-specs/MSGF_GLOBAL_BRAIN_TELEMETRY.md) · [`AUTHOR_MSGF_WIRING.md`](../../integrations/technical-specs/AUTHOR_MSGF_WIRING.md) · [`STAGING_SUPABASE_SETUP.md`](../../STAGING_SUPABASE_SETUP.md)

**Last updated:** 2026-08-12

---

## 1. Tenant map (what to watch)

| Surface | Repo path | MSGF `tenant_id` / license tenant | Dashboard filter |
|--------|-----------|-----------------------------------|------------------|
| **Author Ecosystem** | `apps/author-ecosystem/` | `author_ecosystem` | MSGF admin → token savings `?tenant_id=author_ecosystem` |
| **MSGF console** | `packages/msgf/` | per-license / org tenant | Default console tenant |
| **Syntax Education** | `apps/syntax-educates/` | `tenant_education` (manifest) | Filter when education host live |
| **Pulse Guard IDE** | `packages/msgf-pulse-guard/` | workspace `project_origin` | Extension → verify-result → Vault |

Do **not** use folder paths (`apps/author-ecosystem`) as `msgf.tenantKey`. See `MONOREPO_PRODUCTS.md` § tenant rules.

---

## 2. Preconditions

- [ ] Production Supabase migrations applied: `npm run db:push`
- [ ] `.env.cloudrun` (prod) has MSGF URL, Supabase, Redis, `MSGF_GLOBAL_ADMIN_EMAILS`
- [ ] Author BFF `MSGF_*` gateway vars point at **production** elphiesgatedai (not staging)
- [ ] Resend configured for beta + shadow trial emails (optional but recommended for soak)

---

## 3. Per-surface smoke (production)

### 3.1 MSGF (elphiesgatedai)

1. `/health` and `/api/release` return matching `GIT_SHA`
2. `/shadow-trial` — start trial → row in `msgf_shadow_trials` (prod DB)
3. `/sign-up` — beta waitlist row in `msgf_beta_waitlist`
4. `/admin/ops#beta-waitlist` — operator sees signups
5. Pulse / dashboard shows non-zero activity after Author + IDE tests below

### 3.2 Author (authorecosystem)

1. `/roadmap` — full flywheel + progress pulse renders
2. `/beta` — waitlist POST → BFF → shared beta table
3. Sign in (invited tester) → ingest or Librarian call → **Shadow/Active** hit on MSGF gateway
4. On elphiesgatedai admin: filter savings **`tenant_id=author_ecosystem`**

### 3.3 Syntax Education (local / when hosted)

1. `npm run dev:education` — Layer A/B workspace loads
2. Confirm `packages/msgf/config/tenant-manifest.json` entry for education
3. When host live: Classroom OAuth soak on **staging** first, then prod promote

### 3.4 Pulse Guard extension

1. Open monorepo in VS Code with Pulse Guard
2. Run verify on a changed file → `verify-result` event
3. Confirm MSGF Vault/Hall or deploy-gate advisory (Author editor hub when enabled)

---

## 4. Monorepo workspace presets (IDE)

MSGF ships monorepo-aware presets for multi-root workspaces:

```bash
curl -s "$MSGF_BASE_URL/api/workspace/monorepo-presets" | head
```

Source: `packages/msgf/lib/services/monorepo-workspace-presets.ts` · extension: `packages/msgf-pulse-guard/src/monorepoProducts.ts`

**Action item for full repo coverage:** Ensure each sub-project (`author-ecosystem`, `syntax-educates`, `msgf-dashboard`) appears in presets with correct `project_origin` so pulses attribute to the right product in ops dashboards.

---

## 5. Data you should see (acceptance)

| Signal | Where |
|--------|--------|
| Beta waitlist rows | Supabase `msgf_beta_waitlist` · `/admin/ops` |
| Shadow trials | `msgf_shadow_trials` · cron report emails |
| Author HAL / pulse chunks | MSGF pulse logs · `author_ecosystem` tenant filter |
| verify-result / CONVERGE | MSGF ops · period reports · quarantine links |
| Release version | All hosts `/api/release` same SHA after promote |

---

## 6. Staging vs production during testing

| Test type | Environment |
|-----------|-------------|
| Marketing / beta / shadow trial | **Production** only |
| Schema migration soak | Staging Supabase + `deploy-staging.sh` |
| Stripe billing | Staging test keys |
| Cross-repo telemetry soak (this doc) | **Production** MSGF + prod tenants |

---

## 7. Suggested order (testing week)

1. Deploy prod with migrations + roadmap pages
2. MSGF shadow trial + beta signup (self-test)
3. Author foundational tester: ingest + Librarian → confirm `author_ecosystem` savings
4. Education dev smoke (local)
5. Pulse Guard verify on Author + MSGF packages
6. Operator review: `/admin/ops`, beta waitlist, token dashboard by tenant
7. Optional: staging promote rehearsal with separate Supabase

---

## 8. Follow-up engineering (if data is missing)

- Author BFF not forwarding `x-msgf-*` headers → check gateway env in `apps/author-ecosystem/server`
- Zero tenant savings → confirm pulse calls use `tenant_id=author_ecosystem` not folder path
- Education pulses absent → wire Layer B allowance stream to MSGF gateway (see `packages/ui` education hooks)
- Add sub-project to `monorepo-workspace-presets` if IDE pulses show wrong origin
