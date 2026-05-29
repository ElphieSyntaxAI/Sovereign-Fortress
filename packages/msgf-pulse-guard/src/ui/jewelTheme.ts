/**
 * MSGF Jewel Tone design system — shared CSS tokens for extension webviews.
 * AAA-oriented contrast on obsidian / emerald-midnight surfaces.
 */

export const JEWEL = {
  bgMidnight: "#04140e",
  bgMidnightAlt: "#0a0518",
  surfaceObsidian: "#160f29",
  surfaceForest: "#0b1a14",
  emeraldDeep: "#022c22",
  emeraldActive: "#059669",
  emeraldGlow: "#10b981",
  purpleVelvet: "#6b21a8",
  purpleRoyal: "#a855f7",
  textIvory: "#f8fafc",
  textJadeMuted: "#a7f3d0",
  stoplightGreen: "#10b981",
  stoplightAmber: "#f59e0b",
  stoplightRuby: "#ef4444",
} as const;

/** Base :root tokens + typography (sidebar / panel shells). */
export const JEWEL_CSS_ROOT = `
  :root {
    --jewel-bg-midnight: ${JEWEL.bgMidnight};
    --jewel-bg-midnight-alt: ${JEWEL.bgMidnightAlt};
    --jewel-surface-obsidian: ${JEWEL.surfaceObsidian};
    --jewel-surface-forest: ${JEWEL.surfaceForest};
    --jewel-emerald-deep: ${JEWEL.emeraldDeep};
    --jewel-emerald-active: ${JEWEL.emeraldActive};
    --jewel-emerald-glow: ${JEWEL.emeraldGlow};
    --jewel-purple-velvet: ${JEWEL.purpleVelvet};
    --jewel-purple-royal: ${JEWEL.purpleRoyal};
    --jewel-text-ivory: ${JEWEL.textIvory};
    --jewel-text-jade: ${JEWEL.textJadeMuted};
    --jewel-stoplight-green: ${JEWEL.stoplightGreen};
    --jewel-stoplight-amber: ${JEWEL.stoplightAmber};
    --jewel-stoplight-ruby: ${JEWEL.stoplightRuby};
    --jewel-gradient-border: linear-gradient(90deg, #9333ea 0%, #10b981 100%);
    --jewel-font: var(--vscode-font-family, "Segoe UI", system-ui, sans-serif);
  }
`;

/** Operational sidebar dashboard (MSGFDashboardProvider). */
export const JEWEL_SIDEBAR_STYLES = `
  ${JEWEL_CSS_ROOT}
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 14px 12px 20px;
    font-family: var(--jewel-font);
    font-size: 12px;
    color: var(--jewel-text-ivory);
    background: radial-gradient(120% 80% at 0% 0%, ${JEWEL.bgMidnightAlt} 0%, ${JEWEL.bgMidnight} 45%, #020806 100%);
    min-height: 100vh;
  }
  h1 {
    font-size: 14px;
    font-weight: 700;
    margin: 0 0 6px;
    letter-spacing: 0.02em;
    color: var(--jewel-text-ivory);
    text-shadow: 0 0 24px rgba(16, 185, 129, 0.25);
  }
  h2 {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--jewel-text-jade);
    margin: 18px 0 10px;
    font-weight: 600;
  }
  .meta {
    color: var(--jewel-text-jade);
    font-size: 11px;
    margin-bottom: 14px;
    line-height: 1.5;
  }
  .meta strong { color: var(--jewel-text-ivory); }
  .stat-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 14px;
  }
  .stat-wrap {
    padding: 1px;
    border-radius: 8px;
    background: var(--jewel-gradient-border);
    box-shadow: 0 0 14px rgba(168, 85, 247, 0.12);
  }
  .stat {
    background: var(--jewel-surface-obsidian);
    border-radius: 7px;
    padding: 10px 10px 9px;
    min-height: 52px;
  }
  .stat .label {
    color: var(--jewel-text-jade);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .stat .value {
    font-size: 13px;
    font-weight: 700;
    margin-top: 5px;
    color: var(--jewel-text-ivory);
  }
  .stat.green .value {
    color: var(--jewel-stoplight-green);
    text-shadow: 0 0 12px rgba(16, 185, 129, 0.55);
  }
  .stat.yellow .value {
    color: var(--jewel-stoplight-amber);
    text-shadow: 0 0 10px rgba(245, 158, 11, 0.4);
  }
  .stat.red .value {
    color: var(--jewel-stoplight-ruby);
    text-shadow: 0 0 10px rgba(239, 68, 68, 0.45);
  }
  .stat.unknown .value { color: var(--jewel-purple-royal); }
  ul.pillars {
    list-style: none;
    padding: 0;
    margin: 0;
    background: var(--jewel-surface-forest);
    border-radius: 8px;
    border: 1px solid rgba(16, 185, 129, 0.12);
    overflow: hidden;
  }
  li.pillar {
    padding: 8px 10px;
    border-bottom: 1px solid rgba(167, 243, 208, 0.08);
    font-size: 11px;
    color: var(--jewel-text-jade);
  }
  li.pillar:last-child { border-bottom: none; }
  li.pillar .id { font-weight: 700; margin-right: 4px; }
  li.pillar.green .id {
    color: var(--jewel-stoplight-green);
    text-shadow: 0 0 8px rgba(16, 185, 129, 0.45);
  }
  li.pillar.yellow .id {
    color: var(--jewel-stoplight-amber);
  }
  li.pillar.red .id {
    color: var(--jewel-stoplight-ruby);
  }
  button.scan {
    width: 100%;
    margin-top: 4px;
    padding: 11px 14px;
    border-radius: 8px;
    border: 1px solid var(--jewel-purple-velvet);
    background: linear-gradient(165deg, ${JEWEL.purpleVelvet} 0%, #4c1d95 100%);
    color: var(--jewel-text-ivory);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.03em;
    cursor: pointer;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease;
  }
  button.scan:hover:not(:disabled) {
    border-color: var(--jewel-emerald-glow);
    box-shadow: 0 0 0 1px var(--jewel-emerald-glow), 0 0 20px rgba(16, 185, 129, 0.35);
  }
  button.scan:active:not(:disabled) { transform: translateY(1px); }
  button.scan:disabled {
    opacity: 0.55;
    cursor: wait;
    border-color: ${JEWEL.surfaceObsidian};
  }
  .banner {
    margin-top: 12px;
    padding: 10px 11px;
    border-radius: 8px;
    font-size: 11px;
    line-height: 1.45;
    color: var(--jewel-text-ivory);
  }
  .banner.ok {
    background: ${JEWEL.emeraldDeep};
    border: 1px solid var(--jewel-stoplight-green);
    box-shadow: inset 0 0 20px rgba(16, 185, 129, 0.08);
  }
  .banner.err {
    background: rgba(69, 10, 10, 0.45);
    border: 1px solid var(--jewel-stoplight-ruby);
    box-shadow: inset 0 0 16px rgba(239, 68, 68, 0.1);
  }
  .muted {
    color: var(--jewel-text-jade);
    opacity: 0.92;
  }
  .diagnostics-panel {
    margin-top: 4px;
    padding: 10px;
    border-radius: 8px;
    background: rgba(69, 10, 10, 0.35);
    border: 1px solid var(--jewel-stoplight-ruby);
    box-shadow: inset 0 0 18px rgba(239, 68, 68, 0.08);
  }
  .diagnostics-panel h3 {
    margin: 0 0 8px;
    font-size: 11px;
    color: var(--jewel-stoplight-ruby);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  ul.diagnostics {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  ul.diagnostics li {
    padding: 6px 0;
    border-bottom: 1px solid rgba(239, 68, 68, 0.15);
    font-size: 11px;
    color: var(--jewel-text-ivory);
    line-height: 1.4;
  }
  ul.diagnostics li:last-child { border-bottom: none; }
  ul.diagnostics .rule {
    display: block;
    color: var(--jewel-stoplight-amber);
    font-weight: 700;
    font-size: 10px;
    margin-bottom: 2px;
  }
  ul.diagnostics .loc {
    display: block;
    color: var(--jewel-text-jade);
    font-size: 10px;
  }
  .heal-console {
    margin-top: 8px;
    padding: 12px;
    border-radius: 10px;
    background: linear-gradient(165deg, rgba(22, 15, 41, 0.95) 0%, rgba(4, 20, 14, 0.92) 100%);
    border: 1px solid rgba(168, 85, 247, 0.35);
    box-shadow: 0 0 24px rgba(16, 185, 129, 0.08);
  }
  .heal-console h2.console-title {
    margin: 0 0 4px;
    font-size: 13px;
    font-weight: 700;
    color: var(--jewel-text-ivory);
    letter-spacing: 0.02em;
  }
  .heal-console .console-sub {
    margin: 0 0 12px;
    font-size: 11px;
    color: var(--jewel-text-jade);
    line-height: 1.45;
  }
  .heal-status {
    margin-bottom: 12px;
    padding: 9px 10px;
    border-radius: 8px;
    font-size: 11px;
    font-weight: 600;
    display: none;
  }
  .heal-status.visible { display: block; }
  .heal-status.processing {
    background: rgba(5, 150, 105, 0.2);
    border: 1px solid var(--jewel-emerald-glow);
    color: var(--jewel-emerald-glow);
  }
  .heal-status.scheduled {
    background: rgba(107, 33, 168, 0.25);
    border: 1px solid var(--jewel-purple-royal);
    color: var(--jewel-purple-royal);
  }
  .heal-status.success {
    background: ${JEWEL.emeraldDeep};
    border: 1px solid var(--jewel-stoplight-green);
    color: var(--jewel-stoplight-green);
  }
  .heal-status.error {
    background: rgba(69, 10, 10, 0.45);
    border: 1px solid var(--jewel-stoplight-ruby);
    color: var(--jewel-stoplight-ruby);
  }
  .pillar-group {
    margin-bottom: 10px;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid rgba(16, 185, 129, 0.1);
    background: rgba(11, 26, 20, 0.6);
  }
  .pillar-group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 7px 10px;
    background: rgba(0, 0, 0, 0.25);
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--jewel-emerald-glow);
  }
  .pillar-group-header .count {
    color: var(--jewel-text-jade);
    font-weight: 500;
  }
  .task-list { list-style: none; margin: 0; padding: 0; }
  .task-row {
    display: grid;
    grid-template-columns: 22px 1fr;
    gap: 8px;
    padding: 8px 10px;
    border-top: 1px solid rgba(167, 243, 208, 0.06);
    align-items: start;
    cursor: pointer;
  }
  .task-row:hover { background: rgba(16, 185, 129, 0.06); }
  .task-row input[type="checkbox"] {
    margin-top: 2px;
    accent-color: var(--jewel-emerald-glow);
    width: 14px;
    height: 14px;
    cursor: pointer;
  }
  .task-path {
    font-size: 11px;
    font-weight: 600;
    color: var(--jewel-text-ivory);
    word-break: break-all;
    line-height: 1.35;
  }
  .task-meta {
    margin-top: 3px;
    font-size: 10px;
    color: var(--jewel-text-jade);
    line-height: 1.35;
  }
  .task-meta code {
    font-size: 9px;
    color: var(--jewel-stoplight-amber);
    background: rgba(0,0,0,0.25);
    padding: 1px 4px;
    border-radius: 3px;
  }
  .heal-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 14px;
  }
  button.heal-prompt {
    width: 100%;
    margin-bottom: 8px;
    padding: 8px 12px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    border-radius: 8px;
    border: 1px solid rgba(56, 189, 248, 0.45);
    background: rgba(14, 116, 144, 0.25);
    color: #a5f3fc;
  }
  button.heal-prompt:hover:not(:disabled) {
    background: rgba(14, 116, 144, 0.4);
  }
  button.heal-primary {
    width: 100%;
    padding: 12px 14px;
    border-radius: 8px;
    border: 1px solid var(--jewel-emerald-glow);
    background: linear-gradient(165deg, ${JEWEL.emeraldActive} 0%, ${JEWEL.emeraldDeep} 100%);
    color: var(--jewel-text-ivory);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.04em;
    cursor: pointer;
    box-shadow: 0 0 18px rgba(16, 185, 129, 0.35);
  }
  button.heal-primary:hover:not(:disabled) {
    box-shadow: 0 0 24px rgba(16, 185, 129, 0.5);
  }
  button.heal-secondary {
    width: 100%;
    padding: 10px 14px;
    border-radius: 8px;
    border: 1px solid var(--jewel-purple-royal);
    background: transparent;
    color: var(--jewel-purple-royal);
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    opacity: 0.45;
    pointer-events: none;
  }
  button.heal-secondary.active {
    opacity: 1;
    pointer-events: auto;
    background: rgba(107, 33, 168, 0.2);
  }
  .schedule-row {
    display: grid;
    grid-template-columns: 1fr;
    gap: 6px;
  }
  .schedule-row label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--jewel-text-jade);
  }
  select.heal-schedule {
    width: 100%;
    padding: 9px 10px;
    border-radius: 8px;
    border: 1px solid rgba(168, 85, 247, 0.4);
    background: var(--jewel-surface-obsidian);
    color: var(--jewel-text-ivory);
    font-size: 11px;
    font-family: var(--jewel-font);
  }
  button.heal-schedule-btn {
    width: 100%;
    padding: 9px 12px;
    border-radius: 8px;
    border: 1px solid var(--jewel-purple-velvet);
    background: linear-gradient(165deg, #4c1d95 0%, ${JEWEL.purpleVelvet} 100%);
    color: var(--jewel-text-ivory);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.5;
    cursor: wait;
  }
  .command-center {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .command-section {
    margin-bottom: 16px;
  }
  .command-section:last-child { margin-bottom: 0; }
  .connection-status {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 12px 11px;
    border-radius: 10px;
    border: 1px solid rgba(16, 185, 129, 0.2);
    background: var(--jewel-surface-forest);
  }
  .connection-status.connected {
    border-color: var(--jewel-stoplight-green);
    box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.25), inset 0 0 24px rgba(16, 185, 129, 0.06);
  }
  .connection-status.degraded {
    border-color: var(--jewel-stoplight-amber);
    box-shadow: inset 0 0 16px rgba(245, 158, 11, 0.08);
  }
  .connection-status.offline {
    border-color: var(--jewel-stoplight-ruby);
    box-shadow: inset 0 0 16px rgba(239, 68, 68, 0.08);
  }
  .connection-dot {
    flex-shrink: 0;
    width: 11px;
    height: 11px;
    margin-top: 2px;
    border-radius: 50%;
    background: var(--jewel-stoplight-ruby);
  }
  .connection-status.connected .connection-dot {
    background: var(--jewel-stoplight-green);
    animation: msgf-pulse-green 1.6s ease-in-out infinite;
  }
  .connection-status.degraded .connection-dot {
    background: var(--jewel-stoplight-amber);
  }
  @keyframes msgf-pulse-green {
    0%, 100% {
      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.65);
      opacity: 1;
    }
    50% {
      box-shadow: 0 0 0 7px rgba(16, 185, 129, 0);
      opacity: 0.82;
    }
  }
  .connection-copy { flex: 1; min-width: 0; }
  .connection-label {
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.03em;
    color: var(--jewel-text-ivory);
    margin-bottom: 3px;
  }
  .connection-status.connected .connection-label {
    color: var(--jewel-stoplight-green);
    text-shadow: 0 0 12px rgba(16, 185, 129, 0.45);
  }
  .connection-detail {
    font-size: 10px;
    line-height: 1.45;
    color: var(--jewel-text-jade);
    word-break: break-word;
  }
  .optimizer-panel {
    padding: 12px;
    border-radius: 10px;
    background: linear-gradient(165deg, rgba(22, 15, 41, 0.92) 0%, rgba(4, 20, 14, 0.88) 100%);
    border: 1px solid rgba(168, 85, 247, 0.35);
    box-shadow: 0 0 20px rgba(16, 185, 129, 0.06);
  }
  .optimizer-panel label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    color: var(--jewel-text-ivory);
    margin-bottom: 8px;
    line-height: 1.4;
  }
  textarea.optimizer-intent {
    width: 100%;
    min-height: 88px;
    max-height: 160px;
    resize: vertical;
    padding: 10px 11px;
    border-radius: 8px;
    border: 1px solid rgba(16, 185, 129, 0.22);
    background: rgba(2, 8, 6, 0.85);
    color: var(--jewel-text-ivory);
    font-family: var(--jewel-font);
    font-size: 12px;
    line-height: 1.45;
    margin-bottom: 10px;
  }
  textarea.optimizer-intent:focus {
    outline: none;
    border-color: var(--jewel-emerald-glow);
    box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.35);
  }
  textarea.optimizer-intent::placeholder {
    color: rgba(167, 243, 208, 0.45);
  }
  button.optimizer-primary {
    width: 100%;
    padding: 12px 14px;
    border-radius: 8px;
    border: 1px solid var(--jewel-emerald-glow);
    background: linear-gradient(165deg, ${JEWEL.emeraldActive} 0%, ${JEWEL.emeraldDeep} 100%);
    color: var(--jewel-text-ivory);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.04em;
    cursor: pointer;
    box-shadow: 0 0 18px rgba(16, 185, 129, 0.35);
    transition: box-shadow 0.2s ease, transform 0.15s ease;
  }
  button.optimizer-primary:hover:not(:disabled) {
    box-shadow: 0 0 26px rgba(16, 185, 129, 0.5);
  }
  button.optimizer-primary:active:not(:disabled) { transform: translateY(1px); }
  button.optimizer-primary:disabled {
    opacity: 0.55;
    cursor: wait;
  }
  .optimizer-status {
    margin-top: 10px;
    padding: 8px 10px;
    border-radius: 8px;
    font-size: 11px;
    line-height: 1.4;
    display: none;
  }
  .optimizer-status.visible { display: block; }
  .optimizer-status.ok {
    background: ${JEWEL.emeraldDeep};
    border: 1px solid var(--jewel-stoplight-green);
    color: var(--jewel-stoplight-green);
  }
  .optimizer-status.err {
    background: rgba(69, 10, 10, 0.45);
    border: 1px solid var(--jewel-stoplight-ruby);
    color: var(--jewel-stoplight-ruby);
  }
  .diagnostic-section {
    margin-top: 4px;
  }
  details.advanced-ops {
    margin-top: 18px;
    border-radius: 8px;
    border: 1px solid rgba(167, 243, 208, 0.1);
    background: rgba(11, 26, 20, 0.45);
    overflow: hidden;
  }
  details.advanced-ops summary {
    padding: 10px 12px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--jewel-text-jade);
    cursor: pointer;
    list-style: none;
  }
  details.advanced-ops summary::-webkit-details-marker { display: none; }
  .advanced-body {
    padding: 0 12px 12px;
    border-top: 1px solid rgba(167, 243, 208, 0.06);
  }
  .advanced-body h2 {
    margin-top: 14px;
  }
  .run-scripts-panel {
    padding: 12px;
    border-radius: 10px;
    background: var(--jewel-surface-forest);
    border: 1px solid rgba(16, 185, 129, 0.18);
  }
  ul.run-scripts-list {
    list-style: none;
    margin: 0 0 10px;
    padding: 0;
  }
  li.run-script-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid rgba(167, 243, 208, 0.08);
  }
  li.run-script-row:last-child { border-bottom: none; }
  li.run-script-empty {
    padding: 8px 0;
    font-size: 11px;
    line-height: 1.45;
  }
  .run-script-label {
    display: block;
    font-size: 11px;
    font-weight: 700;
    color: var(--jewel-text-ivory);
    margin-bottom: 3px;
  }
  .run-script-cmd {
    display: block;
    font-size: 10px;
    color: var(--jewel-text-jade);
    word-break: break-all;
    background: rgba(0, 0, 0, 0.2);
    padding: 3px 6px;
    border-radius: 4px;
  }
  button.run-script-one {
    padding: 6px 10px;
    border-radius: 6px;
    border: 1px solid var(--jewel-emerald-glow);
    background: rgba(5, 150, 105, 0.25);
    color: var(--jewel-emerald-glow);
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
  }
  button.run-script-one:hover:not(:disabled) {
    background: rgba(5, 150, 105, 0.4);
  }
  button.run-scripts-primary {
    width: 100%;
    padding: 11px 14px;
    border-radius: 8px;
    border: 1px solid var(--jewel-purple-royal);
    background: linear-gradient(165deg, #4c1d95 0%, ${JEWEL.purpleVelvet} 100%);
    color: var(--jewel-text-ivory);
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
    margin-bottom: 8px;
  }
  button.run-scripts-primary:hover:not(:disabled) {
    box-shadow: 0 0 16px rgba(168, 85, 247, 0.35);
  }
  .run-scripts-hint {
    margin: 0;
    font-size: 10px;
    line-height: 1.4;
  }
  .run-scripts-hint code {
    font-size: 9px;
    color: var(--jewel-emerald-glow);
  }
`;

/** Full editor panel chrome wrapping the hosted dashboard iframe. */
export const JEWEL_PANEL_SHELL_STYLES = `
  ${JEWEL_CSS_ROOT}
  html, body {
    margin: 0;
    padding: 0;
    height: 100%;
    overflow: hidden;
    background: ${JEWEL.bgMidnight};
  }
  .jewel-chrome {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: radial-gradient(100% 60% at 50% 0%, ${JEWEL.bgMidnightAlt}, ${JEWEL.bgMidnight});
  }
  .jewel-header {
    flex-shrink: 0;
    padding: 10px 14px;
    border-bottom: 1px solid transparent;
    border-image: var(--jewel-gradient-border) 1;
    background: ${JEWEL.surfaceObsidian};
    color: var(--jewel-text-ivory);
    font-family: var(--jewel-font);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
  }
  .jewel-header span.accent {
    color: var(--jewel-emerald-glow);
    text-shadow: 0 0 12px rgba(16, 185, 129, 0.4);
  }
  .jewel-frame-wrap {
    flex: 1;
    padding: 1px;
    background: var(--jewel-gradient-border);
    margin: 0;
  }
  .jewel-frame-inner {
    height: 100%;
    background: ${JEWEL.bgMidnight};
  }
  iframe {
    border: 0;
    width: 100%;
    height: 100%;
    display: block;
  }
  .fallback {
    padding: 1.25rem;
    font-family: var(--jewel-font);
    color: var(--jewel-text-jade);
    background: ${JEWEL.surfaceObsidian};
  }
  .fallback a {
    color: var(--jewel-emerald-glow);
    text-decoration: none;
  }
  .fallback a:hover {
    color: var(--jewel-purple-royal);
    text-decoration: underline;
  }
`;
