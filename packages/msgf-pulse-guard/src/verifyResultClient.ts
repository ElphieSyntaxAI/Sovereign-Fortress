import type { MsgfGuardSettings } from "./config";
import { buildApiAuthHeaders } from "./pulseAuth";
import { resolveHealQueueTenantUuid } from "./healQueueClient";

export type VerifyResultPayload = {
  passed: boolean;
  command?: string;
  exit_code?: number;
  stdout_snippet?: string;
  stderr_snippet?: string;
  file_paths?: string[];
  dev_heal_choice?: "self_guided" | "self_local" | "cloud";
  incident_id?: string | null;
  actor_id?: string;
  pack_id?: string;
  /** A5 fire-and-forget from Pulse Guard */
  async?: boolean;
  correlation_id?: string;
};

export async function postVerifyResult(params: {
  settings: MsgfGuardSettings;
  tenantKey: string;
  entityId?: string;
  body: VerifyResultPayload;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: boolean; narrative_log_id?: string | null; error?: string }> {
  const fetchFn = params.fetchImpl ?? fetch;
  const tenantUuid = resolveHealQueueTenantUuid(params.tenantKey);
  const baseUrl = params.settings.apiUrl.replace(/\/$/, "");
  const url = `${baseUrl}/api/msgf/verify-result`;

  const headers: Record<string, string> = {
    ...buildApiAuthHeaders({
      settings: params.settings,
      tenantId: params.tenantKey,
    }),
    "Content-Type": "application/json",
  };

  if (params.entityId?.trim()) {
    headers["x-msgf-entity-id"] = params.entityId.trim();
  }

  try {
    const res = await fetchFn(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        tenant_id: tenantUuid,
        product_surface: "ide",
        actor_id: params.entityId?.trim() || undefined,
        ...params.body,
      }),
    });
    const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || raw.ok !== true) {
      return {
        ok: false,
        error:
          typeof raw.error === "string"
            ? raw.error
            : `verify-result failed (${res.status}).`,
      };
    }
    return {
      ok: true,
      narrative_log_id:
        typeof raw.narrative_log_id === "string" ? raw.narrative_log_id : null,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "verify-result network error",
    };
  }
}
