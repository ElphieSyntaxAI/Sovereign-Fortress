# MSGF API cookbook (integrator)

Base URL: your `msgf.apiUrl` (default `https://elphiesgatedai.elphiesyntax.com`).

Auth: `Authorization: Bearer <token>` plus tenant headers on every call.

| Header | Value |
|--------|--------|
| `X-MSGF-Tenant-Key` | Workspace tenant / project origin |
| `x-msgf-tenant-id` | Same as tenant key |
| `x-msgf-access-role` | `dev` \| `company_admin` \| `global_admin` |
| `x-msgf-entity-id` | Stable machine id (optional) |
| `x-msgf-ide-pulse` | `1` on Pulse POST only |

### Dev session (save-primary pulse)

| Header | When |
|--------|------|
| `x-msgf-dev-session` | `1` — relaxed drift, local gateway bias |
| `x-msgf-flush-reason` | `save` \| `manual` \| `debounce` \| `build_end` |
| `x-msgf-active-file` | URI-encoded relative path on save flush |
| `x-msgf-build-active` | `1` while terminal build running |

---

## Setup & health

### GET `/api/msgf/ide/connectivity-check`

Probes auth, tenant, and pillar health. Response includes `x-msgf-error-code` on failure.

```bash
curl -sS "$MSGF_API_URL/api/msgf/ide/connectivity-check" \
  -H "Authorization: Bearer $MSGF_AUTH_TOKEN" \
  -H "X-MSGF-Tenant-Key: $MSGF_TENANT_KEY"
```

### GET `/api/workspace/ide-connectivity-check`

Same probes when using a browser session cookie instead of Bearer (workspace UI).

---

## Incidents & reporting

### POST `/api/msgf/report-issue`

Unified bug / friction report (increments `occurrence_count`, may open dev heal handoff).

Body: see `dev/requests/report-issue.json`.

### POST `/api/msgf/incidents/report`

Legacy alias — delegates to the same orchestrator.

---

## Agent context & heal

### GET `/api/msgf/agent-context?mode=guided|auto`

Returns a **0-Token Context Pack** narrative for agents. Optional `refactor_profile=website_modernization`.

### POST `/api/heal-queue` (action `DEV_CYCLE_START`)

Opens the dev heal cycle after incident threshold.

### POST `/api/msgf/verify-result`

Logs fix verification to `p4_narrative_logs`. Body: `dev/requests/verify-result.json`.

### POST `/api/msgf/dev-event`

Build failures — vault-first Heal Cheap (no biometric pulse chain).

---

## Compliance & tokens

### GET `/api/msgf/compliance/export`

Read-only compliance bundle for the tenant.

### POST `/api/workspace/ide-token`

Mint long-lived `msgf_ide_*` token (`?long_lived=1`).

### POST `/api/workspace/register-workspace`

Bind workspace folder to tenant after token mint.

---

## Pulse (IDE)

### POST `/api/msgf/pulse`

Keystroke batch from the extension. In **dev session**, prefer flush on save with `x-msgf-flush-reason: save`.

---

## MCP (Cursor)

See repo doc `docs/integrations/technical-specs/MSGF_IDE_MCP.md` and `packages/msgf/scripts/msgf-ide-mcp-server.mjs`.

Tools: `msgf_test_connection`, `msgf_get_context_pack`, `msgf_start_dev_heal_cycle`.

---

## npm package exports (in-repo integrators)

From `packages/msgf/package.json` exports:

- `msgf/ide-connector` — HTTP client helpers
- `msgf/remediation` — remediation engine types
- `msgf/onboarding` — onboarding flows
