/**
 * Opens the extension side panel when the toolbar icon is clicked.
 * FAB in Docs sends OPEN_SIDE_PANEL + FOCUS_CHAT so the Librarian field can focus after open.
 * Offline HAL events are sealed in IndexedDB via halOfflineStore.js.
 */
importScripts("halOfflineStore.js");

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

function broadcastOfflineStatus(payload) {
  for (const port of [...panelPorts]) {
    try {
      port.postMessage({ type: "HAL_OFFLINE_STATUS", ...payload });
    } catch {
      panelPorts.delete(port);
    }
  }
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

  if (msg?.type === "HAL_OFFLINE_EVENT" && msg.entry) {
    HalOfflineStore.appendEvent(msg.entry)
      .then(async () => {
        const pending = await HalOfflineStore.pendingCount();
        broadcastOfflineStatus({ pending });
        sendResponse?.({ ok: true, pending });
      })
      .catch((err) => sendResponse?.({ ok: false, error: String(err?.message || err) }));
    return true;
  }

  if (msg?.type === "HAL_OFFLINE_SET_LEASE") {
    HalOfflineStore.setLease(msg.lease || null)
      .then(() => sendResponse?.({ ok: true }))
      .catch((err) => sendResponse?.({ ok: false, error: String(err?.message || err) }));
    return true;
  }

  if (msg?.type === "HAL_OFFLINE_GET_STATUS") {
    Promise.all([HalOfflineStore.pendingCount(), HalOfflineStore.getLease()])
      .then(([pending, lease]) => {
        sendResponse?.({
          ok: true,
          pending,
          hasLease: Boolean(lease?.lease_id && lease?.signing_material),
          expires_at: lease?.expires_at || null,
        });
      })
      .catch((err) => sendResponse?.({ ok: false, error: String(err?.message || err) }));
    return true;
  }

  if (msg?.type === "HAL_OFFLINE_FORCE_SEAL") {
    HalOfflineStore.forceSeal()
      .then(async (batch) => {
        const pending = await HalOfflineStore.pendingCount();
        sendResponse?.({ ok: true, sealed: Boolean(batch), pending });
      })
      .catch((err) => sendResponse?.({ ok: false, error: String(err?.message || err) }));
    return true;
  }

  if (msg?.type === "HAL_OFFLINE_LIST_PENDING") {
    HalOfflineStore.listPendingBatches()
      .then((batches) => sendResponse?.({ ok: true, batches }))
      .catch((err) => sendResponse?.({ ok: false, error: String(err?.message || err) }));
    return true;
  }

  if (msg?.type === "HAL_OFFLINE_MARK_SYNCED") {
    HalOfflineStore.markBatchesSynced(msg.batchIds || [])
      .then(async () => {
        const pending = await HalOfflineStore.pendingCount();
        broadcastOfflineStatus({ pending });
        sendResponse?.({ ok: true, pending });
      })
      .catch((err) => sendResponse?.({ ok: false, error: String(err?.message || err) }));
    return true;
  }

  if (msg?.type === "HAL_OFFLINE_EXPORT_LEASE") {
    HalOfflineStore.getLease()
      .then((lease) => sendResponse?.({ ok: true, lease }))
      .catch((err) => sendResponse?.({ ok: false, error: String(err?.message || err) }));
    return true;
  }

  if (msg?.type === "HAL_OFFLINE_EXPORT_LEASE_ID") {
    HalOfflineStore.getLeaseFromVault(msg.leaseId)
      .then((lease) => sendResponse?.({ ok: true, lease }))
      .catch((err) => sendResponse?.({ ok: false, error: String(err?.message || err) }));
    return true;
  }

  return undefined;
});
