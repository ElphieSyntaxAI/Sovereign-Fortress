# MSGF Pulse Guard (VS Code / Cursor)

IDE extension for **MSGF V3.2-ULTRA** — micro-batched editor telemetry to the centralized Pulse gateway on Cloud Run.

| V3.2 surface | Value |
|--------------|--------|
| Production host | `https://elphiesgatedai.elphiesyntax.com` |
| Pulse gateway | `POST /api/msgf/pulse` |
| Default `msgf.apiUrl` | Same production host (override for local Next dev) |
| Batch cadence | 3 seconds (rolling buffer, non-blocking `fetch`) |
| IDE marker header | `x-msgf-ide-pulse: 1` |

The extension reads `vscode.workspace.getConfiguration('msgf')`, listens on `onDidChangeTextDocument`, buffers change events locally, and flushes JSON `{ keystrokes: [...] }` to `${apiUrl}/api/msgf/pulse` with `Content-Type: application/json` and `X-MSGF-Tenant-Key` (mirrored as `x-msgf-tenant-id` for the Pulse API).

---

## Prerequisites

- **Node.js** 20+ (matches the monorepo toolchain)
- **VS Code** or **Cursor** 1.85+
- Network access to your target MSGF host (production Cloud Run or local `packages/msgf`)

---

## 1. Install dependencies and compile the bundle

All extension-specific dependencies live in this package. The repository bundles with **esbuild** (not `tsc` emit for runtime — `tsc` is typecheck-only).

From the monorepo root:

```bash
cd packages/msgf-pulse-guard
npm install
npm run compile
```

| Script | Purpose |
|--------|---------|
| `npm run compile` | One-shot esbuild → `out/extension.js` (+ source map) |
| `npm run watch` | esbuild watch mode while developing |
| `npm run typecheck` | `tsc --noEmit` (types only; does not produce `out/`) |
| `npm run package` | `vsce package` after compile (`.vsix` for sideload) |

**Bundler entry:** `esbuild.config.mjs` bundles `src/extension.ts` → `out/extension.js` (`platform: node`, `external: vscode`). Re-run `npm run compile` after any `src/` change before reloading the Extension Development Host.

---

## 2. Extension Development Host (F5)

Open **`packages/msgf-pulse-guard`** as the VS Code/Cursor workspace folder (or use the included launch config from this folder).

1. Run `npm install` and `npm run compile` once (see above).
2. Open **Run and Debug** (`Ctrl+Shift+D` / `Cmd+Shift+D`).
3. Select **Run Extension** and press **F5** (or **Start Debugging**).

A second window opens — the **Extension Development Host**. It loads this extension from `out/extension.js`. The pre-launch task runs `npm run compile` automatically.

**Reload after code changes:** in the Extension Development Host, run **Developer: Reload Window** (`Ctrl+R` / `Cmd+R`), or stop and press **F5** again from the parent window.

### Configure the test host

In the **Extension Development Host** window, set User or Workspace settings (`Ctrl+,` → search `msgf`):

```json
{
  "msgf.tenantKey": "your-tenant-or-repo-id",
  "msgf.authToken": "your-personal-or-service-token",
  "msgf.apiUrl": "https://elphiesgatedai.elphiesyntax.com",
  "msgf.role": "dev",
  "msgf.organizationId": "",
  "msgf.entityId": ""
}
```

| Setting | V3.2 role |
|---------|-----------|
| `msgf.tenantKey` | Sent as `X-MSGF-Tenant-Key` and `x-msgf-tenant-id` |
| `msgf.authToken` | **Required** — `Authorization: Bearer …` on every Pulse flush |
| `msgf.apiUrl` | Base URL for `POST …/api/msgf/pulse` (defaults to production gated-AI host) |
| `msgf.role` | Optional `global_admin` \| `company_admin` \| `dev` → `x-msgf-access-role` |
| `msgf.organizationId` | Team org id (`x-msgf-organization-id`). When empty with a personal token, IDE may send `x-msgf-fallback-role: company_admin` for sandbox admin |
| `msgf.licenseKey` | Legacy `msgf_live_…` fallback if `authToken` is unset |
| `msgf.entityId` | Optional `x-msgf-entity-id`; defaults to a stable machine id |

On **403 Forbidden** (RBAC), the extension pauses the 3s buffer and shows: `[MSGF Security] Permission Denied: Insufficient privileges for this tenant scope.`

**Local API instead of Cloud Run:** point `msgf.apiUrl` at `http://localhost:3000` (or your `packages/msgf` dev server) and run the Next app there; logs appear in that terminal instead of GCP.

---

## 3. Testing checklist (mock document → Pulse → Cloud Run logs)

Use this sequence in the **Extension Development Host** window only.

### A. Arm the extension

- [ ] Status bar shows an MSGF Guard item (left side). If settings are incomplete, fix `msgf.apiUrl` and reload.
- [ ] Open **Output** → select **Log (Extension Host)** or open **Help → Toggle Developer Tools → Console** and confirm: `[MSGF Guard] Telemetry buffer armed · tenant=… · api=…`

### B. Mock editing session

- [ ] **File → New Text File** (or open any file under a workspace folder).
- [ ] Type several single characters at a normal rhythm (not a huge paste).
- [ ] Status bar `buffered` count should rise while typing; routing may show **buffering**.
- [ ] Wait **≥ 3 seconds** without typing so the micro-batch timer flushes, **or** run command palette → **MSGF: Flush buffered Pulse now** (`msgf.flushPulse`).

### C. Verify the HTTP batch (extension side)

- [ ] In Developer Tools **Network** (Extension Host), filter for `pulse` — expect `POST` to `{msgf.apiUrl}/api/msgf/pulse`.
- [ ] Request headers include `Content-Type: application/json`, `X-MSGF-Tenant-Key`, `x-msgf-ide-pulse: 1`, and `x-msgf-entity-id`.
- [ ] Request body is JSON: `{ "keystrokes": [ { "ts", "key", "type", "target" }, … ] }` where `target` carries URI/workspace path metadata.
- [ ] Response is non-blocking on failure (editor stays responsive); `4xx`/`5xx` log under `[MSGF Guard] flush failed` in the console only.

### D. Verify centralized Cloud Run logs (V3.2 production)

With `msgf.apiUrl` set to `https://elphiesgatedai.elphiesyntax.com`:

- [ ] In **Google Cloud Console** → **Cloud Run** → your MSGF service → **Logs**, filter around the test time.
- [ ] Look for ingress/handlers mentioning `POST /api/msgf/pulse`, IDE pulse, or your `msgf.tenantKey` / `trace_id` from the JSON response.
- [ ] Alternatively, from a machine with `gcloud` configured for the project:

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND textPayload:"/api/msgf/pulse"' \
  --limit=20 --format=json --freshness=15m
```

Adjust the filter to match your service name and log field layout (`jsonPayload`, `httpRequest`, etc.).

### E. Paste vs typing (optional)

- [ ] Paste a block **≥ 8 characters** in one edit — telemetry should mark paste-like deltas (`Paste` key in keystrokes or paste flag in `target` JSON).
- [ ] Confirm a single flush still batches with rhythm typing events in the same 3s window when edits are continuous.

### F. Failure isolation

- [ ] Set `msgf.apiUrl` to an invalid host temporarily — typing must **not** freeze the editor; only console warnings and status **error** routing.
- [ ] Restore production URL and confirm flushes succeed again.

---

## Status bar and commands

- **Status bar (left):** logic drift %, defend tier, buffer depth; click to run **MSGF: Flush buffered Pulse now**.
- **Command:** `msgf.flushPulse` — immediate buffer flush (same payload as the 3s timer).

---

## Build VSIX (sideload / distribution)

```bash
cd packages/msgf-pulse-guard
npm run compile
npm run package
```

Install the generated `.vsix` via **Extensions → … → Install from VSIX**.

---

## Architecture (this package)

```
onDidChangeTextDocument
  → parseTextDocumentEvent (URI, tsMs, length deltas)
  → TelemetryBuffer (3s interval)
  → pulseFlush → fetch POST /api/msgf/pulse
```

Source lives under `src/`; runtime artifact is `out/extension.js` only.

---

## Related monorepo docs

- [`docs/MSGF_V1_ROADMAP.md`](../../docs/MSGF_V1_ROADMAP.md) — V3.2 platform scope and Pulse APIs
- [`packages/msgf/app/api/msgf/pulse/route.ts`](../msgf/app/api/msgf/pulse/route.ts) — server-side Pulse gateway
