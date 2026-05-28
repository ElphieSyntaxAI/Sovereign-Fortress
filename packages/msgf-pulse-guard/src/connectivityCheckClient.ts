import { readMsgfSettings, resolveEntityId, resolveTenantId, settingsReady } from "./config";
import type * as vscode from "vscode";
import { buildApiAuthHeaders } from "./pulseAuth";
import { MSGF_IDE_PULSE_HEADER } from "./constants";

export type ConnectivityCheckResult = {
  ok: boolean;
  checks: Array<{
    name: string;
    ok: boolean;
    user_message?: string;
    error_code?: string;
    fix_steps?: string[];
  }>;
};

export async function fetchConnectivityCheck(params: {
  context: vscode.ExtensionContext;
  fetchImpl?: typeof fetch;
}): Promise<ConnectivityCheckResult | { ok: false; error: string }> {
  const settings = readMsgfSettings();
  const ready = settingsReady(settings);
  if (!ready.ok) {
    return { ok: false, error: `Missing: ${ready.missing.join(", ")}` };
  }

  const tenantId = resolveTenantId(settings);
  const entityId = await resolveEntityId(params.context, settings);
  const baseUrl = settings.apiUrl.replace(/\/$/, "");
  const url = `${baseUrl}/api/msgf/ide/connectivity-check`;
  const fetchFn = params.fetchImpl ?? fetch.bind(globalThis);

  const headers = {
    ...buildApiAuthHeaders({ settings, tenantId, entityId }),
    [MSGF_IDE_PULSE_HEADER]: "1",
  };

  try {
    const res = await fetchFn(url, { method: "GET", headers });
    const raw = (await res.json().catch(() => ({}))) as ConnectivityCheckResult & {
      error?: string;
    };
    if (!res.ok && !raw.checks) {
      return { ok: false, error: typeof raw.error === "string" ? raw.error : `HTTP ${res.status}` };
    }
    return raw;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Network error";
    return { ok: false, error: message };
  }
}
