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
   Click **Refresh token**, then paste into `.vscode/settings.json`:
   - `msgf.apiUrl`
   - `msgf.tenantKey`
   - `msgf.authToken` (long JWT — required for Pulse)
4. **Reload the editor window** (`Developer: Reload Window`).
5. Open **this repo folder** as the workspace root (File → Open Folder).

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

## Settings (`.vscode/settings.json` or User settings)

| Setting | Purpose |
| :--- | :--- |
| `msgf.apiUrl` | MSGF host (default production gated-AI URL) |
| `msgf.tenantKey` | Must match your mapped `project_origin` on the web app |
| `msgf.authToken` | Supabase access JWT from **Refresh token** (Bearer on every Pulse) |
| `msgf.role` | Optional: `dev` (default), `company_admin`, `global_admin` |
| `msgf.licenseKey` | Only for integrators with `msgf_live_…` keys (most buyers leave empty) |

**Tip:** If workspace settings are ignored, paste `msgf.authToken` under **User** settings in Cursor/VS Code (`Ctrl+,` → search `msgf.authToken`).

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
