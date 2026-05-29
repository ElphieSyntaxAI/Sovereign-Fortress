import type { ViolationDiagnostic } from "../pulseViolationAudit";
import type { PillarHealthReport } from "../pillarHealthTypes";
import { aggregateStoplight } from "../pillarHealthTypes";
import { JEWEL_SIDEBAR_STYLES } from "../ui/jewelTheme";
import type { RunScriptEntry } from "../utils/run-scripts-store";
import {
  renderHealingConsole,
  renderHealingConsoleBootScript,
  type HealingConsoleView,
} from "./healingConsoleHtml";

export type ConnectionStatusView = {
  tone: "connected" | "degraded" | "offline";
  label: string;
  detail: string;
};

export type DashboardHealthView = {
  apiUrl: string;
  tenantId: string;
  connection: ConnectionStatusView;
  runScripts: RunScriptEntry[];
  /** Human-readable Pulse cadence (dev session vs live). */
  pulseModeHint: string;
  report: PillarHealthReport | null;
  healthError: string | null;
  pulseError: string | null;
  scanMessage: string | null;
  scanOk: boolean | null;
  violationSummary: string | null;
  violationDiagnostics: ViolationDiagnostic[] | null;
  healingConsole: HealingConsoleView;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderConnectionStatus(connection: ConnectionStatusView): string {
  return `
  <div class="command-section">
    <h2>Connection</h2>
    <div class="connection-status ${escapeHtml(connection.tone)}" id="connectionStatus">
      <span class="connection-dot" aria-hidden="true"></span>
      <div class="connection-copy">
        <div class="connection-label">${escapeHtml(connection.label)}</div>
        <div class="connection-detail">${escapeHtml(connection.detail)}</div>
      </div>
    </div>
  </div>`;
}

function renderOptimizerForm(): string {
  return `
  <div class="command-section">
    <h2>Prompt optimizer</h2>
    <div class="optimizer-panel">
      <label for="optimizerIntent">What are you building or fixing right now?</label>
      <textarea
        id="optimizerIntent"
        class="optimizer-intent"
        rows="4"
        maxlength="4000"
        placeholder="e.g. Add team membership controller tests for deck_host"
      ></textarea>
      <button class="optimizer-primary" id="generatePromptBtn" type="button">
        Generate 0-Token Prompt
      </button>
      <div class="optimizer-status" id="optimizerStatus" role="status"></div>
    </div>
  </div>`;
}

function renderRunScriptsSection(scripts: RunScriptEntry[]): string {
  const rows =
    scripts.length > 0
      ? scripts
          .map(
            (s) => `
      <li class="run-script-row">
        <div class="run-script-meta">
          <span class="run-script-label">${escapeHtml(s.label)}</span>
          <code class="run-script-cmd">${escapeHtml(s.command)}</code>
        </div>
        <button class="run-script-one" type="button" data-script-id="${escapeHtml(s.id)}">Run</button>
      </li>`
          )
          .join("")
      : `<li class="run-script-empty muted">Generate a 0-token prompt to register auto-verify scripts.</li>`;

  return `
  <div class="command-section">
    <h2>Run scripts</h2>
    <div class="run-scripts-panel">
      <ul class="run-scripts-list" id="runScriptsList">${rows}</ul>
      <button class="run-scripts-primary" id="runLatestScriptBtn" type="button" ${
        scripts.length ? "" : "disabled"
      }>
        ▶ Run latest verify
      </button>
      <p class="run-scripts-hint muted">Scripts save to <code>.msgf/run-scripts.json</code> — zero re-prompt cost to re-test.</p>
    </div>
  </div>`;
}

function renderDiagnosticSection(): string {
  return `
  <div class="command-section diagnostic-section">
    <h2>Terminal diagnostic</h2>
    <button class="scan" id="safeBuildBtn" type="button">⚡ Run MSGF Safe Build</button>
  </div>`;
}

function renderPillarRows(report: PillarHealthReport | null, healthError: string | null): string {
  if (healthError) {
    return `<li class="pillar red"><span class="id">API</span> Connection — ${escapeHtml(healthError)}</li>`;
  }
  if (!report?.pillars?.length) {
    return `<p class="muted">Health data unavailable — check msgf.authToken and apiUrl.</p>`;
  }

  return report.pillars
    .map((p) => {
      const tone =
        p.status === "red" ? "red" : p.status === "green" ? "green" : "yellow";
      return `<li class="pillar ${tone}"><span class="id">${escapeHtml(p.pillar)}</span> ${escapeHtml(p.label)} — ${escapeHtml(p.status_label)}</li>`;
    })
    .join("");
}

function renderViolationDiagnostics(
  summary: string | null,
  items: ViolationDiagnostic[] | null
): string {
  if (!summary && (!items || !items.length)) return "";

  const rows =
    items?.map((d) => {
      const loc = [d.path, d.line].filter(Boolean).join(":");
      return `<li>
        <span class="rule">${escapeHtml(d.ruleIndex)}</span>
        ${loc ? `<span class="loc">${escapeHtml(loc)}</span>` : ""}
        ${escapeHtml(d.summary)}
      </li>`;
    }).join("") ?? "";

  return `
  <div class="diagnostics-panel" id="diagnosticsPanel">
    <h3>Wrong logic diagnostics</h3>
    ${summary ? `<p class="muted">${escapeHtml(summary)}</p>` : ""}
    <ul class="diagnostics">${rows || "<li class=\"muted\">No line-level detail returned — check trace in Cloud Run logs.</li>"}</ul>
  </div>`;
}

function statCard(label: string, value: string, tone: string): string {
  return `
    <div class="stat-wrap">
      <div class="stat ${tone}">
        <div class="label">${escapeHtml(label)}</div>
        <div class="value">${value}</div>
      </div>
    </div>`;
}

function renderAdvancedSection(view: DashboardHealthView): string {
  const agg = view.healthError ? null : view.report ? aggregateStoplight(view.report) : null;
  const overall = view.healthError ? "offline" : (agg?.tone ?? "unknown");
  const overallLabel = view.healthError
    ? view.healthError.length > 72
      ? `${view.healthError.slice(0, 69)}…`
      : view.healthError
    : overall === "green"
      ? "All pillars healthy"
      : overall === "yellow"
        ? "Degraded"
        : overall === "red"
          ? "Halt / violations"
          : "Awaiting poll";

  const scanBanner =
    view.scanMessage != null
      ? `<div id="scanBanner" class="banner ${view.scanOk ? "ok" : "err"}">${escapeHtml(view.scanMessage)}</div>`
      : "";

  const pillarCount = view.healthError ? "—" : (view.report?.pillars?.length ?? "—");

  return `
  <details class="advanced-ops">
    <summary>Advanced operations</summary>
    <div class="advanced-body">
      <p class="meta">API: ${escapeHtml(view.apiUrl)}</p>

      <h2>System health</h2>
      <div class="stat-grid">
        ${statCard("Stoplight", escapeHtml(overallLabel), view.healthError ? "red" : overall)}
        ${statCard("Pillars", String(pillarCount), view.healthError ? "red" : "unknown")}
      </div>
      <ul class="pillars">${renderPillarRows(view.report, view.healthError)}</ul>

      <h2>Pulse</h2>
      ${
        view.pulseError
          ? `<div class="banner err">${escapeHtml(view.pulseError)}</div>`
          : `<p class="muted">${escapeHtml(view.pulseModeHint)}</p>`
      }

      <h2>Violations</h2>
      ${renderViolationDiagnostics(view.violationSummary, view.violationDiagnostics)}

      <h2>Shadow scan</h2>
      <button class="scan" id="shadowScanBtn" type="button">Trigger Shadow Scan</button>
      ${scanBanner}

      ${renderHealingConsole(view.healingConsole)}
    </div>
  </details>`;
}

export function buildDashboardWebviewHtml(view: DashboardHealthView): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>${JEWEL_SIDEBAR_STYLES}</style>
</head>
<body>
  <h1>MSGF Command Center</h1>
  <p class="meta">Tenant: <strong>${escapeHtml(view.tenantId || "—")}</strong></p>

  <div class="command-center">
    ${renderConnectionStatus(view.connection)}
    ${renderOptimizerForm()}
    ${renderRunScriptsSection(view.runScripts)}
    ${renderDiagnosticSection()}
  </div>

  ${renderAdvancedSection(view)}

  <script>
    ${renderHealingConsoleBootScript()}
    const vscode = acquireVsCodeApi();
    initHealingConsole(vscode);

    const optimizerIntent = document.getElementById('optimizerIntent');
    const generatePromptBtn = document.getElementById('generatePromptBtn');
    const optimizerStatus = document.getElementById('optimizerStatus');

    function setOptimizerStatus(message, tone) {
      if (!optimizerStatus) return;
      optimizerStatus.textContent = message || '';
      optimizerStatus.className = 'optimizer-status visible ' + (tone || 'ok');
    }

    if (generatePromptBtn && optimizerIntent) {
      generatePromptBtn.addEventListener('click', () => {
        const intent = optimizerIntent.value.trim();
        if (intent.length < 3) {
          setOptimizerStatus('Enter at least 3 characters describing your task.', 'err');
          return;
        }
        generatePromptBtn.disabled = true;
        setOptimizerStatus('Generating 0-token prompt…', 'ok');
        vscode.postMessage({ type: 'generateOptimizedPrompt', userIntent: intent });
      });
    }

    const runLatestScriptBtn = document.getElementById('runLatestScriptBtn');
    const runScriptsList = document.getElementById('runScriptsList');

    function bindRunScriptButtons() {
      if (!runScriptsList) return;
      runScriptsList.querySelectorAll('.run-script-one').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-script-id');
          btn.disabled = true;
          vscode.postMessage({ type: 'runVerifyScript', scriptId: id || undefined });
        });
      });
    }
    bindRunScriptButtons();

    if (runLatestScriptBtn) {
      runLatestScriptBtn.addEventListener('click', () => {
        runLatestScriptBtn.disabled = true;
        vscode.postMessage({ type: 'runVerifyScript' });
      });
    }

    function renderRunScriptsList(scripts) {
      if (!runScriptsList) return;
      if (!scripts || !scripts.length) {
        runScriptsList.innerHTML = '<li class="run-script-empty muted">Generate a 0-token prompt to register auto-verify scripts.</li>';
        if (runLatestScriptBtn) runLatestScriptBtn.disabled = true;
        return;
      }
      runScriptsList.innerHTML = scripts.map((s) =>
        '<li class="run-script-row">' +
        '<div class="run-script-meta">' +
        '<span class="run-script-label">' + (s.label || '') + '</span>' +
        '<code class="run-script-cmd">' + (s.command || '') + '</code>' +
        '</div>' +
        '<button class="run-script-one" type="button" data-script-id="' + (s.id || '') + '">Run</button>' +
        '</li>'
      ).join('');
      if (runLatestScriptBtn) runLatestScriptBtn.disabled = false;
      bindRunScriptButtons();
    }

    const safeBuildBtn = document.getElementById('safeBuildBtn');
    if (safeBuildBtn) {
      safeBuildBtn.addEventListener('click', () => {
        safeBuildBtn.disabled = true;
        vscode.postMessage({ type: 'runTerminalDiagnostic' });
      });
    }

    const shadowBtn = document.getElementById('shadowScanBtn');
    if (shadowBtn) {
      shadowBtn.addEventListener('click', () => {
        shadowBtn.disabled = true;
        vscode.postMessage({ type: 'triggerShadowScan' });
      });
    }

    window.addEventListener('message', (event) => {
      const msg = event.data;

      if (msg.type === 'optimizerDone') {
        if (generatePromptBtn) generatePromptBtn.disabled = false;
        setOptimizerStatus(
          msg.message || (msg.ok ? 'Prompt copied to clipboard.' : 'Generation failed.'),
          msg.ok ? 'ok' : 'err'
        );
      }

      if (msg.type === 'runScriptsUpdated') {
        renderRunScriptsList(msg.scripts || []);
      }

      if (msg.type === 'runScriptDone') {
        if (runLatestScriptBtn) runLatestScriptBtn.disabled = false;
        if (runScriptsList) {
          runScriptsList.querySelectorAll('.run-script-one').forEach((btn) => {
            btn.disabled = false;
          });
        }
      }

      if (msg.type === 'terminalDiagnosticDone') {
        if (safeBuildBtn) safeBuildBtn.disabled = false;
      }

      if (msg.type === 'shadowScanResult') {
        if (shadowBtn) shadowBtn.disabled = false;
        let el = document.getElementById('scanBanner');
        if (!el && shadowBtn) {
          el = document.createElement('div');
          el.id = 'scanBanner';
          shadowBtn.after(el);
        }
        if (el) {
          el.className = 'banner ' + (msg.ok ? 'ok' : 'err');
          el.textContent = msg.message || (msg.ok ? 'Scan succeeded.' : 'Scan failed.');
        }
        if (msg.showHealingConsole) {
          vscode.postMessage({ type: 'refreshHealConsole' });
        }
      }

      if (msg.type === 'healQueueStatus') {
        const btns = window.__msgfHealButtons || {};
        if (btns.healAllBtn) btns.healAllBtn.disabled = false;
        if (btns.approveBtn) btns.approveBtn.disabled = false;
        if (btns.scheduleBtn) btns.scheduleBtn.disabled = false;
        if (typeof window.__msgfSetHealStatus === 'function') {
          window.__msgfSetHealStatus(msg.message || 'Done.', msg.tone || 'success');
        }
        if (msg.reload) {
          window.setTimeout(() => vscode.postMessage({ type: 'refreshHealConsole' }), 1200);
        }
      }
    });
  </script>
</body>
</html>`;
}
