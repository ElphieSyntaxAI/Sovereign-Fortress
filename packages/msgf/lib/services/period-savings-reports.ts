/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-570add3d-20260922T212921Z-internal
 */
/**
 * Log + list weekly / monthly MSGF consumption & savings reports.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { calculateEcoSavings, type EcoMetrics } from "@/lib/utils/ecoCalculator";
import { PROVEN_ECO_DISCLAIMER } from "@/lib/services/proven-savings";
import {
  isoWeekPeriodKey,
  isoWeekStartDate,
  monthPeriodKey,
  previousIsoWeekKeys,
  previousMonthKeys,
  readPeriodLiveCounters,
  type PeriodKind,
  type PeriodLiveCounters,
} from "@/lib/services/period-counters";

export type PeriodSavingsReportRow = {
  id?: number;
  tenant_id: string;
  user_id: string | null;
  period_kind: PeriodKind;
  period_key: string;
  period_label: string;
  period_start: string;
  period_end: string;
  tokens_consumed_metered: number;
  tokens_saved_proven: number;
  tokens_saved_estimated: number;
  provider_calls: number;
  /** Shadow Proxy projected USD savings (cents/100). Not proven eco. */
  shadow_projected_usd: number;
  eco_metrics: EcoMetrics;
  eco_claimable: boolean;
  source: "live" | "logged";
  logged_at: string;
  notes: string;
};

export type PeriodSavingsReportsBundle = {
  tenant_id: string;
  weekly: PeriodSavingsReportRow[];
  monthly: PeriodSavingsReportRow[];
  disclaimer: string;
};

function periodBounds(kind: PeriodKind, periodKey: string): {
  label: string;
  start: string;
  end: string;
} {
  if (kind === "weekly") {
    const start = isoWeekStartDate(periodKey);
    const startDate = new Date(`${start}T00:00:00.000Z`);
    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + 6);
    const end = endDate.toISOString().slice(0, 10);
    return {
      label: `Week of ${start}`,
      start,
      end,
    };
  }
  const [y, m] = periodKey.split("-").map(Number);
  const start = `${periodKey}-01`;
  const endDate = new Date(Date.UTC(y!, m!, 0));
  const end = endDate.toISOString().slice(0, 10);
  const monthName = new Date(Date.UTC(y!, (m ?? 1) - 1, 1)).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return { label: monthName, start, end };
}

function rowFromLive(
  tenantId: string,
  userId: string | null,
  live: PeriodLiveCounters
): PeriodSavingsReportRow {
  const bounds = periodBounds(live.period_kind, live.period_key);
  const eco = calculateEcoSavings(live.proven_saved);
  return {
    tenant_id: tenantId,
    user_id: userId,
    period_kind: live.period_kind,
    period_key: live.period_key,
    period_label: bounds.label,
    period_start: bounds.start,
    period_end: bounds.end,
    tokens_consumed_metered: live.metered_consumed,
    tokens_saved_proven: live.proven_saved,
    tokens_saved_estimated: live.estimated_saved,
    provider_calls: live.provider_calls,
    shadow_projected_usd: Math.round((live.shadow_projected_usd_cents / 100) * 1_000_000) / 1_000_000,
    eco_metrics: eco,
    eco_claimable: live.proven_saved > 0,
    source: "live",
    logged_at: new Date().toISOString(),
    notes:
      live.proven_saved > 0
        ? "Proven avoided tokens drive eco columns."
        : "Eco columns stay zero until proven avoidance exists.",
  };
}

function mapDbRow(row: Record<string, unknown>): PeriodSavingsReportRow {
  const proven = Math.floor(Number(row.tokens_saved_proven ?? 0));
  const eco = calculateEcoSavings(proven);
  return {
    id: typeof row.id === "number" ? row.id : Number(row.id) || undefined,
    tenant_id: String(row.tenant_id ?? ""),
    user_id: typeof row.user_id === "string" ? row.user_id : null,
    period_kind: row.period_kind === "monthly" ? "monthly" : "weekly",
    period_key: String(row.period_key ?? ""),
    period_label: String(row.period_label ?? row.period_key ?? ""),
    period_start: String(row.period_start ?? ""),
    period_end: String(row.period_end ?? ""),
    tokens_consumed_metered: Math.floor(Number(row.tokens_consumed_metered ?? 0)),
    tokens_saved_proven: proven,
    tokens_saved_estimated: Math.floor(Number(row.tokens_saved_estimated ?? 0)),
    provider_calls: Math.floor(Number(row.provider_calls ?? 0)),
    shadow_projected_usd: Number(row.shadow_projected_usd ?? 0),
    eco_metrics: eco,
    eco_claimable: proven > 0,
    source: "logged",
    logged_at: String(row.logged_at ?? row.updated_at ?? new Date().toISOString()),
    notes: String(row.notes ?? ""),
  };
}

export async function upsertPeriodSavingsReport(
  admin: SupabaseClient,
  row: PeriodSavingsReportRow
): Promise<PeriodSavingsReportRow> {
  const payload = {
    tenant_id: row.tenant_id,
    user_id: row.user_id,
    period_kind: row.period_kind,
    period_key: row.period_key,
    period_label: row.period_label,
    period_start: row.period_start,
    period_end: row.period_end,
    tokens_consumed_metered: row.tokens_consumed_metered,
    tokens_saved_proven: row.tokens_saved_proven,
    tokens_saved_estimated: row.tokens_saved_estimated,
    provider_calls: row.provider_calls,
    shadow_projected_usd: row.shadow_projected_usd,
    eco_kwh: row.eco_metrics.grid_compute_prevented_kwh,
    eco_co2e_lbs: row.eco_metrics.co2e_offset_lbs,
    eco_water_gal: row.eco_metrics.freshwater_conserved_gallons,
    eco_claimable: row.eco_claimable,
    notes: row.notes,
    logged_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from("msgf_period_savings_reports")
    .upsert(payload, { onConflict: "tenant_id,period_kind,period_key" })
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`period savings report upsert failed: ${error.message}`);
  }
  if (!data) return { ...row, source: "logged", logged_at: payload.logged_at };
  return mapDbRow(data as Record<string, unknown>);
}

export async function logCurrentPeriodReports(params: {
  admin: SupabaseClient;
  tenantId: string;
  userId?: string | null;
  kinds?: PeriodKind[];
}): Promise<PeriodSavingsReportRow[]> {
  const tid = params.tenantId.trim();
  if (!tid) throw new Error("tenant_id is required");
  const kinds = params.kinds ?? (["weekly", "monthly"] as PeriodKind[]);
  const out: PeriodSavingsReportRow[] = [];

  for (const kind of kinds) {
    const key = kind === "weekly" ? isoWeekPeriodKey() : monthPeriodKey();
    const live = await readPeriodLiveCounters(tid, kind, key);
    const draft = rowFromLive(tid, params.userId ?? null, live);
    try {
      out.push(await upsertPeriodSavingsReport(params.admin, draft));
    } catch (e) {
      console.warn("[period-savings-reports] upsert skipped (table missing?):", e);
      out.push(draft);
    }
  }
  return out;
}

async function loadLoggedReports(
  admin: SupabaseClient,
  tenantId: string,
  kind: PeriodKind,
  limit: number
): Promise<PeriodSavingsReportRow[]> {
  const { data, error } = await admin
    .from("msgf_period_savings_reports")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("period_kind", kind)
    .order("period_key", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[period-savings-reports] list failed:", error.message);
    return [];
  }
  return (data ?? []).map((r) => mapDbRow(r as Record<string, unknown>));
}

/**
 * Bundle for UI: last 3 weekly reports + monthly history table rows.
 * Refreshes/logs current week + current month from live Redis counters.
 */
export async function getPeriodSavingsReportsBundle(params: {
  admin: SupabaseClient;
  tenantId: string;
  userId?: string | null;
  weeklyCount?: number;
  monthlyHistory?: number;
  persistCurrent?: boolean;
}): Promise<PeriodSavingsReportsBundle> {
  const tid = params.tenantId.trim();
  const weeklyCount = params.weeklyCount ?? 3;
  const monthlyHistory = params.monthlyHistory ?? 12;

  if (params.persistCurrent !== false) {
    await logCurrentPeriodReports({
      admin: params.admin,
      tenantId: tid,
      userId: params.userId,
    }).catch((e) => console.warn("[period-savings-reports] auto-log:", e));
  }

  const weekKeys = previousIsoWeekKeys(weeklyCount);
  const weeklyLive = await Promise.all(
    weekKeys.map((k) => readPeriodLiveCounters(tid, "weekly", k))
  );
  const weeklyLogged = await loadLoggedReports(params.admin, tid, "weekly", weeklyCount + 2);
  const loggedWeekMap = new Map(weeklyLogged.map((r) => [r.period_key, r]));

  const weekly: PeriodSavingsReportRow[] = weeklyLive.map((live) => {
    const draft = rowFromLive(tid, params.userId ?? null, live);
    const logged = loggedWeekMap.get(live.period_key);
    if (!logged) return draft;
    // Prefer higher of live vs logged so mid-week refresh stays current.
    return {
      ...logged,
      tokens_consumed_metered: Math.max(
        logged.tokens_consumed_metered,
        draft.tokens_consumed_metered
      ),
      tokens_saved_proven: Math.max(logged.tokens_saved_proven, draft.tokens_saved_proven),
      tokens_saved_estimated: Math.max(
        logged.tokens_saved_estimated,
        draft.tokens_saved_estimated
      ),
      provider_calls: Math.max(logged.provider_calls, draft.provider_calls),
      shadow_projected_usd: Math.max(
        logged.shadow_projected_usd,
        draft.shadow_projected_usd
      ),
      eco_metrics: calculateEcoSavings(
        Math.max(logged.tokens_saved_proven, draft.tokens_saved_proven)
      ),
      eco_claimable:
        Math.max(logged.tokens_saved_proven, draft.tokens_saved_proven) > 0,
      source: draft.tokens_consumed_metered > logged.tokens_consumed_metered ? "live" : "logged",
    };
  });

  const monthKeys = previousMonthKeys(monthlyHistory);
  const monthlyLive = await Promise.all(
    monthKeys.map((k) => readPeriodLiveCounters(tid, "monthly", k))
  );
  const monthlyLogged = await loadLoggedReports(params.admin, tid, "monthly", monthlyHistory + 2);
  const loggedMonthMap = new Map(monthlyLogged.map((r) => [r.period_key, r]));

  const monthly: PeriodSavingsReportRow[] = monthKeys.map((key, i) => {
    const live = monthlyLive[i]!;
    const draft = rowFromLive(tid, params.userId ?? null, live);
    const logged = loggedMonthMap.get(key);
    if (!logged) return draft;
    const proven = Math.max(logged.tokens_saved_proven, draft.tokens_saved_proven);
    return {
      ...logged,
      tokens_consumed_metered: Math.max(
        logged.tokens_consumed_metered,
        draft.tokens_consumed_metered
      ),
      tokens_saved_proven: proven,
      tokens_saved_estimated: Math.max(
        logged.tokens_saved_estimated,
        draft.tokens_saved_estimated
      ),
      provider_calls: Math.max(logged.provider_calls, draft.provider_calls),
      shadow_projected_usd: Math.max(
        logged.shadow_projected_usd,
        draft.shadow_projected_usd
      ),
      eco_metrics: calculateEcoSavings(proven),
      eco_claimable: proven > 0,
      source: draft.tokens_consumed_metered > logged.tokens_consumed_metered ? "live" : "logged",
    };
  });

  return {
    tenant_id: tid,
    weekly,
    monthly,
    disclaimer: PROVEN_ECO_DISCLAIMER,
  };
}
