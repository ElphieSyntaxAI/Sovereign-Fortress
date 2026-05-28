# MSGF integrator developer kit

When **MSGF Pulse Guard** activates in a workspace, it scaffolds `.msgf/` with keys, a user guide, and an **integrator dev kit** under `.msgf/dev/`.

## What gets created

| Path | Purpose |
|------|---------|
| `.msgf/README.md` | Start here — setup flow |
| `.msgf/USER-GUIDE.md` | Extension commands |
| `.msgf/dev/api-cookbook.md` | HTTP API catalog |
| `.msgf/dev/env.example.json` | Non-secret env template |
| `.msgf/dev/env.local.json` | Your secrets (gitignored) |
| `.msgf/dev/requests/*.json` | Sample bodies for report-issue, verify, etc. |
| `.msgf/dev/scripts/` | `test-connection.ps1`, `test-connection.sh`, `smoke-integrator.mjs` |
| `.msgf/dev/tasks/msgf-tasks.json` | Merge into `.vscode/tasks.json` |
| `.msgf/keys/` | BYOK provider keys (gitignored) |

## IDE commands

- **MSGF: Open developer kit** — opens `.msgf/README.md`
- **MSGF: Sync developer kit** — refreshes scripts, requests, and tasks templates

## Terminal (Windows)

```powershell
cd .msgf\dev\scripts
.\test-connection.ps1
```

Set `MSGF_API_URL`, `MSGF_AUTH_TOKEN`, and `MSGF_TENANT_KEY`, or copy `dev/env.example.json` → `dev/env.local.json`.

## Live integrator smoke (optional)

```bash
node .msgf/dev/scripts/smoke-integrator.mjs
```

Skips when no token is configured; otherwise hits connectivity-check and agent-context.

## CI / monorepo

```bash
npm run smoke:dev-kit -w msgf
npm run smoke:all -w msgf
```

## Related docs

- [`MSGF_IDE_SETUP_RUNBOOK.md`](./MSGF_IDE_SETUP_RUNBOOK.md)
- [`MSGF_IDE_MCP.md`](./MSGF_IDE_MCP.md)
- [`MSGF_DEPLOY_CHECKLIST.md`](./MSGF_DEPLOY_CHECKLIST.md)
