/**
 * Syntax Educates — MV3 side panel.
 *
 * Mirrors apps/author-ecosystem/extension/src/panel.js, but:
 *   - POSTs to MSGF /api/msgf/p4/state-ledger (not /api/hal/session)
 *   - Always tags ecosystem_source per writing surface (pillars §2.4.1)
 *   - Hosts the Embedded Research Portal + Citation Hall hooks (pillars §3.2, §2.6.1)
 */

const MSGF_BASE_URL = "https://msgf.elphiesyntax.com";
const STATE_LEDGER_PATH = "/api/msgf/p4/state-ledger";
const CITATION_CHECK_PATH = "/api/msgf/education/research/citation-check";

const recentSnippets = [];
let portalUrl = "";
let readingStartedAt = 0;
let currentSurface = "unknown";
let currentEcosystem = "SANDBOX_NATIVE";
let activeMs = 0;
let lastActiveAt = Date.now();
let focused = true;

// ---- writing-tab plumbing ----

async function resolveWritingTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}

async function pullBuffer() {
  const tabId = await resolveWritingTabId();
  if (tabId == null) return { keystrokes: [], focusEvents: [], pasteCount: 0, surface: "unknown" };
  try {
    const buf = await chrome.tabs.sendMessage(tabId, { type: "EDU_GET_BUFFER" });
    return buf ?? { keystrokes: [], focusEvents: [], pasteCount: 0, surface: "unknown" };
  } catch {
    return { keystrokes: [], focusEvents: [], pasteCount: 0, surface: "unknown" };
  }
}

function ecosystemFromSurface(surface) {
  switch (surface) {
    case "google-docs":
    case "google-sheets":
    case "google-slides":
      return "GOOGLE_EDIT";
    case "word-online":
    case "excel-online":
    case "powerpoint-online":
      return "MS_OFFICE_EDIT";
    default:
      return "SANDBOX_NATIVE";
  }
}

async function pushTelemetry() {
  const buf = await pullBuffer();
  currentSurface = buf.surface;
  currentEcosystem = ecosystemFromSurface(currentSurface);

  document.getElementById("ecosystemStat").textContent = currentEcosystem;

  if (
    buf.keystrokes.length === 0 &&
    (buf.focusEvents?.length ?? 0) === 0
  ) {
    setLastResult("No telemetry buffered yet.");
    return;
  }

  const body = {
    schemaVersion: 2,
    ecosystemSource: currentEcosystem,
    telemetryMode: buf.keystrokes.length > 0 ? "KEYSTROKE" : "FOCUS_DURATION",
    writingSurface: currentSurface,
    theCall: buf.keystrokes.length > 0 ? buf.keystrokes : undefined,
    focusEvents: (buf.focusEvents?.length ?? 0) > 0 ? buf.focusEvents : undefined,
  };

  await msgfPut(STATE_LEDGER_PATH, body);
  setLastResult(`Pushed ${buf.keystrokes.length} key + ${buf.focusEvents?.length ?? 0} focus events.`);
}

// ---- focus monitor (panel-side, in addition to content script) ----

document.addEventListener("visibilitychange", () => {
  recordFocus(!document.hidden, document.hidden ? "tab_hidden" : "tab_focus");
});
window.addEventListener("blur", () => recordFocus(false, "window_blur"));
window.addEventListener("focus", () => recordFocus(true, "window_focus"));

function recordFocus(nextFocused, reason) {
  const now = Date.now();
  if (focused && !nextFocused) activeMs += now - lastActiveAt;
  focused = nextFocused;
  lastActiveAt = now;
  const focusStat = document.getElementById("focusStat");
  focusStat.textContent = nextFocused ? "focused" : "paused";
  focusStat.className = "stat " + (nextFocused ? "ok" : "warn");
  void reason;
}

setInterval(() => {
  const now = Date.now();
  if (focused) activeMs += now - lastActiveAt;
  lastActiveAt = now;
  const seconds = Math.floor(activeMs / 1000);
  document.getElementById("activeTime").textContent =
    seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}, 1000);

// ---- research portal + citation check ----

document.getElementById("openSearch").addEventListener("click", () => {
  portalUrl = document.getElementById("searchUrl").value.trim();
  if (!portalUrl) return;
  document.getElementById("researchFrame").src = portalUrl;
  readingStartedAt = Date.now();
});

document.getElementById("anchorBtn").addEventListener("click", () => {
  const snippet = document.getElementById("snippetText").value.trim();
  if (!snippet) return;
  recentSnippets.push({
    snippetId: cryptoRandomId(),
    sourceUrl: portalUrl || "about:blank",
    text: snippet,
    readingTimeMs: readingStartedAt ? Date.now() - readingStartedAt : 0,
    capturedAt: Date.now(),
    hasCitationAnchor: true,
  });
  setLastResult("Anchor minted — paste into the host document.");
});

document.getElementById("checkBtn").addEventListener("click", async () => {
  const pasted = document.getElementById("snippetText").value.trim();
  if (!pasted) return;
  try {
    const res = await msgfPut(CITATION_CHECK_PATH, {
      pastedText: pasted,
      recentSnippets,
      ecosystemSource: currentEcosystem,
      writingSurface: currentSurface,
    });
    setLastResult(`Citation: ${res?.classification ?? "unknown"}`);
  } catch (e) {
    setLastResult(`Check failed: ${e?.message ?? String(e)}`);
  }
});

document.getElementById("pushTelemetry").addEventListener("click", () => {
  void pushTelemetry();
});

// ---- listen for paste-relay from the content script ----

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "EDU_PASTE_RELAY") {
    document.getElementById("snippetText").value = String(msg.payload?.pastedText ?? "");
  }
});

// ---- helpers ----

async function msgfPut(path, body) {
  const url = MSGF_BASE_URL.replace(/\/+$/, "") + path;
  const entityId = (await chrome.storage.local.get("entityId")).entityId ?? "";
  const tenantId =
    (await chrome.storage.local.get("tenantId")).tenantId ?? "syntax_education";

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-msgf-entity-id": entityId,
      "x-msgf-tenant-id": tenantId,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return res.json();
}

function setLastResult(text) {
  document.getElementById("lastResult").textContent = text;
}

function cryptoRandomId() {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return `s_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

// Periodic auto-push of focus + key buffer every 30s
setInterval(() => void pushTelemetry(), 30000);
