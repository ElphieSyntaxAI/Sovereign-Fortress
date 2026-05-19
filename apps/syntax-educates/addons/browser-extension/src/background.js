/**
 * Syntax Educates — MV3 service worker.
 * Mirrors the Author Ecosystem extension: opens the side panel on toolbar click and
 * relays content-script paste events to the side panel for Citation Hall checks.
 */

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => {});
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "OPEN_SIDE_PANEL" && sender.tab?.id != null) {
    chrome.sidePanel
      .open({ tabId: sender.tab.id })
      .catch(() => {});
    sendResponse?.({ ok: true });
    return;
  }
  if (msg?.type === "EDU_PASTE") {
    chrome.runtime.sendMessage({ type: "EDU_PASTE_RELAY", payload: msg });
    sendResponse?.({ ok: true });
  }
});
