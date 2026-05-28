# MSGF IDE Integration — Index (SSoT)

**Status:** Living index for V3.2-ULTRA IDE work (extension, workspace setup, agent handoff).  
**Companion:** [MSGF_V1_ROADMAP.md](./MSGF_V1_ROADMAP.md) · [MONOREPO_PRODUCTS.md](./MONOREPO_PRODUCTS.md)

---

## Canonical specs

| Doc | Purpose |
|-----|---------|
| [MSGF_AGENT_EXECUTION_MATRIX.md](./MSGF_AGENT_EXECUTION_MATRIX.md) | Two-tier remediation (Fix Myself / Auto-Apply), token budgeting |
| [MSGF_DX_ELEVATION_PLAN.md](./MSGF_DX_ELEVATION_PLAN.md) | HAL friction → 0-Token Context Pack |
| [MSGF_IDE_SETUP_RUNBOOK.md](./MSGF_IDE_SETUP_RUNBOOK.md) | Production 504/auth, workspace settings, connectivity |

---

## Layer model

| Layer | Location | Owns |
|-------|----------|------|
| L0 Core | `packages/msgf/lib`, `app/api/msgf/*` | Pulse, ingest, heal-queue, agent-context (planned), connectivity-check |
| L1 Connectors | `msgf/connector`, hal bridge | Typed clients |
| L2 Products | `packages/msgf/app`, Author, Education | UX, IDE setup page |
| L3 IDE | `packages/msgf-pulse-guard` | Extension, setup wizard, classified errors |

---

## IDE setup flow (shipped / in progress)

1. Sign in at **Workspace → IDE setup** (`/workspace#ide-setup`).
2. Map project at **Setup projects** (`/setup/projects`) — e.g. `deckhostwmsgf/deck_host`.
3. **Refresh token** → copy JSON → in Cursor: **MSGF: Apply workspace settings from clipboard**.
4. **MSGF: Test connection** (extension) or **Test connection** (web).
5. Install extension VSIX → type → flush Pulse.

**APIs:**

- `GET /api/workspace/ide-credentials?project_origin=`
- `GET /api/workspace/ide-connectivity-check?project_origin=` (browser)
- `GET /api/msgf/ide/connectivity-check` (extension + IDE headers)

---

## Build phases (summary)

| Phase | Focus |
|-------|--------|
| **P0** | Cloud stable, classified IDE errors, canonical docs |
| **P1** | Connectivity-check, setup wizard, report-issue, agent-context |
| **P2** | Dev heal cycle, two-tier heal UI, HAL friction notice |
| **P3** | `POST verify-result`, `GET refactoring-directive`, HAL friction notice, MCP ([MSGF_IDE_MCP.md](./MSGF_IDE_MCP.md)) |
| **P4** | Long-lived IDE token, disk auto-patch (optional) |

---

## What cloud heal is not

- **Heal All (BULK)** updates governance (Vault/Hall, heal queue) — not guaranteed repo file patches.
- **Fix Myself** = developer + agent edits with guided context pack (0-token MSGF path for diagnostics).
