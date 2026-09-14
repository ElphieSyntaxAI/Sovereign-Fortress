# MSGF IDE Integration — Index (SSoT)

**Status:** Living index for V3.2-ULTRA IDE work (extension, workspace setup, agent handoff).  
**Companion:** [MSGF_V1_ROADMAP.md](../../msgf/MSGF_V1_ROADMAP.md) · [MONOREPO_PRODUCTS.md](../../MONOREPO_PRODUCTS.md)

---

## Canonical specs

| Doc | Purpose |
|-----|---------|
| [MSGF_AGENT_EXECUTION_MATRIX.md](../../msgf/build-plans/MSGF_AGENT_EXECUTION_MATRIX.md) | Two-tier remediation (Fix Myself / Auto-Apply), token budgeting |
| [MSGF_DX_ELEVATION_PLAN.md](../../msgf/build-plans/MSGF_DX_ELEVATION_PLAN.md) | HAL friction → 0-Token Context Pack |
| [MSGF_IDE_SETUP_RUNBOOK.md](./MSGF_IDE_SETUP_RUNBOOK.md) | Production 504/auth, workspace settings, connectivity |
| [MSGF_PRODUCT_OVERVIEW.md](../../msgf/marketing/MSGF_PRODUCT_OVERVIEW.md) | Product capabilities, use cases, marketing by persona |

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
| **P4** | `msgf_ide_*` tokens, `POST register-workspace`, `vscode://` deep link, `GET compliance/export`, BULK blocked when HITL pending |
| **P5 (M4c)** | Command Center: prompt optimizer, Run Scripts, Safe Build; verify-result Vault/Hall; savings dashboard; allowlisted `execFile` |
| **P6 (M4d)** | Setup wizard, monorepo product scoping, `.msgf/dev/` integrator kit, BYOK Small Brain provider, async preflight + signed skip — extension **v0.2.3** |

---

## What cloud heal is not

- **Heal All (BULK)** updates governance (Vault/Hall, heal queue) — not guaranteed repo file patches.
- **Fix Myself** = developer + agent edits with guided context pack (0-token MSGF path for diagnostics).
