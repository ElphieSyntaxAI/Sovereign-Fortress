## Author Ecosystem Google Docs Extension (MVP scaffold)

Goals:
- Stay lightweight (no heavy DOM work, no big UI frameworks)
- Capture HAL biometrics (keydown/keyup/paste) without slowing Google Docs
- Provide a small side-panel to:
  - authenticate (paste JWT from Author Ecosystem)
  - select project
  - push HAL session
  - ask Lore Librarian (RAG)

This is a scaffold; wiring OAuth + Docs API text extraction comes next.

### Load as an unpacked extension (Chrome)

1. Open `chrome://extensions` → enable **Developer mode**.
2. **Load unpacked** → choose this folder (`apps/author-ecosystem/extension`).
3. Open a Google Doc; use the **toolbar icon** or the **✎** FAB (bottom-left) to open the side panel.

Requires Chrome with **Side Panel** support. The manifest includes the `sidePanel` permission (required for `side_panel.default_path` and `chrome.sidePanel.open`).