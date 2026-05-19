/**
 * Syntax Educates — content script.
 * Ported from `apps/author-ecosystem/extension/src/content.js` with these education changes:
 *   - Captures focus_pause / focus_resume beats for the active session focus monitor.
 *   - Tags every event with the host `writingSurface` so MSGF can infer `ecosystem_source`.
 */

let keystrokes = [];
let focusEvents = [];
let pasteCount = 0;
let lastKeyTime = performance.now();
const keyDownTimes = new Map();
let surfaceLabel = "unknown";

function push(event) {
  keystrokes.push(event);
  if (keystrokes.length > 2000) keystrokes.shift();
}

function pushFocus(type, reason) {
  focusEvents.push({
    ts: Date.now(),
    type,
    surface: surfaceLabel,
    reason: reason || (type === "focus_pause" ? "tab_hidden" : "tab_focus"),
  });
  if (focusEvents.length > 200) focusEvents.shift();
}

function registerHalListeners() {
  document.addEventListener(
    "keydown",
    (e) => {
      const now = performance.now();
      keyDownTimes.set(e.code || e.key, now);
      const flightTime = now - lastKeyTime;
      lastKeyTime = now;
      push({
        key: e.key,
        timestamp: Date.now(),
        flightTime: Math.round(flightTime),
        isBackspace: e.key === "Backspace",
        surface: surfaceLabel,
      });
    },
    { capture: true }
  );

  document.addEventListener(
    "keyup",
    (e) => {
      const downAt = keyDownTimes.get(e.code || e.key);
      if (downAt == null) return;
      const dwellTime = performance.now() - downAt;
      keyDownTimes.delete(e.code || e.key);
      push({
        key: e.key,
        timestamp: Date.now(),
        dwellTime: Math.round(dwellTime),
        surface: surfaceLabel,
      });
    },
    { capture: true }
  );

  document.addEventListener(
    "paste",
    (e) => {
      pasteCount += 1;
      const pasted = e.clipboardData ? e.clipboardData.getData("text") : "";
      const wordsPasted = pasted ? pasted.split(/\s+/).filter(Boolean).length : 0;
      push({
        key: "PASTE_EVENT",
        timestamp: Date.now(),
        isSystemEvent: true,
        wordsPasted,
        surface: surfaceLabel,
      });
      try {
        chrome.runtime.sendMessage({
          type: "EDU_PASTE",
          pastedText: pasted,
          surface: surfaceLabel,
          at: Date.now(),
        });
      } catch {}
    },
    { capture: true }
  );

  document.addEventListener("visibilitychange", () => {
    pushFocus(document.hidden ? "focus_pause" : "focus_resume", document.hidden ? "tab_hidden" : "tab_focus");
  });
  window.addEventListener("blur", () => pushFocus("focus_pause", "window_blur"));
  window.addEventListener("focus", () => pushFocus("focus_resume", "window_focus"));
}

async function bootstrap() {
  const { shouldActivateInFrame, writingSurfaceLabelFromUrl } = await import(
    chrome.runtime.getURL("src/writing-surface.js")
  );
  if (!shouldActivateInFrame()) return;
  surfaceLabel = writingSurfaceLabelFromUrl(location.href);
  registerHalListeners();
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "EDU_GET_BUFFER") {
    sendResponse({
      keystrokes,
      focusEvents,
      pasteCount,
      surface: surfaceLabel,
    });
    keystrokes = [];
    focusEvents = [];
    pasteCount = 0;
    return;
  }
  return undefined;
});

void bootstrap();
