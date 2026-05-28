# MSGF workspace kit

This folder is managed by **MSGF Pulse Guard**. Use it to connect your project to the MSGF API and build on platform features.

## Quick start

1. **IDE settings** — Run **MSGF: Run setup wizard** or paste settings from [Workspace → IDE setup](https://elphiesgatedai.elphiesyntax.com/workspace#ide-setup).
2. **Test connection** — Command Palette → **MSGF: Test connection**, or:

   ```powershell
   cd .msgf/dev/scripts
   .\test-connection.ps1
   ```

3. **API reference** — Open [`dev/api-cookbook.md`](./dev/api-cookbook.md).
4. **Sample requests** — Copy bodies from [`dev/requests/`](./dev/requests/).
5. **Optional env file** — Copy `dev/env.example.json` → `dev/env.local.json` (gitignored) for scripts.

## Dev session (recommended for integrators)

Enable vibe-coding mode in `.vscode/settings.json` (Workspace → IDE setup includes this for integrators):

```json
{
  "msgf.devSession": true
}
```

With **MSGF Pulse Guard** reloaded, Pulse flushes on **file save** only (`x-msgf-flush-reason: save`), not every ~3 seconds. Use **MSGF: Flush buffered Pulse now** for a manual flush. See `dev/api-cookbook.md` for headers.

## VS Code tasks

Merge [`dev/tasks/msgf-tasks.json`](./dev/tasks/msgf-tasks.json) into your repo `.vscode/tasks.json`, or run tasks from the Command Palette after merge.

## Refresh templates

**MSGF: Sync developer kit** — updates scripts, request samples, and tasks without touching your keys.

## Layout

| Path | Purpose |
|------|---------|
| `keys/` | BYOK provider keys (gitignored) |
| `USER-GUIDE.md` | Extension command reference |
| `dev/api-cookbook.md` | HTTP API catalog |
| `dev/scripts/` | PowerShell, bash, Node smokes |
| `dev/requests/` | JSON fixtures for curl / REST clients |
