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
