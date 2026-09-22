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
import type { SupabaseClient } from "@supabase/supabase-js";

import { ecoAggregatorClient } from "@/lib/services/EcoAggregatorClient";
import { getPublicEcoMetrics } from "@/lib/services/public-eco-metrics";
import { listUserProjects, type UserProjectRow } from "@/lib/services/user-projects";
import { calculateEcoSavings, type EcoMetrics } from "@/lib/utils/ecoCalculator";
import { buildEcoEquivalencyStatements } from "@/lib/utils/ecoEquivalencies";

export type UserProjectEcoRow = {
  project_origin: string;
  display_name: string;
  source_type: "local" | "github";
  metrics: EcoMetrics;
  contribution_pct: number;
  last_observed_at: string | null;
};

export type MyEcoUsageResponse = {
  ok: true;
  source: "live" | "mock" | "empty";
  generated_at: string;
  global: {
    metrics: EcoMetrics;
    equivalencies: ReturnType<typeof buildEcoEquivalencyStatements>;
  };
  user_total: {
    metrics: EcoMetrics;
    equivalencies: ReturnType<typeof buildEcoEquivalencyStatements>;
    contribution_to_global_pct: number;
  };
  projects: UserProjectEcoRow[];
  mapped_projects: UserProjectRow[];
};

type UserProjectEcoRollupDbRow = {
  user_id: string;
  project_origin: string;
  total_tokens_saved: number;
  total_grid_compute_prevented_kwh: number;
  total_co2e_offset_lbs: number;
  total_freshwater_conserved_gallons: number;
  last_observed_at: string;
};

function sumEcoMetrics(rows: EcoMetrics[]): EcoMetrics {
  const totals = rows.reduce(
    (acc, row) => ({
      tokens_saved: acc.tokens_saved + row.tokens_saved,
      grid_compute_prevented_kwh: acc.grid_compute_prevented_kwh + row.grid_compute_prevented_kwh,
      co2e_offset_lbs: acc.co2e_offset_lbs + row.co2e_offset_lbs,
      freshwater_conserved_gallons:
        acc.freshwater_conserved_gallons + row.freshwater_conserved_gallons,
    }),
    {
      tokens_saved: 0,
      grid_compute_prevented_kwh: 0,
      co2e_offset_lbs: 0,
      freshwater_conserved_gallons: 0,
    }
  );

  return {
    tokens_saved: Math.floor(totals.tokens_saved),
    grid_compute_prevented_kwh: Number.parseFloat(totals.grid_compute_prevented_kwh.toFixed(4)),
    co2e_offset_lbs: Number.parseFloat(totals.co2e_offset_lbs.toFixed(4)),
    freshwater_conserved_gallons: Number.parseFloat(
      totals.freshwater_conserved_gallons.toFixed(4)
    ),
  };
}

function dbRowToMetrics(row: UserProjectEcoRollupDbRow): EcoMetrics {
  return {
    tokens_saved: Math.floor(Number(row.total_tokens_saved ?? 0)),
    grid_compute_prevented_kwh: Number.parseFloat(
      Number(row.total_grid_compute_prevented_kwh ?? 0).toFixed(4)
    ),
    co2e_offset_lbs: Number.parseFloat(Number(row.total_co2e_offset_lbs ?? 0).toFixed(4)),
    freshwater_conserved_gallons: Number.parseFloat(
      Number(row.total_freshwater_conserved_gallons ?? 0).toFixed(4)
    ),
  };
}

async function loadUserProjectRollups(
  admin: SupabaseClient,
  userId: string
): Promise<UserProjectEcoRollupDbRow[]> {
  const { data, error } = await admin
    .schema("msgf_master")
    .from("user_project_eco_rollups")
    .select(
      "user_id,project_origin,total_tokens_saved,total_grid_compute_prevented_kwh,total_co2e_offset_lbs,total_freshwater_conserved_gallons,last_observed_at"
    )
    .eq("user_id", userId);

  if (error) {
    throw new Error(`user project eco rollup query failed: ${error.message}`);
  }

  return (data ?? []) as UserProjectEcoRollupDbRow[];
}

export async function getMyEcoUsage(
  admin: SupabaseClient,
  userId: string
): Promise<MyEcoUsageResponse> {
  const [globalPayload, mappedProjects, rollupRows] = await Promise.all([
    getPublicEcoMetrics(admin),
    listUserProjects(admin, userId).catch(() => [] as UserProjectRow[]),
    loadUserProjectRollups(admin, userId).catch(() => [] as UserProjectEcoRollupDbRow[]),
  ]);

  const globalMetrics = globalPayload.metrics;
  const rollupByOrigin = new Map(
    rollupRows.map((row) => [row.project_origin, row] as const)
  );

  const mappedOrigins = new Set(mappedProjects.map((p) => p.project_origin));
  const projectRows: UserProjectEcoRow[] = [];

  for (const project of mappedProjects) {
    const rollup = rollupByOrigin.get(project.project_origin);
    const metrics = rollup
      ? dbRowToMetrics(rollup)
      : calculateEcoSavings(0);
    projectRows.push({
      project_origin: project.project_origin,
      display_name: project.display_name,
      source_type: project.source_type,
      metrics,
      contribution_pct: 0,
      last_observed_at: rollup?.last_observed_at ?? null,
    });
  }

  for (const rollup of rollupRows) {
    if (mappedOrigins.has(rollup.project_origin)) continue;
    const metrics = dbRowToMetrics(rollup);
    projectRows.push({
      project_origin: rollup.project_origin,
      display_name: rollup.project_origin,
      source_type: "local",
      metrics,
      contribution_pct: 0,
      last_observed_at: rollup.last_observed_at,
    });
  }

  const userMetrics = sumEcoMetrics(projectRows.map((p) => p.metrics));
  const userCo2 = userMetrics.co2e_offset_lbs;
  const globalCo2 = globalMetrics.co2e_offset_lbs;
  const contributionPct =
    globalCo2 > 0 ? Number.parseFloat(((userCo2 / globalCo2) * 100).toFixed(4)) : 0;

  const withContribution = projectRows.map((row) => ({
    ...row,
    contribution_pct:
      userCo2 > 0
        ? Number.parseFloat(((row.metrics.co2e_offset_lbs / userCo2) * 100).toFixed(2))
        : 0,
  }));

  return {
    ok: true,
    source: globalPayload.source,
    generated_at: new Date().toISOString(),
    global: {
      metrics: globalMetrics,
      equivalencies: globalPayload.equivalencies,
    },
    user_total: {
      metrics: userMetrics,
      equivalencies: buildEcoEquivalencyStatements(userMetrics),
      contribution_to_global_pct: contributionPct,
    },
    projects: withContribution.sort(
      (a, b) => b.metrics.co2e_offset_lbs - a.metrics.co2e_offset_lbs
    ),
    mapped_projects: mappedProjects,
  };
}
