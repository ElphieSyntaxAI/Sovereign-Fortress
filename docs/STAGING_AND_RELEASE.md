# Staging, versioning, and rollback

**Goal:** Test every deploy on staging URLs before traffic hits production custom domains. Track one **release id** (git SHA) across all surfaces and roll back in minutes.

**Production today:** [`DEPLOY_PRODUCT_DOMAINS.md`](./DEPLOY_PRODUCT_DOMAINS.md)

**Status (2026-09-22):** Staging Cloud Run is live. Domain mappings exist for `staging.elphiesgatedai.elphiesyntax.com`, `staging.authorecosystem.elphiesyntax.com`, and `staging-api.authorecosystem.elphiesyntax.com` → the matching `*-staging` services. HTTPS certs stay pending until Squarespace DNS CNAMEs to `ghs.googlehosted.com.` exist. Until then use `https://msgf-api-staging-504003558298.us-central1.run.app`.

---

## Operator bootstrap (do this once)

Staging is a **separate stack**: separate Supabase, separate Upstash, Stripe **test** keys, Cloud Run `msgf-api-staging` / `author-*-staging`. Production beta waitlist and Shadow trial stay on production.

1. **Create Supabase project** `elphie-staging` at [supabase.com/dashboard](https://supabase.com/dashboard). Save the DB password.
2. Fill `packages/msgf/.env.staging.local` from `.env.staging.example`:
   - `DATABASE_URL` session pooler `:5432`
   - `NEXT_PUBLIC_SUPABASE_URL` + publishable key + **service role**
   - `SUPABASE_PROJECT_REF` (not `YOUR_STAGING_REF`)
3. Create a **separate Upstash** Redis and put REST URL + token aside for step 5.
4. Stripe Dashboard → **test** mode: copy `sk_test_…` (never `sk_live_`).
5. Generate Cloud Run env and refuse prod bleed:

```bash
npm run staging:prepare
```

That writes gitignored `.env.cloudrun.staging` and runs `staging:preflight`. It **must fail** until step 2 is a real project.

6. Apply schema: `npm run db:push:staging`
7. Re-auth GCP: `gcloud auth login` (account `jessicapickens@elphiesyntax.com`, project `msgf-shield`)
8. Deploy: `npm run deploy:staging` or `.\deploy-staging.ps1`
9. Optional DNS: `./map-staging-domains.sh` then CNAME the three `staging.*` hosts. First smoke can use the `*.run.app` URL:

```bash
npm run smoke:staging -- https://msgf-api-staging-XXXX-uc.a.run.app
```

10. Staging Supabase → Auth → URL configuration: Site URL = `https://staging.elphiesgatedai.elphiesyntax.com` (or the run.app URL until DNS exists).

**Never** paste production `NEXT_PUBLIC_SUPABASE_URL` into staging env. Preflight blocks that.

---

## 1. Architecture (recommended)

Use **parallel Cloud Run services** — same Dockerfiles, different service names + env files. Production domain mappings stay untouched until you promote.

| Surface | Production service | Staging service | Production host | Staging host (pick one) |
|--------|--------------------|-----------------|-----------------|------------------------|
| MSGF API | `msgf-api` | `msgf-api-staging` | `elphiesgatedai.elphiesyntax.com` | `staging.elphiesgatedai.elphiesyntax.com` *or* `msgf-api-staging-….run.app` |
| Author client (picker + UI) | `author-client` | `author-client-staging` | `elphiesyntax.com`, `authorecosystem…` | `staging.elphiesyntax.com` |
| Author BFF | `author-bff` | `author-bff-staging` | `api.authorecosystem…` | `staging-api.authorecosystem…` *or* `author-bff-staging-….run.app` |

Syntax Education (when hosted) follows the same pattern: `syntax-educates-staging` + staging subdomain.

### Why parallel services (not “one service, two revisions” only)

- Staging can use **different Supabase**, Stripe test mode, and `BFF_ALLOWED_ORIGINS` without risking production cookies.
- Production **never** receives traffic until you run the production deploy script.
- Cloud Run still keeps **every revision** per service for instant rollback.

---

## 2. One-time setup

### 2.1 Staging Supabase (strongly recommended)

Create a **second Supabase project** (e.g. `elphie-staging`). Full bootstrap: [`STAGING_SUPABASE_SETUP.md`](./STAGING_SUPABASE_SETUP.md).

1. Copy `packages/msgf/.env.staging.example` → `.env.staging.local` and fill staging credentials.
2. Run migrations: `npm run db:push:staging` (production stays `npm run db:push`).
3. Auth → URL configuration on the **staging** project only:
   - Site URL: `https://staging.elphiesgatedai.elphiesyntax.com` (or your staging MSGF URL)
   - Redirect URLs: staging MSGF + staging Author callback URLs
4. Use **Stripe test keys** only on staging.

### Beta & trials stay on production

Public signup flows (**beta waitlist**, **24h Shadow Proxy trial**, **Author `/beta`**) intentionally use **production** Supabase and **production** custom domains. Staging is for operator smoke tests before promote — not for collecting real beta signups.

Sharing production Supabase with staging pollutes prod (waitlists, shadow trials, test pulses).

### 2.2 Staging env file

```bash
npm run staging:prepare          # writes .env.cloudrun.staging + isolation gate
npm run db:push:staging
npm run deploy:staging           # or .\deploy-staging.ps1 on Windows
npm run smoke:staging            # or pass the Cloud Run URL
```


Key differences from production:

- All `NEXT_PUBLIC_*_APP_URL` / `VITE_*_APP_URL` → **staging** hostnames (baked into client bundles at build time).
- `DEPLOY_ENV=staging` (set automatically by `deploy-staging.sh`).
- `MSGF_AUTH_COOKIE_DOMAIN` — use `.elphiesyntax.com` only if staging is on that zone; otherwise omit or use a staging-only cookie domain.
- `BFF_ALLOWED_ORIGINS` — include staging Author + MSGF URLs only.

### 2.3 Staging Cloud Run services

First staging deploy creates services automatically:

```bash
./deploy-staging.sh
```

Optional: map staging subdomains (after first deploy):

```bash
./map-staging-domains.sh
```

Then add these **CNAME** records on the `elphiesyntax.com` zone (Squarespace DNS). Do not remap production hosts.

| Host | Type | Value |
|------|------|-------|
| `staging.elphiesgatedai` | CNAME | `ghs.googlehosted.com.` |
| `staging.authorecosystem` | CNAME | `ghs.googlehosted.com.` |
| `staging-api.authorecosystem` | CNAME | `ghs.googlehosted.com.` |

Google issues the managed cert after those records resolve. Until then smoke:

```bash
npm run smoke:staging -- https://msgf-api-staging-504003558298.us-central1.run.app
```

---

## 3. Release identity (version tracking)

Every deploy should share one **release id**:

| Field | Source | Where it shows |
|-------|--------|----------------|
| `GIT_SHA` / `IMAGE_TAG` | `git rev-parse --short HEAD` (default in `setup-cloud.sh`) | `/health`, `/api/release` |
| `DEPLOY_ENV` | `production` or `staging` | `/health` |
| `DEPLOYED_AT` | UTC timestamp at deploy | `/health` |
| Cloud Run revision | Auto (`K_REVISION`) | `/health`, GCP console |

**Convention:** one git commit → one `IMAGE_TAG` → deploy **all three** staging services with the **same** tag before promoting to production.

Check what's live:

```bash
curl -s https://staging.elphiesgatedai.elphiesyntax.com/health | jq .
curl -s https://elphiesgatedai.elphiesyntax.com/health | jq .
```

Author BFF: extend `/api/ping` similarly when you want parity (optional).

Artifact Registry retains images by tag — **`IMAGE_TAG` is your rollback handle**.

---

## 4. Deploy workflow

### Staging (test here first)

```bash
npm run validate:deployment
./deploy-staging.sh
```

Then smoke:

```bash
# MSGF
curl -sI "https://STAGING_MSGF_URL/health"

# Author
curl -sI "https://STAGING_AUTHOR_URL"
curl -s "https://STAGING_BFF_URL/api/ping"

# App flows
# - Picker badges + beta signup on staging picker
# - MSGF /shadow-trial + /sign-up waitlist
# - Author /beta waitlist
# - Sign-in with a staging test user
```

Optional: GitHub Action `staging-smoke.yml` (`workflow_dispatch`) curls `/health` and asserts `deploy_env=staging`. Production deploy stays `./deploy-product-domains.sh` after staging sign-off.

### Production (after staging sign-off)

```bash
npm run validate:deployment
./deploy-product-domains.sh
```

Use the **same `IMAGE_TAG`** you validated on staging (fastest promote):

```bash
export IMAGE_TAG=abc1234   # the SHA you tested on staging
export SKIP_CLOUD_BUILD=1
./deploy-product-domains.sh
```

That redeploys production Cloud Run services to the **already-built** image — no rebuild drift.

---

## 5. Rollback

### Option A — Previous Cloud Run revision (fastest, ~30s)

List revisions:

```bash
gcloud run revisions list --service=msgf-api --region=us-central1 --project=msgf-shield
```

Route 100% traffic to last good revision:

```bash
gcloud run services update-traffic msgf-api \
  --to-revisions=msgf-api-00071-bcv=100 \
  --region=us-central1 --project=msgf-shield
```

Repeat for `author-bff` and `author-client`. Revisions remain available ~1000 by default.

### Option B — Redeploy known-good image tag

```bash
export IMAGE_TAG=d94583e1
export SKIP_CLOUD_BUILD=1
./setup-cloud.sh
AUTHOR_DEPLOY_TARGET=both IMAGE_TAG=d94583e1 SKIP_CLOUD_BUILD=1 ./setup-author-cloud.sh
```

### Option C — Database rollback

Migrations are forward-only. For bad migrations, restore Supabase **backup/PITR** on staging first, never experiment on prod. Keep staging schema ahead of prod when testing migrations.

---

## 6. Promotion checklist (staging → production)

- [ ] `npm run validate:deployment` green
- [ ] Staging `/health` shows expected `git_sha` + `deploy_env: staging`
- [ ] Picker copy + beta gates on staging apex
- [ ] MSGF shadow trial + beta waitlist (staging DB)
- [ ] Author `/beta` waitlist → admin ops inbox (staging)
- [ ] Sign-in / dashboard smoke on staging
- [ ] Migrations applied to **production** Supabase if this release includes schema changes
- [ ] Promote with `IMAGE_TAG=<validated-sha>` + `SKIP_CLOUD_BUILD=1`
- [ ] Production `/health` matches staging SHA
- [ ] Spot-check production picker + one logged-in flow

---

## 7. Future: GitHub Actions matrix

Minimal pattern:

1. **On PR / push to `main`:** build once → deploy staging services → curl smokes.
2. **On `release/v*` tag or manual approve:** deploy production with same `IMAGE_TAG`.

Store in repo:

- `.github/workflows/deploy-staging.yml`
- `.github/workflows/deploy-production.yml`

Secrets: `GCP_SA_KEY`, staging + prod env as GitHub Environments (`staging`, `production`).

---

## 8. Related files

| File | Purpose |
|------|---------|
| `deploy-staging.sh` / `deploy-staging.ps1` | Staging deploy wrapper (preflight first) |
| `scripts/staging-preflight.mjs` | Isolation gate (no prod Supabase / live Stripe / signing mocks) |
| `scripts/smoke-staging.mjs` | `/health` must report `deploy_env=staging` |
| `scripts/prepare-cloudrun-env.mjs --staging` | Writes `.env.cloudrun.staging` |
| `map-staging-domains.sh` | Staging hosts only — refuses production apex |
| `deploy-product-domains.sh` | Production deploy |
| `.env.cloudrun` | Production secrets (gitignored) |
| `.env.cloudrun.staging` | Staging secrets (gitignored) |
| `env.cloudrun.staging.example` | Staging template |
| `setup-cloud.sh` | MSGF image build + Cloud Run |
| `setup-author-cloud.sh` | Author BFF + client |
| `scripts/validate-deployment.mjs` | Pre-deploy build gate |

---

## 9. FAQ

**Can we use one Cloud Run service with 0% staging revision?**  
Yes (`gcloud run services update-traffic --to-revisions=new=10,old=90`), but env vars and `NEXT_PUBLIC_*` URLs are baked at **build** time — staging and prod need different images or different services. Parallel services are simpler.

**Do we need staging for Squarespace DNS?**  
No — use `*.run.app` URLs until staging DNS is ready.

**How do we track “version per website”?**  
One monorepo `IMAGE_TAG` per release; `/health` on MSGF and (optionally) `/api/ping` on BFF expose `service`, `git_sha`, `revision`, `deploy_env`. Production picker/MSGF/Author all show the same SHA when deployed together.
