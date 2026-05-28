import type { HealConsoleTask, HealQueueGovernancePillar } from "../healQueueTypes";

const PILLAR_ORDER: HealQueueGovernancePillar[] = ["P1", "P2", "P3", "P4", "P5", "P6"];

export type HealingConsoleView = {
  visible: boolean;
  triggerLabel: string;
  brainSummary: string | null;
  tasks: HealConsoleTask[];
  healQueueError: string | null;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function groupTasksByPillar(tasks: HealConsoleTask[]): Map<HealQueueGovernancePillar, HealConsoleTask[]> {
  const map = new Map<HealQueueGovernancePillar, HealConsoleTask[]>();
  for (const p of PILLAR_ORDER) map.set(p, []);
  for (const task of tasks) {
    const list = map.get(task.governance_pillar) ?? [];
    list.push(task);
    map.set(task.governance_pillar, list);
  }
  return map;
}

function renderTaskRows(tasks: HealConsoleTask[]): string {
  return tasks
    .map(
      (t) => `
      <li class="task-row" data-row-key="${escapeHtml(t.row_key)}">
        <input type="checkbox" class="task-check" data-path="${escapeHtml(t.file_path)}" data-row-key="${escapeHtml(t.row_key)}" />
        <div>
          <div class="task-path">${escapeHtml(t.file_path)}</div>
          <div class="task-meta">${escapeHtml(t.reason)}<br/><code>${escapeHtml(t.bug_index.level_1_1_1_instance)}</code></div>
        </div>
      </li>`
    )
    .join("");
}

function renderPillarGroups(tasks: HealConsoleTask[]): string {
  const grouped = groupTasksByPillar(tasks);
  const parts: string[] = [];

  for (const pillar of PILLAR_ORDER) {
    const list = grouped.get(pillar) ?? [];
    if (!list.length) continue;
    parts.push(`
      <section class="pillar-group" data-pillar="${pillar}">
        <div class="pillar-group-header">
          <span>${pillar} · Governance</span>
          <span class="count">${list.length} item${list.length === 1 ? "" : "s"}</span>
        </div>
        <ul class="task-list">${renderTaskRows(list)}</ul>
      </section>`);
  }

  return parts.join("") || `<p class="muted">No file-level tasks — check brain baseline gaps above.</p>`;
}

export function renderHealingConsole(view: HealingConsoleView): string {
  if (!view.visible) return "";

  return `
  <section class="heal-console" id="healConsole" aria-label="Post-Ingest Healing Console">
    <h2 class="console-title">Post-Ingest Healing Console</h2>
    <p class="console-sub">${escapeHtml(view.triggerLabel)}${view.brainSummary ? ` · ${escapeHtml(view.brainSummary)}` : ""}</p>
    ${view.healQueueError ? `<p class="muted">${escapeHtml(view.healQueueError)}</p>` : ""}
    <div id="healStatus" class="heal-status" role="status" aria-live="polite"></div>
    ${renderPillarGroups(view.tasks)}
    <div class="heal-actions">
      <button type="button" class="heal-prompt" id="copyHealPromptBtn" title="Copy a remediation prompt for Cursor or Claude">Copy agent heal prompt</button>
      <button type="button" class="heal-primary" id="healAllBtn">Heal All… (dev cycle)</button>
      <button type="button" class="heal-secondary" id="approveSelectedBtn">Approve Selected (cloud)</button>
      <div class="schedule-row">
        <label for="schedulePreset">Schedule Auto-Remediation</label>
        <select id="schedulePreset" class="heal-schedule">
          <option value="immediate">Immediate</option>
          <option value="1h" selected>1-Hour Window</option>
          <option value="6h">6-Hour Flow</option>
          <option value="nightly">Nightly Batch</option>
        </select>
        <button type="button" class="heal-schedule-btn" id="scheduleBtn">Apply Schedule to Selected</button>
      </div>
    </div>
  </section>`;
}

/** Inline boot script — must share the page's single acquireVsCodeApi() call. */
export function renderHealingConsoleBootScript(): string {
  return `
    function initHealingConsole(vscode) {
      const statusEl = document.getElementById('healStatus');
      const copyPromptBtn = document.getElementById('copyHealPromptBtn');
      const healAllBtn = document.getElementById('healAllBtn');
      const approveBtn = document.getElementById('approveSelectedBtn');
      const scheduleBtn = document.getElementById('scheduleBtn');
      const schedulePreset = document.getElementById('schedulePreset');
      if (!statusEl && !healAllBtn) return;

      function setHealStatus(text, tone) {
        if (!statusEl) return;
        statusEl.textContent = text;
        statusEl.className = 'heal-status visible ' + (tone || 'processing');
      }

      function selectedPaths() {
        return Array.from(document.querySelectorAll('.task-check:checked'))
          .map(function(el) { return el.getAttribute('data-path'); })
          .filter(Boolean);
      }

      function updateApproveButton() {
        const n = document.querySelectorAll('.task-check:checked').length;
        if (approveBtn) {
          if (n > 0) approveBtn.classList.add('active');
          else approveBtn.classList.remove('active');
        }
      }

      document.querySelectorAll('.task-check').forEach(function(cb) {
        cb.addEventListener('change', updateApproveButton);
      });

      document.querySelectorAll('.task-row').forEach(function(row) {
        row.addEventListener('click', function(e) {
          if (e.target && e.target.classList && e.target.classList.contains('task-check')) return;
          const cb = row.querySelector('.task-check');
          if (cb) { cb.checked = !cb.checked; updateApproveButton(); }
        });
      });

      if (copyPromptBtn) {
        copyPromptBtn.addEventListener('click', function() {
          const paths = selectedPaths();
          vscode.postMessage({
            type: 'copyHealPrompt',
            file_paths: paths.length ? paths : undefined
          });
        });
      }

      if (healAllBtn) {
        healAllBtn.addEventListener('click', function() {
          healAllBtn.disabled = true;
          if (approveBtn) approveBtn.disabled = true;
          if (scheduleBtn) scheduleBtn.disabled = true;
          setHealStatus('Choose self-fix or cloud heal…', 'processing');
          vscode.postMessage({ type: 'devHealCycle' });
        });
      }

      if (approveBtn) {
        approveBtn.addEventListener('click', function() {
          const paths = selectedPaths();
          if (!paths.length) return;
          healAllBtn.disabled = true;
          approveBtn.disabled = true;
          if (scheduleBtn) scheduleBtn.disabled = true;
          setHealStatus('Processing ⚡ — healing ' + paths.length + ' selected file(s)…', 'processing');
          vscode.postMessage({ type: 'healQueueAction', action_type: 'INDIVIDUAL', file_paths: paths });
        });
      }

      if (scheduleBtn && schedulePreset) {
        scheduleBtn.addEventListener('click', function() {
          const paths = selectedPaths();
          if (!paths.length) {
            setHealStatus('Select at least one file to schedule.', 'error');
            return;
          }
          healAllBtn.disabled = true;
          approveBtn.disabled = true;
          scheduleBtn.disabled = true;
          const preset = schedulePreset.value;
          const labels = { immediate: 'Immediate', '1h': '1-Hour', '6h': '6-Hour', nightly: 'Nightly' };
          setHealStatus('Scheduled ⏳ — ' + (labels[preset] || preset) + ' window for ' + paths.length + ' file(s)', 'scheduled');
          vscode.postMessage({
            type: 'healQueueAction',
            action_type: 'SCHEDULED',
            file_paths: paths,
            preset_interval: preset
          });
        });
      }

      window.__msgfSetHealStatus = setHealStatus;
      window.__msgfHealButtons = { healAllBtn, approveBtn, scheduleBtn };
      updateApproveButton();
    }
  `;
}
