import type { ViolationDiagnostic } from "../pulseViolationAudit";
import type { PillarHealthReport } from "../pillarHealthTypes";
import { aggregateStoplight } from "../pillarHealthTypes";
import { JEWEL_SIDEBAR_STYLES } from "../ui/jewelTheme";
import {
  renderHealingConsole,
  renderHealingConsoleBootScript,
  type HealingConsoleView,
} from "./healingConsoleHtml";

export type DashboardHealthView = {
  apiUrl: string;
  tenantId: string;
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

export function buildDashboardWebviewHtml(view: DashboardHealthView): string {
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>${JEWEL_SIDEBAR_STYLES}</style>
</head>
<body>
  <h1>MSGF Operations</h1>
  <p class="meta">Tenant: <strong>${escapeHtml(view.tenantId)}</strong><br/>API: ${escapeHtml(view.apiUrl)}</p>

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

  <h2>Actions</h2>
  <button class="scan" id="shadowScanBtn" type="button">Trigger Shadow Scan</button>
  ${scanBanner}

  ${renderHealingConsole(view.healingConsole)}

  <script>
    ${renderHealingConsoleBootScript()}
    const vscode = acquireVsCodeApi();
    initHealingConsole(vscode);

    const btn = document.getElementById('shadowScanBtn');
    if (btn) {
      btn.addEventListener('click', () => {
        btn.disabled = true;
        vscode.postMessage({ type: 'triggerShadowScan' });
      });
    }

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.type === 'shadowScanResult') {
        if (btn) btn.disabled = false;
        let el = document.getElementById('scanBanner');
        if (!el && btn) {
          el = document.createElement('div');
          el.id = 'scanBanner';
          btn.after(el);
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
