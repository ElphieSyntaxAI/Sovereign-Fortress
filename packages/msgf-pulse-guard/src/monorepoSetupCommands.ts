import * as fs from "fs";
import * as path from "path";

import * as vscode from "vscode";

import { readMsgfSettings } from "./config";
import { mergeWorkspaceSettings } from "./ideSetupCommands";
import { MONOREPO_PRODUCT_PRESETS } from "./monorepoProducts";
import { getRepoRoot } from "./workspace/msgfWorkspace";

const LOG_PREFIX = "[MSGF Guard]";

let monorepoHintShown = false;

export async function configureMonorepoProduct(): Promise<void> {
  const repo = getRepoRoot();
  if (!repo) {
    void vscode.window.showWarningMessage(`${LOG_PREFIX} Open the monorepo folder first.`);
    return;
  }

  const current = readMsgfSettings();
  const pick = await vscode.window.showQuickPick(
    MONOREPO_PRODUCT_PRESETS.map((p) => ({
      label: p.label,
      description: `${p.projectOrigin} → ${p.productPath}`,
      preset: p,
    })),
    {
      title: "MSGF monorepo product",
      placeHolder: "Which app are you working on?",
      matchOnDescription: true,
    }
  );
  if (!pick) return;

  const ok = await mergeWorkspaceSettings({
    "msgf.productPath": pick.preset.productPath,
    "msgf.tenantKey": pick.preset.projectOrigin,
    "msgf.apiUrl": current.apiUrl || "https://elphiesgatedai.elphiesyntax.com",
    "msgf.role": current.role || "dev",
    "msgf.devSession": current.devSession,
  });

  if (ok) {
    void vscode.window.showInformationMessage(
      `${LOG_PREFIX} Scoped to ${pick.preset.label} (${pick.preset.productPath}). Reload the window, then MSGF: Test connection.`
    );
  }
}

export function maybePromptMonorepoSetup(context: vscode.ExtensionContext): void {
  if (monorepoHintShown) return;
  const repo = getRepoRoot();
  if (!repo) return;

  const settings = readMsgfSettings();
  if (settings.productPath.trim() && settings.tenantKey.includes("/")) return;

  const hasWorkspaces = MONOREPO_PRODUCT_PRESETS.some((p) =>
    fs.existsSync(path.join(repo, p.productPath))
  );
  if (!hasWorkspaces) return;

  monorepoHintShown = true;
  const key = "msgf.monorepoSetupDismissed";
  if (context.globalState.get<boolean>(key)) return;

  void vscode.window
    .showInformationMessage(
      `${LOG_PREFIX} This looks like the Elphie Syntax monorepo. Configure which app MSGF should track?`,
      "Configure product",
      "Open Author workspace",
      "Dismiss"
    )
    .then(async (choice) => {
      if (choice === "Configure product") {
        await configureMonorepoProduct();
      } else if (choice === "Open Author workspace") {
        const uri = vscode.Uri.file(path.join(repo, "workspaces", "author-ecosystem.code-workspace"));
        await vscode.commands.executeCommand("vscode.openFolder", uri, true);
      } else if (choice === "Dismiss") {
        await context.globalState.update(key, true);
      }
    });
}

export function registerMonorepoSetupCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("msgf.configureMonorepoProduct", () => {
      void configureMonorepoProduct();
    })
  );
  maybePromptMonorepoSetup(context);
}
