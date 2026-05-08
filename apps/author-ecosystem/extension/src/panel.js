const $ = (id) => document.getElementById(id);

function setOutput(obj) {
  $("output").textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
}

async function loadSettings() {
  const { apiBase, jwt } = await chrome.storage.local.get(["apiBase", "jwt"]);
  $("apiBase").value = apiBase || "http://localhost:3002";
  $("jwt").value = jwt || "";
}

async function saveSettings() {
  await chrome.storage.local.set({
    apiBase: $("apiBase").value.trim() || "http://localhost:3002",
    jwt: $("jwt").value.trim(),
  });
  setOutput("Saved.");
}

async function apiFetch(path, { method = "GET", body } = {}) {
  const { apiBase, jwt } = await chrome.storage.local.get(["apiBase", "jwt"]);
  const base = (apiBase || "http://localhost:3002").replace(/\/+$/, "");
  const headers = { "Content-Type": "application/json" };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;

  const resp = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data?.message || data?.error || `HTTP ${resp.status}`);
  return data;
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

async function pushHalSession() {
  const projectId = $("projectSelect").value || null;

  // Ask content script for latest buffered session events.
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const resp = await chrome.tabs.sendMessage(tab.id, { type: "HAL_GET_BUFFER" });

  const keystroke_data = resp?.keystrokes || [];
  const content = resp?.text_sample || ""; // lightweight placeholder for now

  const result = await apiFetch("/api/hal/session", {
    method: "POST",
    body: { content, keystroke_data, is_reference: false, project_id: projectId },
  });
  setOutput(result);
}

async function askLibrarian() {
  const projectId = $("projectSelect").value || null;
  const question = $("question").value.trim();
  if (!question) return setOutput("Enter a question.");

  const result = await apiFetch("/api/rag/chat", {
    method: "POST",
    body: { audience: "author", question, project_id: projectId },
  });
  setOutput(result.answer || result);
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadSettings();
  $("saveAuth").addEventListener("click", () => saveSettings().catch((e) => setOutput(e.message)));
  $("loadProjects").addEventListener("click", () => loadProjects().catch((e) => setOutput(e.message)));
  $("pushSession").addEventListener("click", () => pushHalSession().catch((e) => setOutput(e.message)));
  $("askLibrarian").addEventListener("click", () => askLibrarian().catch((e) => setOutput(e.message)));
});

