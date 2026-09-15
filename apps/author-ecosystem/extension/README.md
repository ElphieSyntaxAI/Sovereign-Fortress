## Author Ecosystem browser extension

Lightweight Chrome extension for **Google Docs** and **Microsoft Word Online** (browser).

**Not supported:** desktop Word (Windows/Mac app) — extensions cannot inject into native Office.

### Features

- HAL keystroke / paste capture (rolling buffer, no full-doc scrape)
- **Focus / offline sealed HAL:** while online, Sync session issues a lease; keystrokes+pastes hash-chain into IndexedDB; on reconnect, `POST /api/hal/offline-resync` verifies HMAC/chain/tamper and writes a **full-value** `offline_sealed` ledger row (same formulas + rolling-5 weight as live — not a penalty tier)
- Shared **tamper suite** on live push and offline resync (hard reject for forgeries; soft flags for transparency)
- Biometrics + linguistic analysis vs **rolling 5-session average** (`POST /api/hal/session`) — unchanged by lore features
- ✎ FAB opens the side panel (HAL + Lore Librarian + chapter facts)
- **Chapter facts:** paste/selection → extract major events → save to draft wiki (`/api/chapter-facts/*`)
- **Author tags:** selection → breadcrumb / major event / character / continuity note
- **Lore Merges badge:** open conflict count; resolve on Lore Wiki
- Librarian asks with `include_wiki_drafts: true` so fresh draft lore is visible
- BFF session via httpOnly cookies or pasted Bearer JWT
- Active manuscript from `GET /api/manuscripts/active`

### Offline / focus mode (trust model)

| Mode | Meaning |
|------|---------|
| `live` | Online Push HAL / chunk-pulse |
| `offline_sealed` | Lease-bound sealed batches verified on resync — **equal HAL value** |

- UI: “Focus mode — sealing locally” / “Pending sync (N)” → “Sealed offline — verified”
- Rejected: broken HMAC, chain gaps, expired lease, robot-flat rhythm, paste-as-typing, replay
- Soft flags only: high paste ratio, thin text, linguistic anomalies (still scored)
- Caps: ~48h lease, ~50k events, ~200 batches per lease

### Load unpacked (Chrome)

1. Run Author BFF (`:3002`) and client (`:5173`).
2. Sign in at `http://localhost:5173` (Author tab on platform login).
3. Open **Dashboard** and select a manuscript.
4. `chrome://extensions` → **Developer mode** → **Load unpacked** → this folder (`apps/author-ecosystem/extension`).
5. Optional: copy extension ID into root `.env.local` as `BFF_CHROME_EXTENSION_ID=<id>` (dev allows any `chrome-extension://` origin when `NODE_ENV` is not production).
6. Open **Google Docs** or **Word Online** (`https://word.cloud.microsoft` or Office 365 web).
7. Click **✎** or the toolbar icon → **Sync session** → type in the doc → **Push HAL session** or **Ask Librarian**.

### Link session (multiple Google Docs per book)

1. On Manuscripts, **Start link session** for your book.
2. In the extension side panel → **Book Google Docs** — paste every Doc URL (draft, outline, bible), one per line → **Add URLs to list**.
3. **Report all listed URLs to link session** (or **Report active tab** for the doc you have open).
4. On Manuscripts → **Link session** to confirm. Companion docs are saved on the manuscript for HAL/Librarian scope.

### Word Online notes

- Editor runs inside iframes; the extension uses `all_frames` and activates only in the editable frame.
- If the FAB is missing, reload the Word tab after installing the extension.
- First keystrokes after reload may need a click inside the document body.

### File layout

| File | Role |
|------|------|
| `manifest.json` | MV3 manifest (required — was missing before) |
| `src/background.js` | Side panel + FAB messaging + offline sealed store bridge |
| `src/halOfflineStore.js` | IndexedDB hash-chain + HMAC for focus/offline HAL |
| `src/content.js` | HAL capture + FAB (mirrors events to offline store) |
| `src/writing-surface.js` | Docs / Word URL detection |
| `src/panel.html` / `panel.js` | Side panel UI (lease + sealed resync) |
