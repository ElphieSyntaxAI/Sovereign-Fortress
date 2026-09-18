# MSGF Pulse Guard — quick reference

This folder is created by the **MSGF Pulse Guard** extension in your repo root.
Server-side Supabase and Redis are configured on the hosted MSGF deployment — you do not put those secrets here.

---

## First-time setup (do once)

1. **Sign in in your browser** (not inside the VS Code dashboard iframe):
   - https://elphiesgatedai.elphiesyntax.com/sign-in
2. **Map your project**: https://elphiesgatedai.elphiesyntax.com/setup/projects  
   Use **Add a custom project** with your local folder path and a `project_origin` tag (e.g. `your-org/your-app`).
3. **Copy IDE settings**: https://elphiesgatedai.elphiesyntax.com/workspace#ide-setup  
   Click **Mint long-lived IDE token**, then paste into **this repo’s** `.vscode/settings.json` (workspace settings only):
   - `msgf.enabled`: `true` (arms Pulse for this folder only)
   - `msgf.apiUrl`
   - `msgf.tenantKey`
   - `msgf.authToken` (long JWT — required for Pulse)
4. **Reload the editor window** (`Developer: Reload Window`).
5. **Monorepo (Elphie Syntax LLC):** either open `workspaces/author-ecosystem.code-workspace`, or open the git root and set `msgf.productPath` + `msgf.tenantKey` (run **MSGF: Configure monorepo product**). Keep your token in `apps/<app>/.vscode/settings.json` when using the git root.
6. Reload the editor window after any settings change.

---

## VS Code / Cursor commands

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run:

| Command | When to use |
| :--- | :--- |
| **MSGF: Sign in (open browser)** | You are not signed in on the web app |
| **MSGF: Open IDE token setup (browser)** | Refresh `msgf.authToken` after sign-in |
| **MSGF: Flush buffered Pulse now** | Force-send keystroke telemetry immediately |
| **MSGF: Open Dashboard** | Open governance dashboard in browser (use sign-in buttons in panel) |
| **MSGF: Open violation diagnostics** | After a red/yellow stoplight or wrong-logic alert |
| **MSGF: Enable for this workspace** | Turn Pulse on for this folder (default is off until you opt in) |
| **MSGF: Disable for this workspace** | Client or personal repos where MSGF must not run |
| **MSGF: Copy settings from User to this workspace** | Move tokens out of User settings so other folders stay off |

---

## Multiple repos (client vs business)

Pulse Guard loads in every window, but **MSGF stays off** until you opt in. The first time you open a folder, you'll get a **modal prompt** — choose **Enable MSGF** only for business repos. You can also set `msgf.enabled` in **workspace** settings.

| Repo type | What to do |
| :--- | :--- |
| **Business / monorepo** | Paste minted settings (includes `msgf.enabled: true`) into `.vscode/settings.json` at the folder you open |
| **Client work** | Do **not** set `msgf.enabled`, or run **MSGF: Disable for this workspace** |
| **Accidentally used User settings** | Run **MSGF: Copy settings from User to this workspace**, then delete `msgf.*` from User settings in Settings UI |

Use a **separate Cursor/VS Code profile** for client work if you want zero MSGF UI. Never put `msgf.authToken` in **User** settings — it applies to every folder you open.

---

## Cursor / VS Code — show the MSGF side panel

1. **Install the extension** — open `packages/msgf-pulse-guard` in the editor and run **Run Extension** (F5), or install a packaged `.vsix` if you have one.
2. **Open the Activity Bar** (left vertical strip). If it is hidden: **View → Appearance → Activity Bar** (or **Primary Side Bar**).
3. Click the **MSGF** icon (custom logo). That opens **Command Center** — the webview side panel (`msgf.dashboard`).
4. Or run **MSGF: Open Dashboard** from the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
5. If the panel is empty or asks you to sign in, use **MSGF: Sign in (open browser)** and **MSGF: Open IDE token setup (browser)** first, then **Developer: Reload Window**.

The panel hosts pillar stoplight, shadow scan, post-ingest healing (heal queue), and token estimates — same APIs as the web dashboard, scoped to your `msgf.tenantKey`.

---

## Activity bar — MSGF Operations

| Action | What it does |
| :--- | :--- |
| **Trigger Shadow Scan** | Uploads a sample of repo files to ingest; fills P1–P6 pillar health |
| Pillar stoplight | Green / yellow / red health per governance pillar |
| Post-ingest healing console | Remediation tasks after scan or violations |
| **Copy agent heal prompt** | Builds a markdown prompt for Cursor/Claude to fix files locally; cloud **Heal All** updates governance only |

Requires `msgf.authToken` in settings. If you see **Missing Authorization bearer token**, fix token setup above.

---

## Settings (workspace `.vscode/settings.json` only)

| Setting | Purpose |
| :--- | :--- |
| `msgf.enabled` | `true` to arm Pulse in this folder; omit or `false` for client/personal repos |
| `msgf.apiUrl` | MSGF host (default production gated-AI URL) |
| `msgf.tenantKey` | Mapped `project_origin` (`org/repo`), e.g. `elphiesyntax/author-ecosystem` — not a folder path |
| `msgf.productPath` | Monorepo only: `apps/author-ecosystem`, `packages/msgf`, etc. when workspace root is the git repo |
| `msgf.authToken` | Long-lived IDE token (`msgf_ide_*`) from workspace IDE setup — Bearer on every Pulse |
| `msgf.role` | Optional: `dev` (default), `company_admin`, `global_admin` |
| `msgf.licenseKey` | Only for integrators with `msgf_live_…` keys (most buyers leave empty) |
| `msgf.agentId` / `msgf.parentAgentId` / `msgf.agentRole` / `msgf.mandateHash` | Secondary / child agents — Active aborts a runaway wave; Global Brain stores **how** it failed, never the prompt |

If a setting seems ignored, confirm you edited **Workspace** (not User) and run **Developer: Reload Window**.

---

## Optional BYOK model keys (`keys/`)

For free-tier / bring-your-own-key routing, paste API keys into:

- `keys/gemini.key` — one line, your Gemini API key
- `keys/claude.key` — one line, your Anthropic API key

These files are gitignored. They are **not** Supabase or Redis credentials.

---

## Useful web links

| Page | URL |
| :--- | :--- |
| Sign in | https://elphiesgatedai.elphiesyntax.com/sign-in |
| Map projects | https://elphiesgatedai.elphiesyntax.com/setup/projects |
| IDE token + settings | https://elphiesgatedai.elphiesyntax.com/workspace#ide-setup |
| Dashboard | https://elphiesgatedai.elphiesyntax.com/dashboard |
| Token savings | https://elphiesgatedai.elphiesyntax.com/dashboard#token-savings |

---

## Is Pulse working?

1. Status bar should **not** say “Set msgf.authToken…”.
2. Type in a code file; wait **3 seconds** (or run **Flush buffered Pulse now**).
3. **Help → Toggle Developer Tools → Console** → filter `MSGF Guard` → look for `Telemetry buffer armed`.
4. Network tab → filter `pulse` → `POST …/api/msgf/pulse` with `Authorization: Bearer`.

First-time Pulse may return **baseline required** — keep typing naturally until responses succeed.

---

## Do not

- Sign in inside the embedded **MSGF Dashboard** editor tab (cookies block; use browser commands above).
- Put Supabase service role, Redis URL, or Cloud Run secrets in this repo.
- Use Elphie internal monorepo presets unless you are on an `@elphiesyntax.com` platform account.

---

## When to re-run Shadow Scan

- Once when onboarding a new repo
- After large refactors or new modules
- When pillar health stays yellow/red after fixes

Day-to-day coding only needs **Pulse** (automatic while you type).
