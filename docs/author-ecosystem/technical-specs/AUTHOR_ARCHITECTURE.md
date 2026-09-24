# Author Ecosystem — Architecture (BFF / Client / Extension)

**SSoT for how the Author product is packaged and wired locally and on Cloud Run.**  
**MSGF bridge details:** [`AUTHOR_MSGF_WIRING.md`](../../integrations/technical-specs/AUTHOR_MSGF_WIRING.md)  
**Roadmap:** [`AUTHOR_ECOSYSTEM_ROADMAP.md`](../AUTHOR_ECOSYSTEM_ROADMAP.md)

---

## Surfaces

| Surface | Package / path | Role |
| :--- | :--- | :--- |
| **BFF** | `apps/author-ecosystem/server` (`@elphie-syntax/author-ecosystem-server`) | Express API: auth, HAL, ingest, RAG, manuscripts, MSGF governance |
| **Client** | `apps/author-ecosystem/client` (`@elphie-syntax/author-ecosystem-client`) | Vite/React UI: hub, planning, drafting, cool-down, admin ops links |
| **Extension** | `apps/author-ecosystem/extension` | Chrome HAL + Librarian on Google Docs / Word Online |
| **Shared** | `@elphie-syntax/core`, `msgf`, `@elphie-syntax/ui` | Roadmap content, crypto, MSGF client helpers |
| **Legal SSOT** | `apps/author-ecosystem/nda/`, `terms/` | Vault Pact + role NDAs (client `?raw` + BFF disk read) |

Author is a **consumer** of MSGF (Pulse, Shadow/Active gateway, Vault/Hall, verify-result). It is not a second brain.

---

## Local ports

| App | Port | Notes |
| :--- | :---: | :--- |
| Leave free | **3000** | Other projects |
| MSGF | **3001** | `npm run dev -w msgf` |
| Author BFF | **3002** | `/api/*` |
| Author client | **5173** | Vite; proxies `/api` → BFF in local/dev |

```bash
npm run dev:author-msgf   # MSGF + Author BFF + client
# or: npm run dev:author  # BFF + client only
```

---

## Production / staging hosts

| Env | Client | BFF |
| :--- | :--- | :--- |
| **Prod** | `authorecosystem.elphiesyntax.com` (`author-client`) | `api.authorecosystem.elphiesyntax.com` (`author-bff`) — or same-origin `/api` via nginx |
| **Staging** | `staging.authorecosystem.elphiesyntax.com` (`author-client-staging`) | `staging-api.authorecosystem.elphiesyntax.com` (`author-bff-staging`) |

Global picker / hub: **https://elphiesyntax.com**. Staging runbook: [`AUTHOR_STAGING.md`](./AUTHOR_STAGING.md).

---

## Env (Author-facing)

**BFF** (see `apps/author-ecosystem/server/.env.example`; secrets usually from `packages/msgf/.env.local`):

| Variable | Purpose |
| :--- | :--- |
| `MSGF_APP_URL` | MSGF base (local `http://127.0.0.1:3001`) |
| `MSGF_AUTHOR_TENANT_ID` | Contract tenant slug (default `author_ecosystem`) |
| `MSGF_AUTHOR_PULSE_LICENSE_KEY` | Pulse license for Author traffic |
| `MSGF_AUTHOR_HAL_PULSE_ENABLED` | Forward HAL chunks to MSGF |
| `MSGF_AUTHOR_GATEWAY_MODE` / `MSGF_AUTHOR_ACTIVE_AGGRESSIVENESS` | Shadow / Active for Librarian+Critic |
| `MSGF_AUTHOR_REQUIRE_DEPLOY_GATE` | Editor hub advisory gate |
| `MSGF_DOCUMENT_INGEST_*` | Ingest pipeline — see ingest spec |
| `MSGF_HYBRID_KEM_ENABLED` | Optional Vault Pact seal envelope |

**Client:** `VITE_MSGF_APP_URL`, optional `VITE_AUTHOR_BFF_URL` when not same-origin.

**MSGF → Author handoff:** `AUTHOR_BFF_URL` / `AUTHOR_APP_URL` on MSGF.

---

## Data path (high level)

```text
Extension / Client  →  Author BFF (:3002)  →  Supabase (p4_*)
                              ↓
                         MSGF Pulse / gateway (:3001)
```

Two tenant IDs must not be confused — Author manuscript UUID vs MSGF slug `author_ecosystem`. Details in the wiring doc.

---

## Key entrypoints

| Concern | Path |
| :--- | :--- |
| BFF boot | `server/src/main.ts` |
| Client shell | `client/src/App.jsx` |
| HAL | `server/src/controllers/hal.controller.ts` |
| Ingest | `server/src/lib/documentIngest*.ts` |
| Hub UI | `client/src/components/ManuscriptHub.tsx` |
| RAG templates | `apps/author-ecosystem/docs/rag/` |
