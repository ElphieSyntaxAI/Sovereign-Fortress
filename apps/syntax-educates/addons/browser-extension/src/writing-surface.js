/**
 * Syntax Educates — host detection.
 * Ports the URL / iframe rules used by the Author Ecosystem extension so we attach The Call
 * only in the correct writing surface for Google / Microsoft hosts.
 */

export function isGoogleDocsUrl(href) {
  return /^https:\/\/docs\.google\.com\/document\//.test(href);
}
export function isGoogleSheetsUrl(href) {
  return /^https:\/\/docs\.google\.com\/spreadsheets\//.test(href);
}
export function isGoogleSlidesUrl(href) {
  return /^https:\/\/docs\.google\.com\/presentation\//.test(href);
}
export function isWordOnlineUrl(href) {
  return /office(apps)?\.live\.com|word\.office\.com|office\.com\/.*\/word/i.test(href);
}
export function isExcelOnlineUrl(href) {
  return /excel\.office\.com|office\.com\/.*\/excel/i.test(href);
}
export function isPowerPointOnlineUrl(href) {
  return /powerpoint\.office\.com|office\.com\/.*\/powerpoint/i.test(href);
}

export function writingSurfaceLabelFromUrl(href) {
  if (isGoogleDocsUrl(href)) return "google-docs";
  if (isGoogleSheetsUrl(href)) return "google-sheets";
  if (isGoogleSlidesUrl(href)) return "google-slides";
  if (isWordOnlineUrl(href)) return "word-online";
  if (isExcelOnlineUrl(href)) return "excel-online";
  if (isPowerPointOnlineUrl(href)) return "powerpoint-online";
  return "unknown";
}

export function ecosystemSourceFromSurface(surface) {
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

/** Decide whether this frame should attach The Call + side panel FAB. */
export function shouldActivateInFrame() {
  const href = location.href;
  if (isGoogleDocsUrl(href) || isGoogleSheetsUrl(href) || isGoogleSlidesUrl(href)) {
    return window === window.top;
  }
  if (isWordOnlineUrl(href) || isExcelOnlineUrl(href) || isPowerPointOnlineUrl(href)) {
    return (
      document.querySelector(
        '[contenteditable="true"], [role="textbox"][aria-multiline="true"], .WACViewPanel_Editable'
      ) != null
    );
  }
  return false;
}
