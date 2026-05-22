const $ = (id) => document.getElementById(id);

/** Default API (BFF); used whenever storage is empty or cleared. */
const DEFAULT_API_BASE = "http://localhost:3002";

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

async function bffRequest(path, { method = "GET", body } = {}) {
  const { apiBase, jwt } = await chrome.storage.local.get(["apiBase", "jwt"]);
  const base = (String(apiBase ?? "").trim() || DEFAULT_API_BASE).replace(/\/+$/, "");
  const headers = {};
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
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
  } else {
    sessionContext.activeManuscript = act.data?.manuscript ?? null;
  }
  updateManuscriptHud();
}

async function loadProjects() {
  const data = await apiFetch("/api/projects");
  const sel = $("projectSelect");
  sel.innerHTML = "";
  for (const p of data.projects || []) {
    const opt = document.createElement("option");
    opt.value = p.project_id;
    opt.textContent = p.title;
    sel.appendChild(opt);
  }
  setOutput({ loaded: (data.projects || []).length });
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
  const base = (String(apiBase ?? "").trim() || DEFAULT_API_BASE).replace(/\/+$/, "");
  if (base.includes("elphiesyntax.com")) return "https://elphiesyntax.com/dashboard";
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
  const projectId =
    sessionContext.activeManuscript?.id || $("projectSelect").value || null;
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

document.addEventListener("DOMContentLoaded", async () => {
  connectPanelToBackground();
  wireFocusChatListeners();
  await loadSettings();
  await refreshSessionContext();

  $("saveAuth").addEventListener("click", () =>
    saveSettings()
      .then(() => refreshSessionContext())
      .catch((e) => setOutput(e.message))
  );
  $("syncSession").addEventListener("click", () => refreshSessionContext().catch((e) => setOutput(e.message)));
  $("loadProjects").addEventListener("click", () => loadProjects().catch((e) => setOutput(e.message)));
  $("pushSession").addEventListener("click", () => pushHalSession().catch((e) => setOutput(e.message)));
  $("endSessionWrapUp").addEventListener("click", () => endSessionAndWrapUp().catch((e) => setOutput(e.message)));
  $("askLibrarian").addEventListener("click", () => askLibrarian().catch((e) => setOutput(e.message)));
});
