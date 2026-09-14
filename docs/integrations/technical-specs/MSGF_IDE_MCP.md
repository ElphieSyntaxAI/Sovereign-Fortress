# MSGF IDE MCP (P3)

Optional Cursor MCP wiring for agent handoff tools against your deployed MSGF API.

## Environment

| Variable | Description |
|----------|-------------|
| `MSGF_API_URL` | e.g. `https://elphiesgatedai.elphiesyntax.com` |
| `MSGF_AUTH_TOKEN` | Bearer token from Workspace → IDE setup |
| `MSGF_TENANT_KEY` | e.g. `deckhostwmsgf/deck_host` |

## Tools (via `packages/msgf/scripts/msgf-ide-mcp-server.mjs`)

| Tool | API |
|------|-----|
| `testConnection` | `GET /api/msgf/ide/connectivity-check` |
| `getContextPack` | `GET /api/msgf/agent-context?mode=guided` |
| `startDevHealCycle` | `POST /api/msgf/heal-queue` `DEV_CYCLE_START` |
| `submitVerifyResult` | `POST /api/msgf/verify-result` |

## Cursor config example

Add to `.cursor/mcp.json` (project or user):

```json
{
  "mcpServers": {
    "msgf": {
      "command": "node",
      "args": ["packages/msgf/scripts/msgf-ide-mcp-server.mjs"],
      "env": {
        "MSGF_API_URL": "https://elphiesgatedai.elphiesyntax.com",
        "MSGF_AUTH_TOKEN": "<from-workspace-ide-setup>",
        "MSGF_TENANT_KEY": "deckhostwmsgf/deck_host"
      }
    }
  }
}
```

Install SDK once at repo root if needed: `npm install @modelcontextprotocol/sdk -w msgf`
