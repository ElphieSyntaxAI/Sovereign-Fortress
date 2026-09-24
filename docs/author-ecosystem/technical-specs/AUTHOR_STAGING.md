# Author Staging (Cloud Run)

**SSoT for Author Ecosystem non-production deploy.**  
**Shared staging stack:** [`STAGING_AND_RELEASE.md`](../../STAGING_AND_RELEASE.md) · [`MSGF_STAGING_SEED.md`](../../msgf/technical-specs/MSGF_STAGING_SEED.md)  
**Domains:** [`DEPLOY_PRODUCT_DOMAINS.md`](../../DEPLOY_PRODUCT_DOMAINS.md)  
**MSGF ↔ Author env:** [`AUTHOR_MSGF_WIRING.md`](../../integrations/technical-specs/AUTHOR_MSGF_WIRING.md)

---

## What it is

Parallel Cloud Run services for Author client + BFF, pointed at **staging** Supabase / Upstash / Stripe **test** / `msgf-api-staging`. Production custom domains and beta waitlist stay untouched.

---

## Services & hosts

| Surface | Cloud Run | Staging host |
| :--- | :--- | :--- |
| Author client | `author-client-staging` | `staging.authorecosystem.elphiesyntax.com` |
| Author BFF | `author-bff-staging` | `staging-api.authorecosystem.elphiesyntax.com` |
| MSGF API | `msgf-api-staging` | `staging.elphiesgatedai.elphiesyntax.com` (or `*.run.app` until DNS) |

Dockerfiles: `docker/Dockerfile.author-bff`, `docker/Dockerfile.author-client`.  
Deploy: `npm run deploy:staging` / `.\deploy-staging.ps1` / `deploy-staging.sh` (Author section).  
Map domains: `./map-staging-domains.sh`.

---

## Author ↔ MSGF on staging

| Concern | Value |
| :--- | :--- |
| MSGF contract tenant | `author_ecosystem` (`STAGING_AUTHOR_TENANT_ID`) |
| Pulse license | Minted/ensured by staging seed; set `MSGF_AUTHOR_PULSE_LICENSE_KEY` on `author-bff-staging` |
| HAL pulse | `MSGF_AUTHOR_HAL_PULSE_ENABLED=1` on staging BFF when probing |
| `MSGF_APP_URL` | Staging MSGF URL (not production elphiesgatedai) |

After seed: `npm run staging:prepare` then redeploy Author BFF if a new Pulse license was written to `.env.cloudrun.staging`.

---

## Auth URLs (staging Supabase only)

Redirect allowlist must include:

- Staging MSGF `/auth/callback`
- Staging Author client `/auth/callback`
- Staging BFF callbacks if used

Site URL: staging MSGF host (or run.app). Never paste production Supabase URL into staging env — preflight blocks it.

---

## Smoke

```bash
# Mapping / optional pulse (needs staging JWT + env)
npm run probe:author-ecosystem -w msgf

curl https://staging-api.authorecosystem.elphiesyntax.com/api/ping
# or author-bff-staging-….run.app/api/ping
```

Beta waitlist and public Shadow trial remain **production** flows — staging is for operator promote checks.
