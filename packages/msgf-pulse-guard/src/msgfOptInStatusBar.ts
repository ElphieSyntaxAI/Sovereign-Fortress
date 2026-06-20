import * as vscode from "vscode";

/**
 * Visible when MSGF is off — one-click entry to the opt-in confirmation flow.
 */
export class MsgfOptInStatusBar {
  readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
    this.item.text = "$(shield) Enable MSGF";
    this.item.tooltip =
      "Turn on MSGF for this file tree only (.msgf/, Pulse, governance API)";
    this.item.command = "msgf.confirmEnableForWorkspace";
    this.item.show();
  }

  dispose(): void {
    this.item.dispose();
  }
}
