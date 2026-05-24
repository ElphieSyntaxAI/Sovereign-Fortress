# Docker local dev (Author + MSGF)

One command to run Redis, Author BFF, Author client, and MSGF — no juggling ports 3001/3002/5173 or multiple terminals.

## Prerequisites

1. **Docker Desktop** (Windows/Mac)
2. **`packages/msgf/.env.local`** with real Supabase values (not placeholders):

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   # or legacy anon key
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...                   # or legacy service_role key
# SUPABASE_JWT_SECRET=...  # optional (legacy projects only — not required with new API keys)
REDIS_HOST=redis               # set by compose for msgf/author-bff (do not use 127.0.0.1 inside containers)
REDIS_URL=redis://redis:6379   # optional; Redis is internal-only (not on host :6379)
```

3. First-time build takes several minutes (`npm ci` inside the image).

## Commands

| Command | What runs |
|---------|-----------|
| `npm run docker:preflight` | Validate `.env.local` before start |
| `npm run docker:dev` | **Clean start:** stop old compose + free ports 3001/3002/5173, then full stack |
| `npm run docker:dev:clean` | Stop compose and kill native processes on dev ports only |
| `npm run docker:dev:author` | Clean start: Author BFF + UI + Redis (no MSGF) |
| `npm run docker:dev:down` | Stop stack |
| `npm run docker:dev:logs` | Follow logs |

**Docker-only:** Do not run `npm run dev` / `dev:author` in separate terminals while using `docker:dev` — the same ports will conflict. Use `docker:dev:clean` first if you switched modes.

## URLs (from your browser)

| Service | URL |
|---------|-----|
| Author sign-in / register | http://127.0.0.1:5173/sign-in |
| Author BFF health | http://127.0.0.1:3002/api/ping |
| MSGF | http://127.0.0.1:3001 |
| MSGF admin (canonical) | http://127.0.0.1:3001/admin/sign-in |
| Author operator admin | http://127.0.0.1:5173/admin/sign-in → MSGF |
| Syntax Educates operator admin | http://127.0.0.1:5175/admin/sign-in → MSGF |

Register on Author requires Vault Pact: **`I SIGN THE VAULT PACT`**

## vs `npm run dev:author`

| | Docker | Native npm |
|--|--------|------------|
| Setup | One `docker:dev` after preflight | BFF + client (+ env on Windows) |
| Env | `packages/msgf/.env.local` only | Same file + load order quirks |
| Hot reload | Bind-mount source (slower on Windows) | Fastest on native Node |

Use Docker when native startup is painful; use native `npm run dev:author` when iterating on UI every few seconds.

## Troubleshooting

- **BFF unhealthy** — `docker compose -f docker-compose.dev.yml logs author-bff` — usually missing `SUPABASE_JWT_SECRET`.
- **Port in use** — stop old `npm run dev` processes or change published ports in `docker-compose.dev.yml`.
- **Still “Could not reach BFF”** — wait until healthcheck passes; open http://127.0.0.1:3002/api/ping first.

Production deploy remains `setup-cloud.sh` / Cloud Run; this compose file is **dev only**.
