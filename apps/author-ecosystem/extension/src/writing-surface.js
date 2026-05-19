/**
 * Shared URL / frame detection for Google Docs + Microsoft Word Online.
 * Desktop Word (Win/Mac app) cannot host Chrome extensions — Word Online only.
 */

export function isGoogleDocsUrl(url) {
  return typeof url === "string" && url.includes("://docs.google.com/document/");
}

export function isWordOnlineUrl(url) {
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

export function isWritingSurfaceUrl(url) {
  return isGoogleDocsUrl(url) || isWordOnlineUrl(url);
}

/** Content-script: should this frame capture HAL + show the FAB? */
export function shouldActivateInFrame() {
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

export function writingSurfaceLabelFromUrl(url) {
  if (isGoogleDocsUrl(url)) return "google-docs";
  if (isWordOnlineUrl(url)) return "word-online";
  return "unknown";
}

export const WRITING_TAB_QUERY_URLS = [
  "https://docs.google.com/document/*",
  "https://word.cloud.microsoft/*",
  "https://*.officeapps.live.com/*",
  "https://*.sharepoint.com/*",
];
