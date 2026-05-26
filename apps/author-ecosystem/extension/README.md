## Author Ecosystem browser extension

Lightweight Chrome extension for **Google Docs** and **Microsoft Word Online** (browser).

**Not supported:** desktop Word (Windows/Mac app) — extensions cannot inject into native Office.

### Features

- HAL keystroke / paste capture (rolling buffer, no full-doc scrape)
- ✎ FAB opens the side panel (HAL + Lore Librarian)
- BFF session via httpOnly cookies (sign in on `http://127.0.0.1:5173` — use the same host as the BFF, not `localhost`) or pasted Bearer JWT
- Push HAL → `POST /api/hal/session`
- Ask Librarian → `POST /api/rag/chat` with HUD spoiler/plot filters
- Active manuscript from `GET /api/manuscripts/active` (set in web dashboard first)

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
| `src/background.js` | Side panel + FAB messaging |
| `src/content.js` | HAL capture + FAB (module) |
| `src/writing-surface.js` | Docs / Word URL detection |
| `src/panel.html` / `panel.js` | Side panel UI |
