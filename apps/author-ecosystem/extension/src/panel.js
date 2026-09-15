const $ = (id) => document.getElementById(id);

/** Default API (BFF); must match the host you sign in on (127.0.0.1 vs localhost are different cookies). */
const DEFAULT_API_BASE = "http://127.0.0.1:3002";

/** Last BFF session + active manuscript (from `/api/auth/me` + `/api/manuscripts/active`). */
let sessionContext = {
  authOk: false,
  userId: null,
  activeManuscript: null,
};

const WRITING_TAB_URLS = [
  "https://docs.google.com/document/*",
  "https://word.cloud.microsoft/*",
  "https://*.officeapps.live.com/*",
  "https://*.sharepoint.com/*",
];

function isWritingSurfaceUrl(url) {
  if (typeof url !== "string") return false;
  if (url.includes("://docs.google.com/document/")) return true;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host === "word.cloud.microsoft") return true;
    if (host.endsWith(".officeapps.live.com")) return true;
    if (host.includes("sharepoint.com") && /word/i.test(u.pathname)) return true;
  } catch {
    return false;
  }
  return false;
}

/** Prefer Google Docs or Word Online tab for HAL buffer capture. */
async function resolveWritingTabId() {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (active?.id != null && isWritingSurfaceUrl(active.url)) {
    return active.id;
  }
  const bookIds = new Set(getBookDocListForActiveManuscript().map((d) => d.docId));
  if (bookIds.size > 0) {
    const tabs = await chrome.tabs.query({ url: "https://docs.google.com/document/*" });
    const match = tabs.find((t) => {
      const id = parseGoogleDocId(t.url || "");
      return id && bookIds.has(id);
    });
    if (match?.id != null) return match.id;
  }
  for (const pattern of WRITING_TAB_URLS) {
    const tabs = await chrome.tabs.query({ url: pattern });
    if (tabs.length === 0) continue;
    const sameWin =
      active?.windowId != null ? tabs.find((t) => t.windowId === active.windowId) : null;
    return (sameWin ?? tabs[0]).id ?? null;
  }
  return null;
}

function setOutput(obj) {
  $("output").textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
}

function focusLibrarianQuestionInput() {
  const el = $("librarianQuestion");
  if (!el) return;
  requestAnimationFrame(() => {
    el.focus({ preventScroll: false });
    try {
      const len = el.value.length;
      el.setSelectionRange(len, len);
    } catch {
      /* ignore */
    }
  });
}

function connectPanelToBackground() {
  try {
    const port = chrome.runtime.connect({ name: "elphie-panel" });
    port.onMessage.addListener((msg) => {
      if (msg?.type === "FOCUS_CHAT") focusLibrarianQuestionInput();
    });
  } catch {
    /* ignore */
  }
}

function wireFocusChatListeners() {
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "FOCUS_CHAT") focusLibrarianQuestionInput();
  });
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes.elphieFocusLibrarianChat) return;
    focusLibrarianQuestionInput();
  });
}

async function loadSettings() {
  const keys = ["apiBase", "jwt", "hudMaxPlotOrder", "hudMaxSpoiler", "scientificCrossCheck"];
  const s = await chrome.storage.local.get(keys);
  const storedBase = s.apiBase != null ? String(s.apiBase).trim() : "";
  $("apiBase").value = storedBase || DEFAULT_API_BASE;
  $("jwt").value = s.jwt || "";
  if (s.hudMaxPlotOrder != null && $("hudMaxPlotOrder").querySelector(`option[value="${s.hudMaxPlotOrder}"]`)) {
    $("hudMaxPlotOrder").value = String(s.hudMaxPlotOrder);
  }
  if (s.hudMaxSpoiler != null) $("hudMaxSpoiler").value = String(s.hudMaxSpoiler);
  if (s.scientificCrossCheck != null) $("scientificCrossCheck").value = String(s.scientificCrossCheck);
}

async function saveSettings() {
  await chrome.storage.local.set({
    apiBase: $("apiBase").value.trim() || DEFAULT_API_BASE,
    jwt: $("jwt").value.trim(),
    hudMaxPlotOrder: $("hudMaxPlotOrder").value,
    hudMaxSpoiler: $("hudMaxSpoiler").value,
    scientificCrossCheck: $("scientificCrossCheck").value,
  });
  setOutput("Saved.");
}

/** Extension origins cannot send BFF httpOnly cookies; read mirrored JWT from Chrome cookie jar. */
async function resolveBearerToken(apiBase) {
  const { jwt } = await chrome.storage.local.get(["jwt"]);
  const stored = typeof jwt === "string" ? jwt.trim() : "";
  if (stored) return stored;

  const base = (String(apiBase ?? "").trim() || DEFAULT_API_BASE).replace(/\/+$/, "");
  try {
    const jar = await chrome.cookies.getAll({ url: `${base}/` });
    const mirrored = jar.find((c) => c.name === "author_bff_jwt")?.value?.trim();
    if (mirrored) return mirrored;
  } catch {
    /* cookies permission missing or URL invalid */
  }
  return null;
}

async function bffRequest(path, { method = "GET", body } = {}) {
  const { apiBase } = await chrome.storage.local.get(["apiBase"]);
  const base = (String(apiBase ?? "").trim() || DEFAULT_API_BASE).replace(/\/+$/, "");
  const headers = {};
  const bearer = await resolveBearerToken(base);
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  if (body != null) headers["Content-Type"] = "application/json";

  const resp = await fetch(`${base}${path}`, {
    method,
    credentials: "include",
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  let data = {};
  const ct = resp.headers.get("content-type") || "";
  if (resp.status !== 204 && ct.includes("application/json")) {
    data = await resp.json().catch(() => ({}));
  }
  return { ok: resp.ok, status: resp.status, data };
}

async function apiFetch(path, { method = "GET", body } = {}) {
  const r = await bffRequest(path, { method, body });
  if (!r.ok) throw new Error(r.data?.message || r.data?.error || `HTTP ${r.status}`);
  return r.data;
}

function updateAuthHud(text) {
  const el = $("authStatus");
  if (el) el.textContent = text;
}

function updateManuscriptHud() {
  const el = $("manuscriptHud");
  if (!el) return;
  if (!sessionContext.authOk) {
    el.textContent = "";
    return;
  }
  if (!sessionContext.activeManuscript) {
    el.textContent = "Please select a manuscript in the Web Dashboard to begin tracking.";
    return;
  }
  const m = sessionContext.activeManuscript;
  el.textContent = `Active manuscript: ${m.title || "Untitled"} (${m.id})`;
}

/**
 * Auth check: `GET /api/auth/me` with credentials (httpOnly cookie) + optional Bearer from storage.
 * Context sync: `GET /api/manuscripts/active` (latest dashboard selection via touch).
 */
function parseGoogleDocId(url) {
  const m = String(url || "").match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  return m?.[1] ?? null;
}

const BOOK_DOCS_STORAGE_KEY = "elphieBookDocLinks";

/** @type {Map<string, { docId: string, url: string, title: string }[]>} */
let bookDocLinksByManuscript = new Map();

function parseGoogleDocUrlsFromText(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out = [];
  const seen = new Set();
  for (const line of lines) {
    const docId = parseGoogleDocId(line);
    if (!docId || seen.has(docId)) continue;
    seen.add(docId);
    out.push({
      docId,
      url: line.includes("docs.google.com") ? line : `https://docs.google.com/document/d/${docId}/edit`,
      title: "Google Doc",
    });
  }
  return out;
}

async function loadBookDocLinks(manuscriptId) {
  if (!manuscriptId) {
    bookDocLinksByManuscript = new Map();
    renderBookDocList();
    return;
  }
  const stored = await chrome.storage.local.get([BOOK_DOCS_STORAGE_KEY]);
  const all = stored[BOOK_DOCS_STORAGE_KEY] && typeof stored[BOOK_DOCS_STORAGE_KEY] === "object"
    ? stored[BOOK_DOCS_STORAGE_KEY]
    : {};
  const list = Array.isArray(all[manuscriptId]) ? all[manuscriptId] : [];
  bookDocLinksByManuscript = new Map([[manuscriptId, list]]);
  renderBookDocList();
}

async function saveBookDocLinks(manuscriptId, list) {
  if (!manuscriptId) return;
  const stored = await chrome.storage.local.get([BOOK_DOCS_STORAGE_KEY]);
  const all = stored[BOOK_DOCS_STORAGE_KEY] && typeof stored[BOOK_DOCS_STORAGE_KEY] === "object"
    ? { ...stored[BOOK_DOCS_STORAGE_KEY] }
    : {};
  all[manuscriptId] = list;
  await chrome.storage.local.set({ [BOOK_DOCS_STORAGE_KEY]: all });
  bookDocLinksByManuscript = new Map([[manuscriptId, list]]);
  renderBookDocList();
}

function getBookDocListForActiveManuscript() {
  const mid = sessionContext.activeManuscript?.id;
  if (!mid) return [];
  return bookDocLinksByManuscript.get(mid) ?? [];
}

function renderBookDocList() {
  const ul = $("bookDocList");
  if (!ul) return;
  ul.replaceChildren();
  const list = getBookDocListForActiveManuscript();
  for (const item of list) {
    const li = document.createElement("li");
    const link = document.createElement("a");
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = item.title && item.title !== "Google Doc" ? item.title : item.docId.slice(0, 12) + "…";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      void removeBookDocLink(item.docId);
    });
    li.append(link, remove);
    ul.appendChild(li);
  }
}

async function removeBookDocLink(docId) {
  const mid = sessionContext.activeManuscript?.id;
  if (!mid) return;
  const next = getBookDocListForActiveManuscript().filter((d) => d.docId !== docId);
  await saveBookDocLinks(mid, next);
}

async function addBookDocUrlsFromPaste() {
  const mid = sessionContext.activeManuscript?.id;
  if (!mid) {
    throw new Error("Select a manuscript on the Manuscripts page first, then Sync session.");
  }
  const parsed = parseGoogleDocUrlsFromText($("bookDocUrlsPaste")?.value ?? "");
  if (parsed.length === 0) {
    throw new Error("Paste at least one Google Docs URL (one per line).");
  }
  const byId = new Map(getBookDocListForActiveManuscript().map((d) => [d.docId, d]));
  for (const d of parsed) byId.set(d.docId, d);
  await saveBookDocLinks(mid, [...byId.values()]);
  if ($("bookDocUrlsPaste")) $("bookDocUrlsPaste").value = "";
  const hint = $("linkSessionHint");
  if (hint) hint.textContent = `Added ${parsed.length} URL(s). Report all or pick one as the active tab.`;
}

async function mergeManuscriptBookDocsFromServer(manuscript) {
  const mid = manuscript?.id;
  if (!mid) return;
  const companions = Array.isArray(manuscript.companion_google_docs) ? manuscript.companion_google_docs : [];
  const primaryId = manuscript.google_doc_id ? String(manuscript.google_doc_id) : null;
  const byId = new Map(getBookDocListForActiveManuscript().map((d) => [d.docId, d]));

  if (primaryId && manuscript.google_doc_url) {
    byId.set(primaryId, {
      docId: primaryId,
      url: String(manuscript.google_doc_url),
      title: manuscript.google_doc_title || manuscript.title || "Primary draft",
    });
  }
  for (const row of companions) {
    const docId = row?.google_doc_id ? String(row.google_doc_id) : parseGoogleDocId(String(row?.google_doc_url ?? ""));
    if (!docId) continue;
    byId.set(docId, {
      docId,
      url: String(row.google_doc_url ?? `https://docs.google.com/document/d/${docId}/edit`),
      title: String(row.google_doc_title ?? "Google Doc"),
    });
  }
  if (byId.size > 0) await saveBookDocLinks(mid, [...byId.values()]);
}

async function getActiveLinkSessionId() {
  const act = await bffRequest("/api/manuscripts/link-session/active", { method: "GET" });
  if (!act.ok || !act.data?.session?.id) {
    throw new Error(
      "No active link session. On Manuscripts → Start link session, then report URLs here."
    );
  }
  return act.data.session.id;
}

async function reportDocsToLinkSession(docs, primaryDocId) {
  const sessionId = await getActiveLinkSessionId();
  const report = await bffRequest(`/api/manuscripts/link-session/${encodeURIComponent(sessionId)}/report`, {
    method: "POST",
    body: {
      docs: docs.map((d) => ({
        google_doc_id: d.docId,
        google_doc_url: d.url,
        google_doc_title: d.title,
      })),
      primary_google_doc_id: primaryDocId,
    },
  });
  if (!report.ok) {
    const msg = report.data?.error || `Report failed (${report.status})`;
    if (report.status === 401 || report.status === 403) {
      throw new Error(
        `${msg} — Sign in at http://127.0.0.1:5173/sign-in, Sync session, or paste a Bearer token below.`
      );
    }
    throw new Error(msg);
  }
  const session = report.data?.session;
  const count = Array.isArray(session?.reported_docs) ? session.reported_docs.length : docs.length;
  const title = session?.google_doc_title || docs[0]?.docId;
  const hint = $("linkSessionHint");
  if (hint) {
    hint.textContent = `Reported ${count} doc(s). Primary: “${title}”. Confirm Link session on Manuscripts.`;
  }
  if (Array.isArray(session?.reported_docs)) {
    const mid = sessionContext.activeManuscript?.id;
    if (mid) {
      const list = session.reported_docs.map((r) => ({
        docId: String(r.google_doc_id),
        url: String(r.google_doc_url),
        title: String(r.google_doc_title || "Google Doc"),
      }));
      await saveBookDocLinks(mid, list);
    }
  }
  setOutput(report.data);
  return report.data;
}

/** Report the active Google Doc tab to the link session. */
async function reportLinkDoc() {
  const tabId = await resolveWritingTabId();
  if (tabId == null) {
    throw new Error("Open a Google Doc, or paste URLs below and use Report all listed URLs.");
  }
  const tab = await chrome.tabs.get(tabId);
  const url = tab.url || "";
  const docId = parseGoogleDocId(url);
  if (!docId) {
    throw new Error("The writing tab is not a Google Doc URL.");
  }
  const mid = sessionContext.activeManuscript?.id;
  if (mid) {
    const byId = new Map(getBookDocListForActiveManuscript().map((d) => [d.docId, d]));
    byId.set(docId, { docId, url, title: tab.title || "Google Doc" });
    await saveBookDocLinks(mid, [...byId.values()]);
  }
  await reportDocsToLinkSession([{ docId, url, title: tab.title || "Google Doc" }], docId);
}

/** Report every URL in the book list (and optional paste box) to the active link session. */
async function reportAllBookDocs() {
  const fromPaste = parseGoogleDocUrlsFromText($("bookDocUrlsPaste")?.value ?? "");
  const byId = new Map(getBookDocListForActiveManuscript().map((d) => [d.docId, d]));
  for (const d of fromPaste) byId.set(d.docId, d);
  const docs = [...byId.values()];
  if (docs.length === 0) {
    throw new Error("Add at least one Google Doc URL to the list, or paste URLs above.");
  }
  const mid = sessionContext.activeManuscript?.id;
  if (mid) await saveBookDocLinks(mid, docs);
  const tabId = await resolveWritingTabId();
  let primary = docs[docs.length - 1].docId;
  if (tabId != null) {
    const tab = await chrome.tabs.get(tabId);
    const activeId = parseGoogleDocId(tab.url || "");
    if (activeId && byId.has(activeId)) primary = activeId;
  }
  await reportDocsToLinkSession(docs, primary);
}

async function refreshSessionContext() {
  const me = await bffRequest("/api/auth/me", { method: "GET" });
  if (!me.ok) {
    sessionContext = { authOk: false, userId: null, activeManuscript: null };
    updateAuthHud(
      me.status === 401 || me.status === 403
        ? "Not signed in. Sign in on the Web Dashboard (same Chrome profile), or paste a Bearer token below."
        : `Auth check failed (${me.status}).`
    );
    updateManuscriptHud();
    return;
  }

  const uid = me.data?.user?.id != null ? String(me.data.user.id) : null;
  sessionContext = { authOk: true, userId: uid, activeManuscript: null };
  updateAuthHud(uid ? `Signed in (${uid.slice(0, 8)}…)` : "Signed in");

  const act = await bffRequest("/api/manuscripts/active", { method: "GET" });
  if (!act.ok) {
    sessionContext.activeManuscript = null;
    await loadBookDocLinks(null);
  } else {
    sessionContext.activeManuscript = act.data?.manuscript ?? null;
    await loadBookDocLinks(sessionContext.activeManuscript?.id ?? null);
    if (sessionContext.activeManuscript) {
      await mergeManuscriptBookDocsFromServer(sessionContext.activeManuscript);
    }
  }
  updateManuscriptHud();
}

async function readKeystrokeBufferFromWritingTab() {
  const tabId = await resolveWritingTabId();
  if (tabId == null) {
    throw new Error(
      "No writing tab found. Open Google Docs or Word Online in this browser, then try again."
    );
  }
  let resp;
  try {
    resp = await chrome.tabs.sendMessage(tabId, { type: "HAL_GET_BUFFER" });
  } catch {
    throw new Error(
      "Could not read HAL buffer. Open Google Docs or Word Online (same window), reload the editor tab once, then try again."
    );
  }
  const keystroke_data = resp?.keystrokes || [];
  const content = resp?.text_sample || "";
  const surface = resp?.surface || "writing-surface";
  return { keystroke_data, content, surface };
}

function keystrokeLatenciesFromBuffer(keystroke_data) {
  const arr = Array.isArray(keystroke_data) ? keystroke_data : [];
  const out = [];
  for (const e of arr) {
    if (!e || typeof e !== "object") continue;
    if (e.isSystemEvent === true || e.key === "PASTE_EVENT") continue;
    const ft = Number(e.flightTime);
    if (Number.isFinite(ft)) out.push(Math.max(0, Math.round(ft)));
  }
  return out.length > 0 ? out : [120];
}

const HAL_CHUNK_WORDS = 175;
const HAL_CHUNK_OVERLAP = 10;

async function readHalChunkCursor() {
  const stored = await chrome.storage.local.get([
    "lastHalChunkWordCount",
    "lastSyncedChunkIndex",
  ]);
  return {
    lastHalChunkWordCount: Number(stored.lastHalChunkWordCount) || 0,
    lastSyncedChunkIndex:
      typeof stored.lastSyncedChunkIndex === "number"
        ? stored.lastSyncedChunkIndex
        : -1,
  };
}

async function writeHalChunkCursor(wordCount, lastSyncedChunkIndex) {
  await chrome.storage.local.set({
    lastHalChunkWordCount: wordCount,
    lastSyncedChunkIndex,
  });
}

function buildHalSessionBody(
  active,
  userId,
  content,
  keystroke_data,
  surface,
  lastSyncedChunkIndex = -1
) {
  const manuscriptId = active.id;
  const tenantId = active.tenant_id;
  const tagLine = `[AuthorEcosystem manuscript=${manuscriptId} tenant=${tenantId}]\n`;
  return {
    tenantId,
    manuscriptId,
    ...(userId ? { authorUserId: userId } : {}),
    keystrokeLatencies: keystrokeLatenciesFromBuffer(keystroke_data),
    contentDelta: `${tagLine}${String(content ?? "")}`,
    locale: "en",
    keystrokeDna: {
      manuscriptId,
      tenantId,
      source: `chrome-extension-${surface || "writing-surface"}`,
      events: keystroke_data,
    },
    lastSyncedChunkIndex,
  };
}

/** Incremental MSGF rhythm packets (175 words / 10 overlap) — no RAG payload. */
async function maybeFlushChunkPulse(active, userId, content, keystroke_data, surface) {
  const words = String(content ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const { lastHalChunkWordCount, lastSyncedChunkIndex } = await readHalChunkCursor();
  if (words.length - lastHalChunkWordCount < HAL_CHUNK_WORDS) {
    return null;
  }

  const body = buildHalSessionBody(
    active,
    userId,
    content,
    keystroke_data,
    surface,
    lastSyncedChunkIndex
  );

  const result = await apiFetch("/api/hal/chunk-pulse", { method: "POST", body });
  const nextIndex =
    typeof result?.last_chunk_index === "number"
      ? result.last_chunk_index
      : lastSyncedChunkIndex;

  await writeHalChunkCursor(words.length, nextIndex);
  return result;
}

function halSessionIdFromResponse(result) {
  if (!result || typeof result !== "object") return null;
  if (result.sessionId != null) return String(result.sessionId);
  if (result.session_id != null) return String(result.session_id);
  if (result.id != null) return String(result.id);
  if (result.hal_id != null) return String(result.hal_id);
  return null;
}

async function resolveDashboardUrl() {
  const { apiBase } = await chrome.storage.local.get(["apiBase"]);
  const bff = (String(apiBase ?? "").trim() || DEFAULT_API_BASE).replace(/\/+$/, "");
  try {
    const statusRes = await fetch(`${bff}/api/status`);
    if (statusRes.ok) {
      const status = await statusRes.json();
      const tokenSavings = status?.msgf_mapping?.dashboard_links?.token_savings;
      if (typeof tokenSavings === "string" && tokenSavings.trim()) {
        return tokenSavings.trim();
      }
      const msgfDashboard = status?.msgf_mapping?.dashboard_links?.dashboard;
      if (typeof msgfDashboard === "string" && msgfDashboard.trim()) {
        return msgfDashboard.trim();
      }
    }
  } catch {
    /* fall through to Author client */
  }
  if (bff.includes("elphiesyntax.com")) return "https://elphiesyntax.com/dashboard";
  return "http://localhost:5173/dashboard";
}

async function pushHalSession() {
  await refreshSessionContext();
  if (!sessionContext.authOk) {
    setOutput("Sign in first (Web Dashboard or Bearer token), then Sync session.");
    return;
  }
  if (!sessionContext.activeManuscript) {
    setOutput("Please select a manuscript in the Web Dashboard to begin tracking.");
    return;
  }

  const { keystroke_data, content, surface } = await readKeystrokeBufferFromWritingTab();
  const { lastSyncedChunkIndex } = await readHalChunkCursor();
  await maybeFlushChunkPulse(
    sessionContext.activeManuscript,
    sessionContext.userId,
    content,
    keystroke_data,
    surface
  );
  const body = buildHalSessionBody(
    sessionContext.activeManuscript,
    sessionContext.userId,
    content,
    keystroke_data,
    surface,
    lastSyncedChunkIndex
  );
  const result = await apiFetch("/api/hal/session", { method: "POST", body });
  setOutput(result);
}

async function endSessionAndWrapUp() {
  await refreshSessionContext();
  if (!sessionContext.activeManuscript) {
    throw new Error("Please select a manuscript in the Web Dashboard to begin tracking.");
  }

  const projectId = sessionContext.activeManuscript.id;

  const { keystroke_data, content, surface } = await readKeystrokeBufferFromWritingTab();

  const result = await apiFetch("/api/hal/session", {
    method: "POST",
    body: buildHalSessionBody(
      sessionContext.activeManuscript,
      sessionContext.userId,
      content,
      keystroke_data,
      surface
    ),
  });

  const sessionId = halSessionIdFromResponse(result);
  if (!sessionId) {
    throw new Error(
      "HAL session saved but no session id was returned (expected sessionId or id). Check BFF /api/hal/session."
    );
  }

  const u = new URL(await resolveDashboardUrl());
  u.searchParams.set("project_id", projectId);
  u.searchParams.set("session_id", sessionId);

  await chrome.tabs.create({ url: u.toString() });

  setOutput({
    wrap_up_opened: u.toString(),
    hal_response: result,
  });
}

function scientificCrossCheckBodyValue() {
  const mode = $("scientificCrossCheck").value;
  if (mode === "off") return false;
  if (mode === "force") return "force";
  return "auto";
}

function classifyHudBulletLine(line) {
  const s = String(line).trim();
  if (/^-\s*\[WARNING\]/i.test(s) || /^\[WARNING\]/i.test(s)) return "warning";
  if (/^-\s*\[REAL-WORLD\]/i.test(s) || /^\[REAL-WORLD\]/i.test(s)) return "realworld";
  if (/^-\s*\[CANON\]/i.test(s) || /^\[CANON\]/i.test(s)) return "canon";
  return "plain";
}

function displayLibrarianHudResult(result) {
  const root = $("output");
  root.replaceChildren();

  if (!result || typeof result !== "object") {
    setOutput(String(result));
    return;
  }

  const wrap = document.createElement("div");
  wrap.className = "librarian-hud-result";

  const hud = result.hud && typeof result.hud === "object" ? result.hud : null;
  const stats = document.createElement("div");
  stats.className = "hud-stats";
  if (hud) {
    const parts = [];
    if (Number.isFinite(Number(hud.master_chunks))) {
      parts.push(`Master chunks: ${hud.master_chunks}`);
    }
    if (Number.isFinite(Number(hud.lore_chunks))) {
      parts.push(`Lore chunks: ${hud.lore_chunks}`);
    }
    if (hud.max_spoiler_level != null && hud.max_spoiler_level !== "") {
      parts.push(`Spoiler ceiling: ${hud.max_spoiler_level}`);
    }
    if (hud.max_plot_point_order != null && hud.max_plot_point_order !== "") {
      parts.push(`Plot order cap: ${hud.max_plot_point_order}`);
    }
    if (typeof hud.active === "boolean") {
      parts.push(`HUD filters: ${hud.active ? "on" : "off"}`);
    }
    stats.textContent = parts.length ? parts.join(" · ") : "HUD: (no metadata)";
  } else {
    stats.textContent = "HUD: (missing in response)";
  }
  wrap.appendChild(stats);

  const scc =
    result.scientific_cross_check && typeof result.scientific_cross_check === "object"
      ? result.scientific_cross_check
      : null;
  if (scc) {
    const row = document.createElement("div");
    row.className = "hud-crosscheck";
    const mode = scc.mode != null ? String(scc.mode) : "?";
    const trig = scc.triggered === true ? "yes" : "no";
    row.textContent = `Scientific cross-check: mode=${mode} · triggered=${trig}`;
    wrap.appendChild(row);
  }

  const title = document.createElement("div");
  title.className = "hud-answer-title";
  title.textContent = "HUD answer";
  wrap.appendChild(title);

  const answerBox = document.createElement("div");
  answerBox.className = "hud-answer-lines";

  const rawAnswer = result.answer != null ? String(result.answer) : "";
  const lines = rawAnswer.split(/\r?\n/).filter((l) => String(l).trim().length > 0);

  if (lines.length === 0) {
    const empty = document.createElement("div");
    empty.className = "hud-line hud-line--plain";
    empty.textContent = "(empty answer)";
    answerBox.appendChild(empty);
  } else {
    for (const line of lines) {
      const lineEl = document.createElement("div");
      const kind = classifyHudBulletLine(line);
      lineEl.className = `hud-line hud-line--${kind}`;
      lineEl.textContent = line.trimStart();
      answerBox.appendChild(lineEl);
    }
  }
  wrap.appendChild(answerBox);

  root.appendChild(wrap);
}

async function askLibrarian() {
  await refreshSessionContext();
  const projectId = sessionContext.activeManuscript?.id || null;
  const question = $("librarianQuestion").value.trim();
  if (!question) return setOutput("Enter a question.");

  const plotOrder = Number($("hudMaxPlotOrder").value);
  const hud_state = {
    max_spoiler_level: $("hudMaxSpoiler").value,
    max_plot_point_order: Number.isFinite(plotOrder) ? Math.min(9, Math.max(1, Math.floor(plotOrder))) : 5,
  };

  const result = await apiFetch("/api/rag/chat", {
    method: "POST",
    body: {
      audience: "author",
      question,
      project_id: projectId || null,
      include_wiki_drafts: true,
      hud_state,
      scientific_cross_check: scientificCrossCheckBodyValue(),
    },
  });

  const hasHudShape =
    result &&
    typeof result === "object" &&
    typeof result.answer === "string" &&
    (result.hud == null || typeof result.hud === "object");

  if (hasHudShape) {
    displayLibrarianHudResult(result);
  } else {
    setOutput(result);
  }
}

/** Chapter facts session (lightweight — BFF does heavy work). */
let chapterFactSession = { sessionId: null, cards: [], approved: new Set() };

async function readSelectionFromWritingTab() {
  const tabId = await resolveWritingTabId();
  if (tabId == null) return "";
  try {
    const resp = await chrome.tabs.sendMessage(tabId, { type: "GET_SELECTION" });
    return String(resp?.text ?? "").trim();
  } catch {
    return "";
  }
}

async function refreshLoreMergesBadge() {
  const el = $("loreMergesBadge");
  if (!el) return;
  const mid = sessionContext.activeManuscript?.id;
  if (!mid) {
    el.textContent = "";
    return;
  }
  try {
    const result = await apiFetch(
      `/api/wiki/merges/notifications?manuscript_id=${encodeURIComponent(mid)}`
    );
    const open = Number(result?.open ?? 0);
    const unread = Number(result?.unread ?? 0);
    el.textContent =
      open > 0
        ? `Lore Merges: ${open} open${unread > 0 ? ` (${unread} new)` : ""} — review on Lore Wiki`
        : "Lore Merges: none open";
  } catch {
    el.textContent = "";
  }
}

function renderChapterFactsList() {
  const host = $("chapterFactsList");
  const btn = $("commitChapterFacts");
  if (!host) return;
  if (!chapterFactSession.cards.length) {
    host.innerHTML = "";
    if (btn) btn.disabled = true;
    return;
  }
  host.innerHTML = chapterFactSession.cards
    .map((c, i) => {
      const checked = chapterFactSession.approved.has(i) ? "checked" : "";
      const cont = c.continuity_flags?.status || "";
      const ref = c.ref_label || "Ref: Live manuscript";
      return `<label style="display:block;margin:0.35rem 0;font-size:11px">
        <input type="checkbox" data-fact-idx="${i}" ${checked}/> 
        <strong>${escapeHtml(c.title || "Fact")}</strong>
        <span style="opacity:0.7"> · ${escapeHtml(cont)} · ${escapeHtml(ref)}</span>
        <div style="opacity:0.8;margin-left:1.2rem">${escapeHtml((c.excerpt || "").slice(0, 160))}</div>
      </label>`;
    })
    .join("");
  host.querySelectorAll("input[data-fact-idx]").forEach((input) => {
    input.addEventListener("change", () => {
      const idx = Number(input.getAttribute("data-fact-idx"));
      if (input.checked) chapterFactSession.approved.add(idx);
      else chapterFactSession.approved.delete(idx);
      if (btn) btn.disabled = chapterFactSession.approved.size === 0;
    });
  });
  if (btn) btn.disabled = chapterFactSession.approved.size === 0;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function useSelectionIntoPaste() {
  const text = await readSelectionFromWritingTab();
  if (!text) return setOutput("No selection in the Docs/Word tab — select text or paste into the box.");
  $("chapterPaste").value = text;
  setOutput(`Loaded selection (${text.length} chars).`);
}

async function extractChapterFacts() {
  await refreshSessionContext();
  const mid = sessionContext.activeManuscript?.id;
  if (!mid) return setOutput("Sync session first (active manuscript required).");
  let text = $("chapterPaste").value.trim();
  if (!text) {
    text = await readSelectionFromWritingTab();
    if (text) $("chapterPaste").value = text;
  }
  if (text.length < 80) return setOutput("Need at least 80 characters of chapter text.");
  const chapter_number = Number($("chapterNumber").value);
  setOutput("Extracting major chapter facts…");
  const result = await apiFetch("/api/chapter-facts/propose", {
    method: "POST",
    body: {
      manuscript_id: mid,
      chapter_text: text,
      chapter_number: Number.isFinite(chapter_number) ? chapter_number : null,
      source: "paste",
    },
  });
  chapterFactSession = {
    sessionId: result.session_id || null,
    cards: Array.isArray(result.cards) ? result.cards : [],
    approved: new Set((result.cards || []).map((_, i) => i)),
  };
  renderChapterFactsList();
  setOutput({
    extracted: result.card_count,
    used_llm: result.used_llm,
    hint: "Uncheck any cards to skip, then Save approved facts to wiki.",
  });
  await refreshLoreMergesBadge();
}

async function commitChapterFacts() {
  await refreshSessionContext();
  const mid = sessionContext.activeManuscript?.id;
  if (!mid || !chapterFactSession.sessionId) return setOutput("Extract facts first.");
  const indexes = [...chapterFactSession.approved];
  if (!indexes.length) return setOutput("Approve at least one fact.");
  setOutput("Saving to wiki…");
  const result = await apiFetch("/api/chapter-facts/commit", {
    method: "POST",
    body: {
      session_id: chapterFactSession.sessionId,
      manuscript_id: mid,
      approved_indexes: indexes,
    },
  });
  chapterFactSession = { sessionId: null, cards: [], approved: new Set() };
  renderChapterFactsList();
  setOutput(result);
  await refreshLoreMergesBadge();
}

async function tagSelection(tag_kind) {
  await refreshSessionContext();
  const mid = sessionContext.activeManuscript?.id;
  if (!mid) return setOutput("Sync session first.");
  let text = await readSelectionFromWritingTab();
  if (!text) text = $("chapterPaste").value.trim().slice(0, 520);
  if (text.length < 20) return setOutput("Select at least 20 characters in the Doc (or paste).");
  const chapter_number = Number($("chapterNumber").value);
  const result = await apiFetch("/api/chapter-facts/tag", {
    method: "POST",
    body: {
      manuscript_id: mid,
      selected_text: text,
      tag_kind,
      chapter_number: Number.isFinite(chapter_number) ? chapter_number : null,
    },
  });
  setOutput(result);
  await refreshLoreMergesBadge();
}

document.addEventListener("DOMContentLoaded", async () => {
  connectPanelToBackground();
  wireFocusChatListeners();
  await loadSettings();
  await refreshSessionContext();
  await refreshLoreMergesBadge();

  $("saveAuth").addEventListener("click", () =>
    saveSettings()
      .then(() => refreshSessionContext())
      .then(() => refreshLoreMergesBadge())
      .catch((e) => setOutput(e.message))
  );
  $("syncSession").addEventListener("click", () =>
    refreshSessionContext()
      .then(() => refreshLoreMergesBadge())
      .catch((e) => setOutput(e.message))
  );
  $("addBookDocUrls")?.addEventListener("click", () => addBookDocUrlsFromPaste().catch((e) => setOutput(e.message)));
  $("clearBookDocUrls")?.addEventListener("click", () => {
    const mid = sessionContext.activeManuscript?.id;
    if (mid) void saveBookDocLinks(mid, []);
    if ($("bookDocUrlsPaste")) $("bookDocUrlsPaste").value = "";
    setOutput("Cleared book doc list.");
  });
  $("reportLinkDoc").addEventListener("click", () => reportLinkDoc().catch((e) => setOutput(e.message)));
  $("reportAllBookDocs")?.addEventListener("click", () => reportAllBookDocs().catch((e) => setOutput(e.message)));
  $("pushSession").addEventListener("click", () => pushHalSession().catch((e) => setOutput(e.message)));
  $("endSessionWrapUp").addEventListener("click", () => endSessionAndWrapUp().catch((e) => setOutput(e.message)));
  $("askLibrarian").addEventListener("click", () => askLibrarian().catch((e) => setOutput(e.message)));
  $("useSelection")?.addEventListener("click", () => useSelectionIntoPaste().catch((e) => setOutput(e.message)));
  $("extractChapterFacts")?.addEventListener("click", () => extractChapterFacts().catch((e) => setOutput(e.message)));
  $("commitChapterFacts")?.addEventListener("click", () => commitChapterFacts().catch((e) => setOutput(e.message)));
  $("tagBreadcrumb")?.addEventListener("click", () => tagSelection("breadcrumb").catch((e) => setOutput(e.message)));
  $("tagMajorEvent")?.addEventListener("click", () => tagSelection("major_event").catch((e) => setOutput(e.message)));
  $("tagCharacter")?.addEventListener("click", () => tagSelection("character_beat").catch((e) => setOutput(e.message)));
  $("tagContinuity")?.addEventListener("click", () => tagSelection("continuity_note").catch((e) => setOutput(e.message)));
});
