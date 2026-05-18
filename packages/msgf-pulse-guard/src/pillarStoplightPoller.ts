import { readMsgfSettings, resolveTenantId } from "./config";
import type { PillarHealthReport } from "./pillarHealthTypes";
import { aggregateStoplight } from "./pillarHealthTypes";
import { buildApiAuthHeaders } from "./pulseAuth";

const LOG_PREFIX = "[MSGF Guard]";

export type StoplightPollResult =
  | { ok: true; report: PillarHealthReport }
  | { ok: false; error: string };

export async function fetchPillarHealthReport(
  fetchImpl: typeof fetch = fetch.bind(globalThis)
): Promise<StoplightPollResult> {
  const settings = readMsgfSettings();
  const tenantId = resolveTenantId(settings);
  const baseUrl = settings.apiUrl.replace(/\/$/, "");
  const url = `${baseUrl}/api/msgf/health/pillars?lookback_hours=168`;

  const headers = buildApiAuthHeaders({ settings, tenantId });
  if (!headers.Authorization) {
    return { ok: false, error: "msgf.authToken required for pillar health polling." };
  }

  try {
    const res = await fetchImpl(url, { method: "GET", headers });
    const raw = (await res.json().catch(() => ({}))) as PillarHealthReport & {
      error?: string;
    };

    if (!res.ok) {
      const message =
        typeof raw.error === "string"
          ? raw.error
          : `Pillar health failed (${res.status})`;
      return { ok: false, error: message };
    }

    if (!Array.isArray(raw.pillars)) {
      return { ok: false, error: "Invalid pillar health response." };
    }

    return { ok: true, report: raw };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Pillar health network error";
    console.warn(`${LOG_PREFIX} pillar poll error:`, message);
    return { ok: false, error: message };
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
