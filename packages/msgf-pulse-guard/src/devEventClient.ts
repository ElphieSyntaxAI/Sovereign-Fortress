import type { MsgfGuardSettings } from "./config";
import { buildIdeApiAuthHeaders } from "./pulseAuth";
import { redactTerminalSnippet } from "./utils/shell-safe-path";

export type DevEventBuildFailedPayload = {
  activeFile: string;
  excerpt: string;
  exitCode: number;
};

export async function postDevEventBuildFailed(params: {
  settings: MsgfGuardSettings;
  tenantKey: string;
  entityId?: string;
  body: DevEventBuildFailedPayload;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: boolean; error?: string }> {
  const fetchFn = params.fetchImpl ?? fetch;
  const baseUrl = params.settings.apiUrl.replace(/\/$/, "");
  const url = `${baseUrl}/api/msgf/dev-event`;

  const headers = {
    "Content-Type": "application/json",
    ...buildIdeApiAuthHeaders({
      settings: params.settings,
      tenantId: params.tenantKey,
      entityId: params.entityId,
    }),
  };

  try {
    const res = await fetchFn(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        kind: "build_failed",
        tenantId: params.tenantKey,
        activeFile: params.body.activeFile.slice(0, 512),
        excerpt: redactTerminalSnippet(params.body.excerpt, 12_000),
        exitCode: params.body.exitCode,
      }),
    });
    const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || raw.ok === false) {
      return {
        ok: false,
        error:
          typeof raw.error === "string"
            ? raw.error
            : typeof raw.message === "string"
              ? raw.message
              : `dev-event failed (${res.status}).`,
      };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "dev-event network error",
    };
  }
}
