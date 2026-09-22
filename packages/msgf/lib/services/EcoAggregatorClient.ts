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
 * B2B Sustainable Compute telemetry bridge.
 *
 * Host applications call `sendGlobalTelemetryPayload` after successful PERSIST.
 * The call is intentionally fire-and-forget: master telemetry must never slow,
 * fail, or block a tenant's local MSGF Pulse path.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { allowMockTelemetry } from "@/lib/deploy-env";
import { calculateEcoSavings, type EcoMetrics } from "@/lib/utils/ecoCalculator";

/** Default ON — public eco claims require proven evidence. */
export function isEcoProvenOnlyEnabled(): boolean {
  const v = process.env.MSGF_ECO_PROVEN_ONLY?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no") return false;
  return true;
}

export type GlobalEcoTelemetryPayload = {
  tenant_id: string;
  tokens_saved: number;
  grid_compute_prevented_kwh: number;
  co2e_offset_lbs: number;
  freshwater_conserved_gallons: number;
  observed_at: string;
  evidence?: "proven_avoidance" | "pack_delta" | "estimated_model";
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
  user_id: z.string().uuid().optional(),
  project_origin: z.string().min(1).max(256).optional(),
});

export type MasterEcoPayloadBody = z.infer<typeof MasterEcoPayloadBodySchema>;

export type EcoTelemetryContext = {
  userId?: string;
  projectOrigin?: string;
  evidence?: "proven_avoidance" | "pack_delta" | "estimated_model";
  reason?: string;
};

type MutableRollup = Omit<GlobalEcoRollupRow, "contribution_pct">;

type MutableUserProjectRollup = {
  user_id: string;
  project_origin: string;
  total_tokens_saved: number;
  total_grid_compute_prevented_kwh: number;
  total_co2e_offset_lbs: number;
  total_freshwater_conserved_gallons: number;
  last_observed_at: string;
};

const mockRollups = new Map<string, MutableRollup>();
const mockUserProjectRollups = new Map<string, MutableUserProjectRollup>();

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

function userProjectMockKey(userId: string, projectOrigin: string): string {
  return `${userId}::${projectOrigin}`;
}

function applyPayloadToMockUserProjectRollups(
  userId: string,
  projectOrigin: string,
  payload: GlobalEcoTelemetryPayload
): void {
  const key = userProjectMockKey(userId, projectOrigin);
  const prior = mockUserProjectRollups.get(key);
  mockUserProjectRollups.set(key, {
    user_id: userId,
    project_origin: projectOrigin,
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
  });
}

function isUuidString(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

export class EcoAggregatorClient {
  /**
   * Legacy entry — blocked by default when MSGF_ECO_PROVEN_ONLY=1 unless
   * context.evidence is proven_avoidance or pack_delta.
   */
  async sendGlobalTelemetryPayload(
    tenantId: string,
    tokensSaved: number,
    context?: EcoTelemetryContext
  ): Promise<void> {
    const evidence = context?.evidence ?? "estimated_model";
    if (
      isEcoProvenOnlyEnabled() &&
      evidence !== "proven_avoidance" &&
      evidence !== "pack_delta"
    ) {
      console.warn(
        "[EcoAggregatorClient] Skipped estimated eco telemetry (MSGF_ECO_PROVEN_ONLY). Use sendProvenEcoTelemetry.",
        { reason: context?.reason ?? null, tokensSaved }
      );
      return;
    }
    await this.dispatchEcoPayload(tenantId, tokensSaved, context, evidence);
  }

  /** Only path that should grow public Sustainable Compute totals. */
  async sendProvenEcoTelemetry(
    tenantId: string,
    tokensSaved: number,
    context?: EcoTelemetryContext & {
      evidence: "proven_avoidance" | "pack_delta";
    }
  ): Promise<void> {
    const evidence = context?.evidence ?? "proven_avoidance";
    await this.dispatchEcoPayload(tenantId, tokensSaved, context, evidence);
  }

  private async dispatchEcoPayload(
    tenantId: string,
    tokensSaved: number,
    context: EcoTelemetryContext | undefined,
    evidence: "proven_avoidance" | "pack_delta" | "estimated_model"
  ): Promise<void> {
    let payload: GlobalEcoTelemetryPayload;
    try {
      payload = { ...buildPayload(tenantId, tokensSaved), evidence };
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
    const scopedContext =
      context?.userId &&
      isUuidString(context.userId) &&
      context.projectOrigin?.trim()
        ? { userId: context.userId.trim(), projectOrigin: context.projectOrigin.trim() }
        : undefined;
    void this.postTelemetry(endpoint, securityKey, payload, scopedContext);
  }

  async recordIncomingPayload(
    payloadBody: MasterEcoPayloadBody,
    supabase?: SupabaseClient
  ): Promise<GlobalEcoRollupRow> {
    const payload = IncomingEcoPayloadSchema.parse(
      buildPayload(payloadBody.tenant_id, payloadBody.tokens_saved, payloadBody.observed_at ?? isoNow())
    );

    const userId = payloadBody.user_id?.trim();
    const projectOrigin = payloadBody.project_origin?.trim();

    if (!supabase) {
      if (!allowMockTelemetry()) {
        throw new Error("global eco rollup requires a live database in production.");
      }
      if (userId && projectOrigin) {
        applyPayloadToMockUserProjectRollups(userId, projectOrigin, payload);
      }
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

    if (userId && projectOrigin) {
      const { error: userProjectError } = await supabase.rpc(
        "msgf_master_increment_user_project_eco_rollup",
        {
          p_user_id: userId,
          p_project_origin: projectOrigin,
          p_tokens_saved: payload.tokens_saved,
          p_grid_compute_prevented_kwh: payload.grid_compute_prevented_kwh,
          p_co2e_offset_lbs: payload.co2e_offset_lbs,
          p_freshwater_conserved_gallons: payload.freshwater_conserved_gallons,
          p_observed_at: payload.observed_at,
        }
      );
      if (userProjectError) {
        console.warn("[EcoAggregatorClient] user project eco rollup increment failed.", {
          message: userProjectError.message,
        });
      }
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
      if (!allowMockTelemetry()) {
        return buildLeaderboard([], "live");
      }
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
    payload: GlobalEcoTelemetryPayload,
    context?: EcoTelemetryContext
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
          ...(context?.userId ? { user_id: context.userId } : {}),
          ...(context?.projectOrigin ? { project_origin: context.projectOrigin } : {}),
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
