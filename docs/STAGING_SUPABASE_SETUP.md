# Staging Supabase setup

**Goal:** A **separate Supabase project** for Cloud Run staging (`*-staging` services). **Production Supabase** continues to power live beta signup, shadow trials, and real user data on public domains.

Related: [`STAGING_AND_RELEASE.md`](./STAGING_AND_RELEASE.md) · [`DEPLOY_PRODUCT_DOMAINS.md`](./DEPLOY_PRODUCT_DOMAINS.md)

---

## What goes where

| Data / flow | Supabase project | Public URL |
|-------------|------------------|------------|
| Beta waitlist (`msgf_beta_waitlist`) | **Production** | `elphiesgatedai.elphiesyntax.com/sign-up` |
| 24h Shadow Proxy trials | **Production** | `elphiesgatedai.elphiesyntax.com/shadow-trial` |
| Author foundational testing signup | **Production** | `authorecosystem.elphiesyntax.com/beta` |
| Operator pre-prod smoke, migrations soak | **Staging** | `staging.*.elphiesyntax.com` |
| Stripe test mode | **Staging only** | staging hosts |

**Rule:** Staging Cloud Run must **not** receive production beta traffic. Public marketing CTAs always point at production hosts (see `PlatformRoadmapExplorer` copy).

---

## One-time bootstrap

### 1. Create staging project

In [Supabase Dashboard](https://supabase.com/dashboard):

1. **New project** — e.g. `elphie-staging` (different org/region OK; note project ref).
2. **Database password** — save in your password manager.
3. **API keys** — anon + service role for `.env.cloudrun.staging`.

### 2. Local staging env

```bash
cp packages/msgf/.env.staging.example packages/msgf/.env.staging.local
# Fill DATABASE_URL (session pooler :5432), SUPABASE_PROJECT_REF, SUPABASE_DB_PASSWORD
```

Mirror the same `NEXT_PUBLIC_SUPABASE_*` / `SUPABASE_*` values in repo-root `.env.cloudrun.staging` (from `env.cloudrun.staging.example`).

### 3. Apply migrations to staging

```bash
npm run db:push:staging
npm run verify:supabase-schema   # optional — uses .env.local by default; point verify at staging if needed
```

Production migrations (when shipping schema to live beta):

```bash
npm run db:push
```

### 4. Auth redirect URLs (staging project)

Supabase → Authentication → URL configuration:

- **Site URL:** `https://staging.elphiesgatedai.elphiesyntax.com` (or your staging MSGF URL)
- **Redirect URLs:** staging MSGF + staging Author callback URLs from `.env.cloudrun.staging`

Production project keeps production Site URL + redirect URLs unchanged.

### 5. Deploy staging Cloud Run

```bash
cp env.cloudrun.staging.example .env.cloudrun.staging
# Fill staging Supabase + Upstash + staging public URLs
./deploy-staging.sh
```

---

## Commands

| Command | Target |
|---------|--------|
| `npm run db:push` | Production (`packages/msgf/.env.local`) |
| `npm run db:push:staging` | Staging (`packages/msgf/.env.staging.local`) |
| `./deploy-staging.sh` | Cloud Run `*-staging` services |
| `./setup-cloud.sh` | Production promote (unchanged) |

---

## Checklist before first staging deploy

- [ ] Staging Supabase project created (not a clone of prod with prod keys pasted into staging env)
- [ ] `npm run db:push:staging` succeeded
- [ ] `.env.cloudrun.staging` uses staging `NEXT_PUBLIC_SUPABASE_URL` and **Stripe test** keys
- [ ] Production `.env.cloudrun` unchanged — beta + shadow trial APIs still hit prod Supabase
- [ ] Staging auth redirect URLs configured in **staging** Supabase project only
