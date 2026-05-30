# Cursor / VS Code workspaces

Open one of these **instead of** the bare monorepo root when you want MSGF scoped to a single app without extra configuration.

| File | Use when coding |
|------|-----------------|
| `author-ecosystem.code-workspace` | Author (`apps/author-ecosystem`) |
| `msgf-gated-ai.code-workspace` | MSGF platform (`packages/msgf`) |

**Monorepo root:** If you open `ElphieSyntaxLLC` as the folder, set `msgf.productPath` in root `.vscode/settings.json` (see repo root) and keep your long-lived token in `apps/<app>/.vscode/settings.json`, or run **MSGF: Configure monorepo product** from the Command Palette.
