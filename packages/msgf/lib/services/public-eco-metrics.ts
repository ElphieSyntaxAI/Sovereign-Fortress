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
 * Distribution Build ID: MSGF-1013d7a-20260522T022234Z-internal
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { ecoAggregatorClient } from "@/lib/services/EcoAggregatorClient";
import { calculateEcoSavings, type EcoMetrics } from "@/lib/utils/ecoCalculator";
import {
  buildEcoEquivalencyStatements,
  type EcoEquivalencyStatements,
} from "@/lib/utils/ecoEquivalencies";

export type PublicEcoMetricsResponse = {
  ok: true;
  source: "live" | "mock";
  generated_at: string;
  metrics: EcoMetrics;
  equivalencies: EcoEquivalencyStatements;
};

export const PUBLIC_ECO_CACHE_CONTROL =
  "public, max-age=300, s-maxage=300, stale-while-revalidate=300";

export function hasPublicEcoDatabaseEnv(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return Boolean(url && key);
}

export async function getPublicEcoMetrics(
  supabase?: SupabaseClient
): Promise<PublicEcoMetricsResponse> {
  try {
    const leaderboard = await ecoAggregatorClient.getLeaderboard(supabase);
    const totals = leaderboard.tenants.reduce(
      (acc, tenant) => ({
        tokens_saved: acc.tokens_saved + tenant.total_tokens_saved,
        grid_compute_prevented_kwh:
          acc.grid_compute_prevented_kwh + tenant.total_grid_compute_prevented_kwh,
        co2e_offset_lbs: acc.co2e_offset_lbs + tenant.total_co2e_offset_lbs,
        freshwater_conserved_gallons:
          acc.freshwater_conserved_gallons + tenant.total_freshwater_conserved_gallons,
      }),
      {
        tokens_saved: 0,
        grid_compute_prevented_kwh: 0,
        co2e_offset_lbs: 0,
        freshwater_conserved_gallons: 0,
      }
    );

    const metrics: EcoMetrics = {
      tokens_saved: Math.floor(totals.tokens_saved),
      grid_compute_prevented_kwh: Number.parseFloat(
        totals.grid_compute_prevented_kwh.toFixed(4)
      ),
      co2e_offset_lbs: Number.parseFloat(totals.co2e_offset_lbs.toFixed(4)),
      freshwater_conserved_gallons: Number.parseFloat(
        totals.freshwater_conserved_gallons.toFixed(4)
      ),
    };

    return {
      ok: true,
      source: leaderboard.source,
      generated_at: leaderboard.generated_at,
      metrics,
      equivalencies: buildEcoEquivalencyStatements(metrics),
    };
  } catch (error) {
    console.warn("[public-eco-metrics] live read failed; returning mock metrics.", {
      message: error instanceof Error ? error.message : "Unknown eco metrics error",
    });
    const metrics = calculateEcoSavings(5_230_000);
    return {
      ok: true,
      source: "mock",
      generated_at: new Date().toISOString(),
      metrics,
      equivalencies: buildEcoEquivalencyStatements(metrics),
    };
  }
}
