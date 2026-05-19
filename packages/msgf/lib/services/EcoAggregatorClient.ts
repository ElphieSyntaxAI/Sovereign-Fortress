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
 * Distribution Build ID: MSGF-dde0b5b-20260519T185358Z-internal
 */
/**
 * B2B Sustainable Compute telemetry bridge.
 *
 * Host applications call `sendGlobalTelemetryPayload` after successful PERSIST.
 * The call is intentionally fire-and-forget: master telemetry must never slow,
 * fail, or block a tenant's local MSGF Pulse path.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { calculateEcoSavings, type EcoMetrics } from "@/lib/utils/ecoCalculator";

export type GlobalEcoTelemetryPayload = {
  tenant_id: string;
  tokens_saved: number;
  grid_compute_prevented_kwh: number;
  co2e_offset_lbs: number;
  freshwater_conserved_gallons: number;
  observed_at: string;
};

export type GlobalEcoRollupRow = {
  tenant_id: string;
  total_tokens_saved: number;
  total_grid_compute_prevented_kwh: number;
  total_co2e_offset_lbs: number;
  total_freshwater_conserved_gallons: number;
  last_observed_at: string;
  contribution_pct: number;
};

export type MasterEcoLeaderboard = {
  generated_at: string;
  source: "live" | "mock";
  totals: {
    energy_avoided_mwh: number;
    co2e_prevented_metric_tons: number;
    freshwater_saved_mgal: number;
  };
  tenants: GlobalEcoRollupRow[];
};

const POST_TIMEOUT_MS = 1200;
const LBS_PER_METRIC_TON = 2204.6226218;
const KWH_PER_MWH = 1000;
const GALLONS_PER_MGAL = 1_000_000;

const IncomingEcoPayloadSchema = z.object({
  tenant_id: z.string().min(1).max(160),
  tokens_saved: z.number().finite().nonnegative(),
  grid_compute_prevented_kwh: z.number().finite().nonnegative(),
  co2e_offset_lbs: z.number().finite().nonnegative(),
  freshwater_conserved_gallons: z.number().finite().nonnegative(),
  observed_at: z.string().datetime(),
});

export const MasterEcoPayloadBodySchema = z.object({
  tenant_id: z.string().min(1).max(160),
  tokens_saved: z.number().finite().nonnegative(),
  observed_at: z.string().datetime().optional(),
});

export type MasterEcoPayloadBody = z.infer<typeof MasterEcoPayloadBodySchema>;

type MutableRollup = Omit<GlobalEcoRollupRow, "contribution_pct">;

const mockRollups = new Map<string, MutableRollup>();

function roundMetric(value: number): number {
  return Number.parseFloat(value.toFixed(6));
}

function isoNow(): string {
  return new Date().toISOString();
}

function buildPayload(
  tenantId: string,
  tokensSaved: number,
  observedAt = isoNow()
): GlobalEcoTelemetryPayload {
  const eco = calculateEcoSavings(tokensSaved);
  return {
    tenant_id: tenantId.trim(),
    tokens_saved: eco.tokens_saved,
    grid_compute_prevented_kwh: eco.grid_compute_prevented_kwh,
    co2e_offset_lbs: eco.co2e_offset_lbs,
    freshwater_conserved_gallons: eco.freshwater_conserved_gallons,
    observed_at: observedAt,
  };
}

function seedMockRollups(): void {
  if (mockRollups.size > 0) return;
  for (const payload of [
    buildPayload("syntax-education", 1_880_000, new Date(Date.now() - 3600_000 * 3).toISOString()),
    buildPayload("author-ecosystem", 2_410_000, new Date(Date.now() - 3600_000 * 2).toISOString()),
    buildPayload("client-projects", 940_000, new Date(Date.now() - 3600_000).toISOString()),
  ]) {
    applyPayloadToMockRollups(payload);
  }
}

function applyPayloadToMockRollups(payload: GlobalEcoTelemetryPayload): GlobalEcoRollupRow {
  const prior = mockRollups.get(payload.tenant_id);
  const next: MutableRollup = {
    tenant_id: payload.tenant_id,
    total_tokens_saved: (prior?.total_tokens_saved ?? 0) + payload.tokens_saved,
    total_grid_compute_prevented_kwh: roundMetric(
      (prior?.total_grid_compute_prevented_kwh ?? 0) + payload.grid_compute_prevented_kwh
    ),
    total_co2e_offset_lbs: roundMetric(
      (prior?.total_co2e_offset_lbs ?? 0) + payload.co2e_offset_lbs
    ),
    total_freshwater_conserved_gallons: roundMetric(
      (prior?.total_freshwater_conserved_gallons ?? 0) + payload.freshwater_conserved_gallons
    ),
    last_observed_at: payload.observed_at,
  };
  mockRollups.set(payload.tenant_id, next);
  return { ...next, contribution_pct: 0 };
}

function withContribution(rows: MutableRollup[]): GlobalEcoRollupRow[] {
  const total = rows.reduce((sum, row) => sum + row.total_co2e_offset_lbs, 0);
  return rows
    .map((row) => ({
      ...row,
      contribution_pct: total > 0 ? roundMetric((row.total_co2e_offset_lbs / total) * 100) : 0,
    }))
    .sort((a, b) => b.total_co2e_offset_lbs - a.total_co2e_offset_lbs);
}

function buildLeaderboard(rows: GlobalEcoRollupRow[], source: "live" | "mock"): MasterEcoLeaderboard {
  const totals = rows.reduce(
    (acc, row) => ({
      energy_avoided_mwh: acc.energy_avoided_mwh + row.total_grid_compute_prevented_kwh / KWH_PER_MWH,
      co2e_prevented_metric_tons: acc.co2e_prevented_metric_tons + row.total_co2e_offset_lbs / LBS_PER_METRIC_TON,
      freshwater_saved_mgal:
        acc.freshwater_saved_mgal + row.total_freshwater_conserved_gallons / GALLONS_PER_MGAL,
    }),
    { energy_avoided_mwh: 0, co2e_prevented_metric_tons: 0, freshwater_saved_mgal: 0 }
  );

  return {
    generated_at: isoNow(),
    source,
    totals: {
      energy_avoided_mwh: roundMetric(totals.energy_avoided_mwh),
      co2e_prevented_metric_tons: roundMetric(totals.co2e_prevented_metric_tons),
      freshwater_saved_mgal: roundMetric(totals.freshwater_saved_mgal),
    },
    tenants: rows,
  };
}

export function validateMasterEcoBearer(
  authorizationHeader: string | null,
  configuredSecurityKey = process.env.MASTER_MSGF_SECURITY_KEY?.trim()
): boolean {
  if (!configuredSecurityKey) return true;
  const prefix = "Bearer ";
  if (!authorizationHeader?.startsWith(prefix)) return false;
  return authorizationHeader.slice(prefix.length).trim() === configuredSecurityKey;
}

export class EcoAggregatorClient {
  async sendGlobalTelemetryPayload(tenantId: string, tokensSaved: number): Promise<void> {
    let payload: GlobalEcoTelemetryPayload;
    try {
      payload = buildPayload(tenantId, tokensSaved);
    } catch (error) {
      console.warn("[EcoAggregatorClient] Invalid eco telemetry payload skipped.", {
        message: error instanceof Error ? error.message : "Unknown eco payload error",
      });
      return;
    }

    const baseUrl = process.env.MASTER_MSGF_ADMIN_URL?.trim();
    const securityKey = process.env.MASTER_MSGF_SECURITY_KEY?.trim();
    if (!baseUrl || !securityKey) {
      console.warn("[EcoAggregatorClient] Master eco telemetry env unmapped; host pulse continues.");
      return;
    }

    const endpoint = new URL("/api/msgf/master/eco-rollups", baseUrl).toString();
    void this.postTelemetry(endpoint, securityKey, payload);
  }

  async recordIncomingPayload(
    payloadBody: MasterEcoPayloadBody,
    supabase?: SupabaseClient
  ): Promise<GlobalEcoRollupRow> {
    const payload = IncomingEcoPayloadSchema.parse(
      buildPayload(payloadBody.tenant_id, payloadBody.tokens_saved, payloadBody.observed_at ?? isoNow())
    );

    if (!supabase) {
      return applyPayloadToMockRollups(payload);
    }

    const { data, error } = await supabase.rpc("msgf_master_increment_global_eco_rollup", {
      p_tenant_id: payload.tenant_id,
      p_tokens_saved: payload.tokens_saved,
      p_grid_compute_prevented_kwh: payload.grid_compute_prevented_kwh,
      p_co2e_offset_lbs: payload.co2e_offset_lbs,
      p_freshwater_conserved_gallons: payload.freshwater_conserved_gallons,
      p_observed_at: payload.observed_at,
    });

    if (error) {
      throw new Error(`global eco rollup increment failed: ${error.message}`);
    }

    const rows = Array.isArray(data) ? data : [data];
    const row = rows[0] as Partial<GlobalEcoRollupRow> | null | undefined;
    if (!row?.tenant_id) {
      throw new Error("global eco rollup increment returned no row.");
    }

    return {
      tenant_id: String(row.tenant_id),
      total_tokens_saved: Number(row.total_tokens_saved ?? 0),
      total_grid_compute_prevented_kwh: Number(row.total_grid_compute_prevented_kwh ?? 0),
      total_co2e_offset_lbs: Number(row.total_co2e_offset_lbs ?? 0),
      total_freshwater_conserved_gallons: Number(row.total_freshwater_conserved_gallons ?? 0),
      last_observed_at: String(row.last_observed_at ?? payload.observed_at),
      contribution_pct: 0,
    };
  }

  async getLeaderboard(supabase?: SupabaseClient): Promise<MasterEcoLeaderboard> {
    if (!supabase) {
      seedMockRollups();
      return buildLeaderboard(withContribution([...mockRollups.values()]), "mock");
    }

    const { data, error } = await supabase
      .schema("msgf_master")
      .from("global_eco_rollups")
      .select(
        "tenant_id,total_tokens_saved,total_grid_compute_prevented_kwh,total_co2e_offset_lbs,total_freshwater_conserved_gallons,last_observed_at"
      )
      .order("total_co2e_offset_lbs", { ascending: false })
      .limit(100);

    if (error) {
      throw new Error(`global eco leaderboard query failed: ${error.message}`);
    }

    const rows = ((data ?? []) as MutableRollup[]).map((row) => ({
      tenant_id: String(row.tenant_id),
      total_tokens_saved: Number(row.total_tokens_saved),
      total_grid_compute_prevented_kwh: Number(row.total_grid_compute_prevented_kwh),
      total_co2e_offset_lbs: Number(row.total_co2e_offset_lbs),
      total_freshwater_conserved_gallons: Number(row.total_freshwater_conserved_gallons),
      last_observed_at: String(row.last_observed_at),
    }));

    return buildLeaderboard(withContribution(rows), "live");
  }

  private async postTelemetry(
    endpoint: string,
    securityKey: string,
    payload: GlobalEcoTelemetryPayload
  ): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), POST_TIMEOUT_MS);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${securityKey}`,
        },
        body: JSON.stringify({
          tenant_id: payload.tenant_id,
          tokens_saved: payload.tokens_saved,
          observed_at: payload.observed_at,
        }),
      });
      if (!response.ok) {
        console.warn("[EcoAggregatorClient] Master telemetry POST rejected.", {
          status: response.status,
        });
      }
    } catch (error) {
      console.warn("[EcoAggregatorClient] Master telemetry POST failed quietly.", {
        message: error instanceof Error ? error.message : "Unknown network error",
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const ecoAggregatorClient = new EcoAggregatorClient();
