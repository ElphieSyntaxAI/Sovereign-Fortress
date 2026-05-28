# MSGF IDE Setup & Production Connectivity Runbook

**Audience:** Integrators (Deckhost, solo devs), ops.  
**Production API:** `https://elphiesgatedai.elphiesyntax.com`

---

## Required workspace settings

Put these in **`.vscode/settings.json`** (workspace scope), not only User settings:

```json
{
  "msgf.apiUrl": "https://elphiesgatedai.elphiesyntax.com",
  "msgf.tenantKey": "your-tenant/project_origin",
  "msgf.authToken": "<from Workspace IDE setup Refresh token>",
  "msgf.role": "dev"
}
```

**Common mistakes:**

- Trailing `"` on `msgf.tenantKey` (e.g. `deckhostwmsgf/deck_host"`) → auth/tenant failures.
- Token expired → refresh at `/workspace#ide-setup`, re-apply settings.
- Wrong tenant → map project at `/setup/projects` first.

---

## P0 checklist (504 / offline)

| Check | Action |
|-------|--------|
| API reachable | Open `/status` on production host |
| Auth | `GET /api/msgf/health/pillars` with `Authorization: Bearer <token>` — expect 200, not 401 |
| Cold start | Retry after 30s; 504 often Cloud Run cold start |
| Tenant | `msgf.tenantKey` must match `project_origin` from Setup projects |
| Extension | Run **MSGF: Test connection** — read `[ERROR_CODE]` in message |

---

## Extension commands

| Command | Purpose |
|---------|---------|
| MSGF: Run setup wizard | Browser → clipboard → apply → test |
| MSGF: Apply workspace settings from clipboard | Merge web JSON into `.vscode/settings.json` |
| MSGF: Test connection | `GET /api/msgf/ide/connectivity-check` |
| MSGF: Open IDE token setup (browser) | `/workspace#ide-setup` |
| MSGF: Generate 0-token context pack | `GET /api/msgf/agent-context?mode=guided` |
| MSGF: Submit verify result | `POST /api/msgf/verify-result` (after local fix) |

Full production deploy steps: [MSGF_DEPLOY_CHECKLIST.md](./MSGF_DEPLOY_CHECKLIST.md).

---

## Error codes (IDE)

| Code | Meaning | Fix |
|------|---------|-----|
| `AUTH_EXPIRED` | JWT expired | Refresh token on web, re-apply settings |
| `AUTH_INVALID` | Bad bearer / quotes | Re-copy token, sanitize settings |
| `TENANT_MISMATCH` | Header ≠ license/profile tenant | Fix Setup projects mapping |
| `GATEWAY_504` | Gateway timeout | Retry; check Cloud Run |
| `DNS_UNREACHABLE` | fetch failed / bad URL | Check `msgf.apiUrl` |

---

## Deckhost example

1. Gated AI → Setup projects → `deckhostwmsgf/deck_host`.
2. Workspace → IDE setup → select project → **Test connection** → all green.
3. Copy settings → Cursor → **Apply workspace settings from clipboard** → Reload → **Test connection**.
