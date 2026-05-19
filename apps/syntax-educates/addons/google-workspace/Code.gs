/**
 * Syntax Education — Google Workspace add-on (Docs · Sheets · Slides).
 *
 * Wire-up:
 *   - Apps Script `onEdit(e)` / `onChange(e)` simple triggers (Sheets) → CELL_MUTATION beats.
 *   - HTMLService Sidebar (`Sidebar.html`) → KEYSTROKE beats (Docs) + focus monitor + research portal.
 *   - All payloads PUT to MSGF `/api/msgf/p4/state-ledger` with `ecosystem_source = GOOGLE_EDIT`.
 *
 * Pillars §2.4.1 (external telemetry routing) + §3.1 (cross-platform add-on matrix).
 *
 * NOTE: Apps Script does not run TypeScript. The shared `the-call-client.ts` types are mirrored
 * here as plain JS object shapes; keep them in sync when the schema changes.
 */

// =========================================================================================
// CONFIG — replace at deploy time via Script Properties.
// =========================================================================================

var MSGF_BASE_URL_PROPERTY = "MSGF_BASE_URL";
var MSGF_TENANT_PROPERTY = "MSGF_TENANT_ID";
var MSGF_ENTITY_PROPERTY = "MSGF_ENTITY_ID";
var MSGF_SERVICE_TOKEN_PROPERTY = "MSGF_SERVICE_ROLE_TOKEN";

function getMsgfConfig_() {
  var props = PropertiesService.getUserProperties();
  return {
    baseUrl: props.getProperty(MSGF_BASE_URL_PROPERTY) || "https://msgf.elphiesyntax.com",
    tenantId: props.getProperty(MSGF_TENANT_PROPERTY) || "syntax_education",
    entityId: props.getProperty(MSGF_ENTITY_PROPERTY) || "",
    serviceRoleToken: props.getProperty(MSGF_SERVICE_TOKEN_PROPERTY) || "",
  };
}

// =========================================================================================
// HOMEPAGE / SIDEBAR
// =========================================================================================

function onHomepage(_e) {
  return CardService.newCardBuilder()
    .setHeader(
      CardService.newCardHeader()
        .setTitle("Syntax Educates")
        .setSubtitle("Active session focus + research portal")
    )
    .addSection(
      CardService.newCardSection().addWidget(
        CardService.newTextParagraph().setText(
          "Open the sidebar to start the Embedded Research Portal and the active-time tracker."
        )
      )
    )
    .build();
}

function onDocsHomepage(e) { return onHomepage(e); }
function onSheetsHomepage(e) { return onHomepage(e); }
function onSlidesHomepage(e) { return onHomepage(e); }
function onFileScopeGranted(_e) { return onHomepage(_e); }

function showSidebar() {
  var html = HtmlService.createHtmlOutputFromFile("Sidebar")
    .setTitle("Syntax Educates")
    .setWidth(360);
  if (typeof DocumentApp !== "undefined") {
    try { DocumentApp.getUi().showSidebar(html); return; } catch (e) {}
  }
  if (typeof SpreadsheetApp !== "undefined") {
    try { SpreadsheetApp.getUi().showSidebar(html); return; } catch (e) {}
  }
  if (typeof SlidesApp !== "undefined") {
    try { SlidesApp.getUi().showSidebar(html); return; } catch (e) {}
  }
}

// =========================================================================================
// onEdit / onChange — Sheets CELL_MUTATION surrogate
// =========================================================================================

/**
 * Sheets simple trigger. Adds a cell-mutation event to the per-document buffer
 * and flushes to MSGF when the buffer threshold or interval is reached.
 */
function onEdit(e) {
  if (!e || !e.range) return;
  var range = e.range;
  var oldVal = e.oldValue == null ? "" : String(e.oldValue);
  var newVal = e.value == null ? "" : String(e.value);
  var deltaChars = newVal.length - oldVal.length;

  // Detect paste by heuristic: large positive delta in a single edit.
  var isPaste = deltaChars > 80;

  var cellRef =
    range.getSheet().getName() + "!" + range.getA1Notation();

  enqueueCellMutation_({
    ts: Date.now(),
    cellRef: cellRef,
    deltaChars: deltaChars,
    isPaste: isPaste,
  });
}

/**
 * Sheets / Docs installable trigger for structural changes (row inserts, formatting, etc.).
 * Useful for noting "non-typing" effort that still represents student work.
 */
function onChange(e) {
  if (!e) return;
  enqueueCellMutation_({
    ts: Date.now(),
    cellRef: "STRUCTURE:" + (e.changeType || "UNKNOWN"),
    deltaChars: 0,
    isPaste: false,
  });
}

// =========================================================================================
// Cell-mutation buffer (per script container)
// =========================================================================================

var CELL_BUFFER_PROPERTY = "EDU_CELL_MUTATION_BUFFER";
var CELL_BUFFER_FLUSH_AT = 25;
var CELL_BUFFER_FLUSH_INTERVAL_MS = 2000;

function enqueueCellMutation_(event) {
  var cache = CacheService.getDocumentCache();
  if (!cache) return; // service may be unavailable in some triggers
  var raw = cache.get(CELL_BUFFER_PROPERTY);
  var buffer = raw ? JSON.parse(raw) : [];
  buffer.push(event);
  cache.put(CELL_BUFFER_PROPERTY, JSON.stringify(buffer), 300);

  var lastFlushRaw = cache.get(CELL_BUFFER_PROPERTY + ":last_flush");
  var lastFlush = lastFlushRaw ? Number(lastFlushRaw) : 0;
  var due =
    buffer.length >= CELL_BUFFER_FLUSH_AT ||
    Date.now() - lastFlush >= CELL_BUFFER_FLUSH_INTERVAL_MS;
  if (due) flushCellMutationBuffer_();
}

function flushCellMutationBuffer_() {
  var cache = CacheService.getDocumentCache();
  if (!cache) return;
  var raw = cache.get(CELL_BUFFER_PROPERTY);
  if (!raw) return;
  var buffer = JSON.parse(raw);
  if (buffer.length === 0) return;

  cache.remove(CELL_BUFFER_PROPERTY);
  cache.put(CELL_BUFFER_PROPERTY + ":last_flush", String(Date.now()), 300);

  var surface = detectGoogleSurface_();
  postTheCall_({
    schemaVersion: 2,
    ecosystemSource: "GOOGLE_EDIT",
    telemetryMode: "CELL_MUTATION",
    writingSurface: surface,
    cellMutations: buffer,
  });
}

// =========================================================================================
// HTMLService-callable functions (Docs sidebar pushes keystroke + focus + citation checks)
// =========================================================================================

/**
 * Called from `Sidebar.html` with a batch of keystroke events captured against the sidebar's
 * own editable textarea (Apps Script does not expose live key events from the host doc).
 */
function pushKeystrokeBatch(payload) {
  if (!payload || !payload.theCall) return { ok: false, error: "missing_theCall" };
  return postTheCall_({
    schemaVersion: 2,
    ecosystemSource: "GOOGLE_EDIT",
    telemetryMode: "KEYSTROKE",
    writingSurface: detectGoogleSurface_(),
    theCall: payload.theCall,
    assignmentId: payload.assignmentId,
    sessionId: payload.sessionId,
    subjectDomain: payload.subjectDomain,
  });
}

/**
 * Called from `Sidebar.html` when visibility changes / window blur stalls or resumes.
 */
function pushFocusEvents(payload) {
  if (!payload || !payload.focusEvents) return { ok: false, error: "missing_focusEvents" };
  return postTheCall_({
    schemaVersion: 2,
    ecosystemSource: "GOOGLE_EDIT",
    telemetryMode: "FOCUS_DURATION",
    writingSurface: detectGoogleSurface_(),
    focusEvents: payload.focusEvents,
    assignmentId: payload.assignmentId,
    sessionId: payload.sessionId,
    subjectDomain: payload.subjectDomain,
  });
}

/**
 * Citation Hall Engine — called from the sidebar when the student pastes into the host doc.
 */
function checkCitation(payload) {
  if (!payload || !payload.pastedText) {
    return { ok: false, error: "missing_pastedText" };
  }
  var cfg = getMsgfConfig_();
  var url = cfg.baseUrl.replace(/\/+$/, "") + "/api/msgf/education/research/citation-check";
  return msgfFetch_(url, "PUT", {
    pastedText: payload.pastedText,
    recentSnippets: payload.recentSnippets || [],
    writingSurface: detectGoogleSurface_(),
    ecosystemSource: "GOOGLE_EDIT",
    assignmentId: payload.assignmentId,
    sessionId: payload.sessionId,
  });
}

/**
 * Universal-action handler — mints a citation anchor for the active selection in the host doc.
 */
function generateCitationAnchor() {
  var anchorId = Utilities.getUuid();
  return CardService.newCardBuilder()
    .addSection(
      CardService.newCardSection().addWidget(
        CardService.newTextParagraph().setText(
          "Citation anchor minted: <b>" +
            anchorId +
            "</b><br>Paste this anchor next to the cited material."
        )
      )
    )
    .build();
}

// =========================================================================================
// HTTP helpers
// =========================================================================================

function detectGoogleSurface_() {
  try {
    if (typeof DocumentApp !== "undefined" && DocumentApp.getActiveDocument()) return "google-docs";
  } catch (e) {}
  try {
    if (typeof SpreadsheetApp !== "undefined" && SpreadsheetApp.getActiveSpreadsheet())
      return "google-sheets";
  } catch (e) {}
  try {
    if (typeof SlidesApp !== "undefined" && SlidesApp.getActivePresentation())
      return "google-slides";
  } catch (e) {}
  return "unknown";
}

function postTheCall_(body) {
  var cfg = getMsgfConfig_();
  var url = cfg.baseUrl.replace(/\/+$/, "") + "/api/msgf/p4/state-ledger";
  return msgfFetch_(url, "PUT", body);
}

function msgfFetch_(url, method, body) {
  var cfg = getMsgfConfig_();
  var headers = {
    "content-type": "application/json",
    "x-msgf-entity-id": cfg.entityId,
    "x-msgf-tenant-id": cfg.tenantId,
  };
  if (cfg.serviceRoleToken) {
    headers.authorization = "Bearer " + cfg.serviceRoleToken;
  }
  var options = {
    method: method.toLowerCase(),
    contentType: "application/json",
    headers: headers,
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  };
  var res = UrlFetchApp.fetch(url, options);
  var status = res.getResponseCode();
  var text = res.getContentText();
  if (status >= 200 && status < 300) {
    try {
      return JSON.parse(text);
    } catch (e) {
      return { ok: true, raw: text };
    }
  }
  return { ok: false, status: status, error: text.slice(0, 512) };
}
