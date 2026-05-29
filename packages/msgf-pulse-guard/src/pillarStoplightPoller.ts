import { classifyHttpError, formatClassifiedErrorForTooltip } from "./classifyHttpError";
import { readMsgfSettings, resolveTenantId } from "./config";
import type { PillarHealthReport } from "./pillarHealthTypes";
import { aggregateStoplight } from "./pillarHealthTypes";
import { buildIdeApiAuthHeaders } from "./pulseAuth";

const LOG_PREFIX = "[MSGF Guard]";

export type StoplightPollResult =
  | { ok: true; report: PillarHealthReport }
  | { ok: false; error: string; errorDetail?: string };

export async function fetchPillarHealthReport(params?: {
  entityId?: string;
  fetchImpl?: typeof fetch;
}): Promise<StoplightPollResult> {
  const settings = readMsgfSettings();
  const tenantId = resolveTenantId(settings);
  const baseUrl = settings.apiUrl.replace(/\/$/, "");
  const url = `${baseUrl}/api/msgf/health/pillars?lookback_hours=168`;

  const headers = buildIdeApiAuthHeaders({
    settings,
    tenantId,
    entityId: params?.entityId,
  });
  if (!headers.Authorization) {
    const c = classifyHttpError({
      status: 401,
      body: { error: "msgf.authToken required for pillar health polling." },
    });
    return {
      ok: false,
      error: c.message,
      errorDetail: formatClassifiedErrorForTooltip(c),
    };
  }

  const fetchFn = params?.fetchImpl ?? fetch.bind(globalThis);

  try {
    const res = await fetchFn(url, { method: "GET", headers });
    const raw = (await res.json().catch(() => ({}))) as PillarHealthReport & {
      error?: string;
    };

    if (!res.ok) {
      const c = classifyHttpError({
        status: res.status,
        body: raw as Record<string, unknown>,
      });
      return {
        ok: false,
        error: c.message,
        errorDetail: formatClassifiedErrorForTooltip(c),
      };
    }

    if (!Array.isArray(raw.pillars)) {
      const c = classifyHttpError({ status: res.status, body: { error: "Invalid pillar health response." } });
      return { ok: false, error: c.message, errorDetail: formatClassifiedErrorForTooltip(c) };
    }

    return { ok: true, report: raw };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Pillar health network error";
    console.warn(`${LOG_PREFIX} pillar poll error:`, message);
    const c = classifyHttpError({ networkMessage: message });
    return { ok: false, error: c.message, errorDetail: formatClassifiedErrorForTooltip(c) };
  }
}

export function formatPillarList(entries: { pillar: string; label: string; summary: string }[]): string {
  return entries
    .map((e) => `${e.pillar} (${e.label}): ${e.summary}`)
    .join("\n");
}

export function stoplightFromReport(report: PillarHealthReport) {
  return aggregateStoplight(report);
}
