import * as vscode from "vscode";

import { readMsgfSettings, resolveTenantId } from "./config";
import {
  fetchAgentContextPack,
  resolveHealQueueTenantUuid,
} from "./healQueueClient";

const LOG_PREFIX = "[MSGF Guard]";

export async function runGenerateContextPack(): Promise<void> {
  const settings = readMsgfSettings();
  const tenantKey = resolveTenantId(settings);
  const tenantUuid = resolveHealQueueTenantUuid(tenantKey);

  if (!settings.authToken?.trim()) {
    void vscode.window.showWarningMessage(
      `${LOG_PREFIX} msgf.authToken required to fetch context pack.`
    );
    return;
  }

  const result = await fetchAgentContextPack({
    settings,
    tenantUuid,
    mode: "guided",
  });

  if (!result.ok || !result.markdown) {
    void vscode.window.showErrorMessage(
      result.error ?? `${LOG_PREFIX} Could not fetch agent context pack.`
    );
    return;
  }

  await vscode.env.clipboard.writeText(result.markdown);
  void vscode.window.showInformationMessage(
    "MSGF 0-token context pack copied — paste into your agent chat."
  );
}

export function registerGenerateContextPackCommand(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("msgf.generateContextPack", () => {
      void runGenerateContextPack();
    })
  );
}
