import * as vscode from "vscode";

import { readMsgfSettings } from "./config";

let activePanel: vscode.WebviewPanel | undefined;

function dashboardUri(apiUrl: string): string {
  return `${apiUrl.replace(/\/$/, "")}/dashboard`;
}

function buildDashboardHtml(cspSource: string, targetUrl: string): string {
  const csp = [
    "default-src 'none'",
    `frame-src ${cspSource} https: http:`,
    "style-src 'unsafe-inline'",
  ].join("; ");

  const safeUrl = targetUrl.replace(/"/g, "&quot;");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MSGF Dashboard</title>
  <style>
    html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; background: #1e1e1e; }
    iframe { border: 0; width: 100%; height: 100%; }
    .fallback { padding: 1rem; font-family: sans-serif; color: #ccc; }
    a { color: #3794ff; }
  </style>
</head>
<body>
  <iframe src="${safeUrl}" title="MSGF Dashboard"></iframe>
  <noscript>
    <div class="fallback">
      <p>MSGF Dashboard requires scripts.</p>
      <p><a href="${safeUrl}">Open dashboard</a> in your browser.</p>
    </div>
  </noscript>
</body>
</html>`;
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
      panel.webview.html = buildDashboardHtml(panel.webview.cspSource, target);

      panel.onDidDispose(() => {
        activePanel = undefined;
      });
    })
  );
}
