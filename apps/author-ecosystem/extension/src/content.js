// Lightweight event capture for Google Docs.
// Keeps a small rolling buffer and responds to panel requests.

let keystrokes = [];
let pasteCount = 0;
let lastKeyTime = performance.now();
const keyDownTimes = new Map();

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
});

