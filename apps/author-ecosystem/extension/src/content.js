// Lightweight event capture for Google Docs.
// Keeps a small rolling buffer and responds to panel requests.

let keystrokes = [];
let pasteCount = 0;
let lastKeyTime = performance.now();
const keyDownTimes = new Map();

/** Debounced idle detector: FAB shows .sentinel-pulse after 3s without typing. */
let inactivityTimer = null;
const INACTIVITY_MS = 3000;

const FAB_HOST_ID = "elphie-ae-fab-host";
const FAB_ID = "elphie-ae-fab";

function getFabButton() {
  return document.getElementById(FAB_ID);
}

function bumpInactivityWatcher() {
  if (inactivityTimer != null) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
  const fab = getFabButton();
  if (fab) fab.classList.remove("sentinel-pulse");

  inactivityTimer = setTimeout(() => {
    inactivityTimer = null;
    const el = getFabButton();
    if (el) el.classList.add("sentinel-pulse");
  }, INACTIVITY_MS);
}

function push(entry) {
  keystrokes.push(entry);
  // Cap buffer to avoid memory growth / slowdown.
  if (keystrokes.length > 2000) keystrokes.splice(0, keystrokes.length - 2000);
}

document.addEventListener(
  "keydown",
  (e) => {
    const now = performance.now();
    if (!keyDownTimes.has(e.key)) keyDownTimes.set(e.key, now);

    const flightTime = Math.round(now - lastKeyTime);
    lastKeyTime = now;

    push({
      key: e.key,
      timestamp: new Date().toISOString(),
      flightTime,
      dwellTime: 0,
      isBackspace: e.key === "Backspace",
      isSystemEvent: false,
    });
    bumpInactivityWatcher();
  },
  { capture: true }
);

document.addEventListener(
  "keyup",
  (e) => {
    const up = performance.now();
    const down = keyDownTimes.get(e.key);
    if (down) {
      const dwell = Math.round(up - down);
      for (let i = keystrokes.length - 1; i >= 0; i--) {
        const k = keystrokes[i];
        if (k.key === e.key && k.dwellTime === 0) {
          k.dwellTime = dwell;
          break;
        }
      }
      keyDownTimes.delete(e.key);
    }
    bumpInactivityWatcher();
  },
  { capture: true }
);

document.addEventListener(
  "paste",
  (e) => {
    pasteCount += 1;
    const pastedText = e.clipboardData?.getData("text") || "";
    const words = pastedText
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length;

    push({
      key: "PASTE_EVENT",
      timestamp: new Date().toISOString(),
      wordsPasted: words,
      isSystemEvent: true,
    });
    bumpInactivityWatcher();
  },
  { capture: true }
);

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "HAL_GET_BUFFER") {
    // We do NOT scrape full doc text here (keeps it lightweight).
    // We'll add Docs API text extraction later in the service worker when needed.
    sendResponse({
      keystrokes,
      pasteCount,
      text_sample: "",
    });
  }
  return undefined;
});

function mountAuthorEcosystemFab() {
  if (document.getElementById(FAB_HOST_ID)) return;

  const host = document.createElement("div");
  host.id = FAB_HOST_ID;
  host.setAttribute("data-elphie-extension", "author-ecosystem");

  const btn = document.createElement("button");
  btn.id = FAB_ID;
  btn.type = "button";
  btn.title = "Open Author Ecosystem (HAL + Librarian)";
  btn.setAttribute("aria-label", "Open Author Ecosystem side panel");
  btn.textContent = "✎";

  btn.addEventListener(
    "click",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const fab = getFabButton();
      if (fab) fab.classList.remove("sentinel-pulse");
      bumpInactivityWatcher();
      chrome.runtime.sendMessage({ type: "OPEN_SIDE_PANEL" }, () => {
        void chrome.runtime.lastError;
        chrome.runtime.sendMessage({ type: "FOCUS_CHAT" }, () => {
          void chrome.runtime.lastError;
        });
      });
    },
    true
  );

  host.appendChild(btn);
  document.documentElement.appendChild(host);
  bumpInactivityWatcher();
}

mountAuthorEcosystemFab();
