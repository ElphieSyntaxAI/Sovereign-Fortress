import * as vscode from "vscode";

import { readMsgfSettings } from "./config";
import { msgfSignInUrl, msgfWorkspaceIdeSetupUrl, openMsgfSignInBrowser } from "./openMsgfExternal";
import { JEWEL_PANEL_SHELL_STYLES } from "./ui/jewelTheme";

let activePanel: vscode.WebviewPanel | undefined;

const AUTH_BANNER_STYLES = `
  .jewel-auth-banner {
    flex-shrink: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    padding: 8px 14px;
    border-bottom: 1px solid rgba(245, 158, 11, 0.35);
    background: rgba(120, 53, 15, 0.35);
    color: #fde68a;
    font-family: var(--jewel-font);
    font-size: 11px;
    line-height: 1.4;
  }
  .jewel-auth-banner strong { color: #fef3c7; }
  .jewel-auth-banner button {
    margin-left: auto;
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid rgba(16, 185, 129, 0.5);
    background: linear-gradient(165deg, #065f46 0%, #047857 100%);
    color: #ecfdf5;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }
  .jewel-auth-banner button.secondary {
    margin-left: 0;
    border-color: rgba(168, 85, 247, 0.45);
    background: rgba(76, 29, 149, 0.55);
  }
`;

function dashboardUri(apiUrl: string): string {
  return `${apiUrl.replace(/\/$/, "")}/dashboard`;
}

function buildDashboardHtml(cspSource: string, targetUrl: string, signInUrl: string): string {
  const csp = [
    "default-src 'none'",
    `frame-src ${cspSource} https: http:`,
    "style-src 'unsafe-inline'",
    `script-src ${cspSource}`,
  ].join("; ");

  const safeUrl = targetUrl.replace(/"/g, "&quot;");
  const safeSignIn = signInUrl.replace(/"/g, "&quot;");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MSGF Dashboard</title>
  <style>${JEWEL_PANEL_SHELL_STYLES}${AUTH_BANNER_STYLES}</style>
</head>
<body>
  <div class="jewel-chrome">
    <header class="jewel-header">MSGF <span class="accent">Governance</span> Dashboard</header>
    <div class="jewel-auth-banner" role="note">
      <span><strong>Do not sign in inside this panel.</strong> VS Code blocks session cookies in embedded pages — correct passwords look like they “clear” the form.</span>
      <button type="button" class="secondary" data-action="ide-setup">Get IDE token (browser)</button>
      <button type="button" data-action="sign-in">Sign in in browser</button>
    </div>
    <div class="jewel-frame-wrap">
      <div class="jewel-frame-inner">
        <iframe src="${safeUrl}" title="MSGF Dashboard"></iframe>
      </div>
    </div>
  </div>
  <noscript>
    <div class="fallback">
      <p>MSGF Dashboard requires scripts.</p>
      <p><a href="${safeSignIn}">Sign in</a> or <a href="${safeUrl}">open dashboard</a> in your browser.</p>
    </div>
  </noscript>
  <script>
    const vscode = acquireVsCodeApi();
    document.querySelectorAll('.jewel-auth-banner button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-action');
        vscode.postMessage({ type: action === 'ide-setup' ? 'openIdeSetup' : 'openSignIn' });
      });
    });
  </script>
</body>
</html>`;
}

function wireDashboardPanel(panel: vscode.WebviewPanel, target: string): void {
  panel.webview.html = buildDashboardHtml(
    panel.webview.cspSource,
    target,
    msgfSignInUrl()
  );

  panel.webview.onDidReceiveMessage((message: unknown) => {
    const type =
      message && typeof message === "object" && "type" in message
        ? String((message as { type: unknown }).type)
        : "";
    if (type === "openSignIn") {
      void openMsgfSignInBrowser();
      return;
    }
    if (type === "openIdeSetup") {
      void vscode.env.openExternal(vscode.Uri.parse(msgfWorkspaceIdeSetupUrl()));
    }
  });
}

export function registerOpenDashboardCommand(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("msgf.openDashboard", () => {
      const settings = readMsgfSettings();
      const target = dashboardUri(settings.apiUrl);

      if (activePanel) {
        activePanel.reveal(vscode.ViewColumn.One);
        return;
      }

      const panel = vscode.window.createWebviewPanel(
        "msgfDashboard",
        "MSGF Dashboard",
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        }
      );

      activePanel = panel;
      wireDashboardPanel(panel, target);

      panel.onDidDispose(() => {
        activePanel = undefined;
      });
    })
  );
}
