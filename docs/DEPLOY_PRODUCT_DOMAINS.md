# Deploy authorecosystem + elphiesgatedai

Production map:

| Host | Cloud Run service | Image |
|------|-------------------|--------|
| `https://elphiesyntax.com` | `author-client` | `docker/Dockerfile.author-client` |
| `https://www.elphiesyntax.com` | `author-client` | same (platform hub) |
| `https://elphiesgatedai.elphiesyntax.com` | `msgf-api` | root `Dockerfile` |
| `https://authorecosystem.elphiesyntax.com` | `author-client` | `docker/Dockerfile.author-client` |
| `https://api.authorecosystem.elphiesyntax.com` | `author-bff` | `docker/Dockerfile.author-bff` |

## Prerequisites

1. **gcloud** authenticated: `gcloud auth login` (project `msgf-shield` or your GCP project).
2. **`.env.cloudrun`** at repo root — copy from `env.cloudrun.example` and fill Supabase + Upstash + `MSGF_AUTHOR_PULSE_LICENSE_KEY`.
3. **Supabase** → Authentication → URL configuration:
   - Site URL: `https://elphiesgatedai.elphiesyntax.com`
   - Redirect URLs: `https://elphiesgatedai.elphiesyntax.com/auth/callback`, `https://authorecosystem.elphiesyntax.com/auth/callback`
4. **Secret Manager** (MSGF): `gemini-key`, `anthropic-key` — used by `setup-cloud.sh`.
5. Mint production pulse license if needed: `npm run bootstrap:author-msgf -w msgf` (store key only in `.env.cloudrun`, never git).

## One-shot deploy (Git Bash or WSL)

```bash
cp env.cloudrun.example .env.cloudrun
# edit .env.cloudrun — all secrets and URLs

npm run validate:deployment
./deploy-product-domains.sh
```

Windows PowerShell:

```powershell
Copy-Item env.cloudrun.example .env.cloudrun
# edit .env.cloudrun
.\deploy-product-domains.ps1
```

## Troubleshooting (Git Bash on Windows)

| Error | Fix |
|-------|-----|
| `setup-author-cloud.sh: command not found` | Use `./setup-author-cloud.sh` from repo root |
| `Unable to read file [-]` on `gcloud builds submit` | Fixed in script — uses a temp YAML file, not `--config=-` |
| `Bad syntax for dict arg` on `--update-env-vars` | Fixed — `setup-cloud.sh` and `setup-author-cloud.sh` use `--env-vars-file` |
| MSGF image already built, deploy only failed | `SKIP_CLOUD_BUILD=1 IMAGE_TAG=c103094 ./setup-cloud.sh` |
| `author-bff` failed to start on **PORT=8080** | BFF crashed before `listen`. **(1)** Missing/placeholder Supabase env — run `npm run deploy:cloudrun:env` and redeploy. **(2)** `Container called exit(1)` with env OK — rebuild image with current `docker/Dockerfile.author-bff` (`NODE_OPTIONS=--conditions=development` so `msgf` does not load obfuscated `dist/` that imports `next/server`). Logs: `gcloud run services logs read author-bff --project=msgf-shield --region=us-central1 --limit=50` |
| API host name | Use **`api.authorecosystem.elphiesyntax.com`** (no underscore). Map with `AUTHOR_BFF_DOMAIN` in `.env.cloudrun`. |

Re-run after fixes: `./setup-author-cloud.sh`

## Step-by-step

```bash
# 1. MSGF (Gated AI)
./setup-cloud.sh

# 2. Author BFF + static client (client build uses BFF URL from step 2)
./setup-author-cloud.sh

# 3. Custom domains + DNS records from gcloud describe output
./map-product-domains.sh
```

Redeploy only Author client after BFF URL change:

```bash
AUTHOR_DEPLOY_TARGET=client ./setup-author-cloud.sh
```

## Apex hub (`elphiesyntax.com` picker)

The **“What are you looking for?”** platform chooser only renders when the browser hostname is `elphiesyntax.com` or `www.elphiesyntax.com` (see `apps/author-ecosystem/client/src/lib/authorHostRouting.js`). It is bundled in **author-client**, not MSGF.

If the apex still shows a Squarespace **Coming Soon** page, DNS has not been moved yet. Fix:

1. In your registrar (or Squarespace DNS), **remove** apex/`www` records that point at Squarespace.
2. Run `./map-product-domains.sh` (maps `AUTHOR_APEX_DOMAIN` / `AUTHOR_APEX_WWW_DOMAIN` from `.env.cloudrun`).
3. Add the Cloud Run DNS records from `gcloud run domain-mappings describe --domain=elphiesyntax.com`.
4. Redeploy client if needed: `AUTHOR_DEPLOY_TARGET=client ./setup-author-cloud.sh`

Smoke: `curl -sI https://elphiesyntax.com` should show `server: Google Frontend`, not `Squarespace`.

## Post-deploy smoke

```bash
curl -sI https://elphiesyntax.com
curl -sI https://elphiesgatedai.elphiesyntax.com/api/health
curl -sI https://authorecosystem.elphiesyntax.com
curl -sI https://api.authorecosystem.elphiesyntax.com/api/ping
```

Sign in on both subdomains; open MSGF token savings:  
`https://elphiesgatedai.elphiesyntax.com/dashboard#token-savings?tenant_id=author_ecosystem`

## Related docs

- [`TOMORROW_MSGF_AND_SUBDOMAINS.md`](./TOMORROW_MSGF_AND_SUBDOMAINS.md)
- [`AUTHOR_MSGF_WIRING.md`](./AUTHOR_MSGF_WIRING.md)
- [`MONOREPO_PRODUCTS.md`](./MONOREPO_PRODUCTS.md)
