/**
 * Shared URL / frame detection for Google Docs + Microsoft Word Online.
 * Desktop Word (Win/Mac app) cannot host Chrome extensions — Word Online only.
 *
 * This file is loaded as a classic content-script (no ES modules), so helpers
 * are attached to `globalThis` for other scripts (e.g. `content.js`).
 */

function isGoogleDocsUrl(url) {
  return typeof url === "string" && url.includes("://docs.google.com/document/");
}

function isWordOnlineUrl(url) {
  if (typeof url !== "string" || !url.startsWith("http")) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host === "word.cloud.microsoft") return true;
    if (host.endsWith(".officeapps.live.com")) return true;
    if (host.includes("sharepoint.com") && /word/i.test(u.pathname)) return true;
    if (host === "www.office.com" && /word/i.test(u.pathname + u.search)) return true;
  } catch {
    return false;
  }
  return false;
}

function isWritingSurfaceUrl(url) {
  return isGoogleDocsUrl(url) || isWordOnlineUrl(url);
}

/** Content-script: should this frame capture HAL + show the FAB? */
function shouldActivateInFrame() {
  const href = location.href;
  if (isGoogleDocsUrl(href)) {
    return window === window.top;
  }
  if (isWordOnlineUrl(href)) {
    return (
      document.querySelector(
        '[contenteditable="true"], [role="textbox"][aria-multiline="true"], .WACViewPanel_Editable'
      ) != null
    );
  }
  return false;
}

function writingSurfaceLabelFromUrl(url) {
  if (isGoogleDocsUrl(url)) return "google-docs";
  if (isWordOnlineUrl(url)) return "word-online";
  return "unknown";
}

const WRITING_TAB_QUERY_URLS = [
  "https://docs.google.com/document/*",
  "https://word.cloud.microsoft/*",
  "https://*.officeapps.live.com/*",
  "https://*.sharepoint.com/*",
];

globalThis.isGoogleDocsUrl = isGoogleDocsUrl;
globalThis.isWordOnlineUrl = isWordOnlineUrl;
globalThis.isWritingSurfaceUrl = isWritingSurfaceUrl;
globalThis.shouldActivateInFrame = shouldActivateInFrame;
globalThis.writingSurfaceLabelFromUrl = writingSurfaceLabelFromUrl;
globalThis.WRITING_TAB_QUERY_URLS = WRITING_TAB_QUERY_URLS;
