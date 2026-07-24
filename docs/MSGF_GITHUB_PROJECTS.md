# MSGF — GitHub project picker (Setup → Projects)

**Purpose:** Connect GitHub via Supabase OAuth, multi-select repos, and map them into `msgf_user_projects`. Local monorepo subfolders use the browser folder picker / manual paths on the same page.

**UI:** `/setup/projects` (signed-in) · **APIs:** `/api/msgf/github/*`, `POST /api/msgf/projects/bulk`

---

## 1. Ops setup (required before Connect GitHub works)

### A. GitHub OAuth App

1. GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**
2. **Homepage URL:** your MSGF host (e.g. `https://elphiesgatedai.elphiesyntax.com`)
3. **Authorization callback URL:** Supabase Auth callback:

   `https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`

4. Create the app → copy **Client ID** and generate a **Client Secret**

### B. Supabase Auth — GitHub provider

1. Supabase Dashboard → **Authentication → Providers → GitHub**
2. Enable GitHub
3. Paste Client ID + Client Secret
4. Request scopes: **`read:user`** and **`repo`** (needed to list private repos the user can access)
5. Save

### C. Redirect allowlist

In Supabase **Authentication → URL configuration**:

- **Site URL:** MSGF production (or `http://127.0.0.1:3000` for local)
- **Redirect URLs** include:
  - `https://elphiesgatedai.elphiesyntax.com/auth/callback`
  - `https://elphiesgatedai.elphiesyntax.com/setup/projects`
  - local equivalents if developing

### D. Encryption env

GitHub `provider_token` is stored encrypted in `msgf_user_github_connections`.

| Env | Role |
| :--- | :--- |
| `CRYPTO_SECRET_KEY` | Required in non-production (32-byte UTF-8 or 64-char hex) |
| `MSGF_KMS_CRYPTO_KEY_PATH` | Required when `NODE_ENV=production` (KMS envelope) |

### E. Database

Apply migration:

`packages/msgf/supabase/migrations/20260724010000_msgf_user_github_connections.sql`

```bash
npm run db:push -w msgf
# or your usual migrate path
```

---

## 2. User flow

1. Sign in to MSGF (email/password or existing session).
2. Open **Setup → Projects**.
3. Click **Connect GitHub** → Supabase `linkIdentity` / OAuth → `/auth/callback` persists `provider_token`.
4. Multi-select repos → **Add selected** → rows in `msgf_user_projects`.
5. IDE: one `msgf.authToken` (User settings) + per-project `msgf.tenantKey` = that row’s `project_origin`.

### Local / monorepo

- **Pick parent folder** (Chrome/Edge) → check subfolders, set absolute parent path → Add selected.
- Or paste parent path + relative children (`apps/foo`, `packages/msgf`) one per line.

GitHub multi-select maps **whole repos**. Nested apps inside one git repo use the **local** subfolder flow.

---

## 3. Troubleshooting

| Symptom | Fix |
| :--- | :--- |
| Connect redirects then errors | GitHub provider disabled or wrong callback URL in GitHub OAuth App |
| `GITHUB_NOT_CONNECTED` on list | Token not persisted — reconnect; confirm `CRYPTO_SECRET_KEY` / KMS |
| Empty private repos | Add `repo` scope on the GitHub provider in Supabase |
| Folder picker missing | Use Chrome/Edge or manual parent + child paths |

---

## Related

- [`MSGF_IDE_SETUP_RUNBOOK.md`](./MSGF_IDE_SETUP_RUNBOOK.md) — IDE token + `tenantKey`
- [`MSGF_SOLO_INTEGRATION.md`](./MSGF_SOLO_INTEGRATION.md) — API license path (separate from GitHub picker)
