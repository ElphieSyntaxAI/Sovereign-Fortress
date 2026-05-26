# Tomorrow: MSGF-on while coding + subdomain deploy

**Goal:** Compare token usage **with MSGF** (HAL Pulse, CONVERGE, dev-session) vs **without**, and ship **authorecosystem** + **elphiesgatedai** subdomains.

---

## Part A — Run tonight (local prep)

### 1. Env (single file: `packages/msgf/.env.local`)

| Variable | Value / action |
|----------|----------------|
| `MSGF_APP_URL` | `http://127.0.0.1:3001` (not `:3000`) |
| `MSGF_LOCAL_DEV_URL` | `http://127.0.0.1:3001` |
| `MSGF_AUTHOR_TENANT_ID` | `author_ecosystem` |
| `MSGF_AUTHOR_PULSE_LICENSE_KEY` | From `npm run bootstrap:author-msgf -w msgf` (minted once; store securely) |
| `MSGF_AUTHOR_HAL_PULSE_ENABLED` | `1` |
| `MSGF_AUTHOR_DEV_SESSION` | `1` — counts vibe-coding / dev pulses toward 24h savings panel |
| `REDIS_URL` | `redis://127.0.0.1:6379` when running MSGF/BFF on host; Docker compose overrides to `redis://redis:6379` inside containers |
| `GCP_*` / `GOOGLE_APPLICATION_CREDENTIALS` | Already set for CONVERGE / ingest LLM |
| `OPENAI_API_KEY` | Optional but recommended for wiki embeddings + lore vector ingest quality |

### 2. Mint / verify Author ↔ MSGF bridge

```bash
cd ElphieSyntaxLLC
npm run bootstrap:author-msgf -w msgf    # if key not already in .env.local
npm run verify:bff-env --prefix apps/author-ecosystem/server
```

Expect: **MSGF bridge: OK**, token savings URL on `:3001`, MSGF reachable.

### 3. Start full stack (recommended)

```bash
npm run docker:preflight
npm run docker:dev          # Redis + Author (5173/3002) + MSGF (3001)
```

Or host-native:

```bash
# Terminal 1 — Redis (Docker only)
docker compose -f docker-compose.dev.yml up -d redis

# Terminal 2 — MSGF
npm run dev -w msgf

# Terminal 3 — Author
npm run dev:author
```

### 4. Smoke before tomorrow’s A/B tests

```bash
npm run probe:author-ecosystem -w msgf
curl http://127.0.0.1:3002/api/ping
curl http://127.0.0.1:3001/api/health
```

Sign in:

- Author: http://127.0.0.1:5173  
- MSGF dashboard: http://127.0.0.1:3001/dashboard#token-savings?tenant_id=author_ecosystem  
- MSGF admin: http://127.0.0.1:3001/admin/dashboard#token-savings?tenant_id=author_ecosystem  

---

## Part B — Tomorrow: token savings A/B (vibe coding + Author)

### With MSGF (baseline “gated”)

1. `MSGF_AUTHOR_HAL_PULSE_ENABLED=1`, `MSGF_AUTHOR_DEV_SESSION=1`  
2. Use Author + extension / HAL chunk-pulse while editing.  
3. Optional: `MSGF_DOCUMENT_INGEST_MODE=converge` for document import LLM path.  
4. Watch **Token savings** + **Pulse routing** on MSGF dashboard (`tenant_id=author_ecosystem`).

### Without MSGF (comparison)

| Knob | Effect |
|------|--------|
| `MSGF_AUTHOR_HAL_PULSE_ENABLED=0` | HAL stops forwarding to Pulse (no routing savings counters) |
| `MSGF_DOCUMENT_INGEST_MODE=heuristic` | Ingest scan skips CONVERGE LLM |
| Commit already sets `sync_msgf_brain: false` | Document commit does not POST full sweep to MSGF ingest |

Restart **author-bff** after env changes. Run the same editing session length, then compare dashboard counters vs the “with MSGF” run.

### CLI savings report

```bash
npm run track:author-tokens -w msgf              # offline scenarios
npm run track:author-tokens:live -w msgf         # needs BFF + JWT in AUTHOR_ECOSYSTEM_JWT
```

---

## Part C — Subdomain deploy (before DNS cutover)

### 1. Pre-deploy gates

```bash
npm run test:author
npm run test:unit -w msgf
npm run validate:deployment
```

### 2. Supabase (Authentication → URL configuration)

- **Site URL:** `https://elphiesgatedai.elphiesyntax.com`  
- **Redirect URLs:**  
  - `https://elphiesgatedai.elphiesyntax.com/auth/callback`  
  - `https://authorecosystem.elphiesyntax.com/auth/callback`  
  - Local dev callbacks if still needed  

### 3. Production env — MSGF (`elphiesgatedai`)

- `MSGF_APP_URL` / `NEXT_PUBLIC_MSGF_APP_URL` = `https://elphiesgatedai.elphiesyntax.com`  
- `MSGF_AUTH_COOKIE_DOMAIN=.elphiesyntax.com`  
- `MSGF_AUTH_COOKIE_SECURE=1`  
- `REDIS_URL` = Upstash (not `127.0.0.1`) — see Cloud Run / `.env.cloudrun` pattern in deploy scripts  
- `GOOGLE_APPLICATION_CREDENTIALS` / Vertex service account on Cloud Run  
- All Supabase keys from current project  

### 4. Production env — Author BFF + client (`authorecosystem`)

**BFF:**

- `MSGF_APP_URL=https://elphiesgatedai.elphiesyntax.com`  
- `MSGF_AUTHOR_PULSE_LICENSE_KEY` = production-minted key (separate from local `msgf_live_…` if desired)  
- `MSGF_AUTHOR_DEV_SESSION=1` (optional in prod; use for staged testing only)  
- `BFF_ALLOWED_ORIGINS=https://authorecosystem.elphiesyntax.com,https://elphiesgatedai.elphiesyntax.com`  

**Client build:**

- `VITE_AUTHOR_BFF_URL` = Author API origin (same host or `api.authorecosystem…`)  
- `VITE_MSGF_APP_URL=https://elphiesgatedai.elphiesyntax.com`  

### 5. DNS / deploy

```powershell
.\setup-cloud.ps1    # or ./setup-cloud.sh — MSGF Cloud Run
```

Deploy Author client + BFF to `authorecosystem` (your existing GCP/ hosting path). Map DNS CNAMEs after services are healthy.

### 6. Post-deploy smoke

1. Sign in on **authorecosystem** → manuscript hub.  
2. Sign in on **elphiesgatedai** → `/admin/dashboard#token-savings?tenant_id=author_ecosystem`.  
3. One HAL pulse or `probe:author-ecosystem` against production URLs.  
4. Confirm Redis savings counters increment on production Upstash.

---

## Quick reference URLs

| Environment | Author UI | MSGF | BFF |
|-------------|-----------|------|-----|
| Local | http://127.0.0.1:5173 | http://127.0.0.1:3001 | http://127.0.0.1:3002 |
| Production | https://authorecosystem.elphiesyntax.com | https://elphiesgatedai.elphiesyntax.com | (your BFF host) |

---

## Docs

- [`AUTHOR_MSGF_WIRING.md`](./AUTHOR_MSGF_WIRING.md)  
- [`MONOREPO_PRODUCTS.md`](./MONOREPO_PRODUCTS.md)  
- [`DOCKER_LOCAL_DEV.md`](./DOCKER_LOCAL_DEV.md)  
- [`MSGF_TESTING.md`](./MSGF_TESTING.md)  
