/**
 * Opens the extension side panel when the toolbar icon is clicked.
 * FAB in Docs sends OPEN_SIDE_PANEL + FOCUS_CHAT so the Librarian field can focus after open.
 */
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

/** Side panel keeps a connect() port so we can push FOCUS_CHAT without relying on SW→SW messaging. */
const panelPorts = new Set();

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "elphie-panel") return;
  panelPorts.add(port);
  port.onDisconnect.addListener(() => panelPorts.delete(port));
});

function broadcastFocusChatToPanels() {
  for (const port of [...panelPorts]) {
    try {
      port.postMessage({ type: "FOCUS_CHAT" });
    } catch {
      panelPorts.delete(port);
    }
  }
}

function signalPanelFocusChat() {
  broadcastFocusChatToPanels();
  chrome.storage.local.set({ elphieFocusLibrarianChat: Date.now() }).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "OPEN_SIDE_PANEL" && sender.tab?.id != null) {
    chrome.sidePanel
      .open({ tabId: sender.tab.id })
      .then(() => sendResponse?.({ ok: true }))
      .catch((err) => sendResponse?.({ ok: false, error: String(err?.message || err) }));
    return true;
  }
  if (msg?.type === "FOCUS_CHAT") {
    signalPanelFocusChat();
    setTimeout(signalPanelFocusChat, 450);
    setTimeout(signalPanelFocusChat, 1100);
    sendResponse?.({ ok: true });
    return false;
  }
  return undefined;
});
