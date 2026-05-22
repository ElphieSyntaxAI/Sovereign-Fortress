/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 */

import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  healthOptionsForSessionOperator,
  resolveSessionDashboardOperator,
} from "@/lib/msgf-admin-session";
import type { HealthServiceOptions } from "@/lib/services/HealthService";
import { listUserProjects } from "@/lib/services/user-projects";

export type DashboardHealthScopeMode = "personal" | "operator";

export function parseDashboardHealthScope(
  raw: string | null | undefined
): DashboardHealthScopeMode {
  const s = raw?.trim().toLowerCase();
  return s === "operator" || s === "admin" || s === "team" ? "operator" : "personal";
}

/** Tenant `/dashboard` — always the signed-in user's stats, never global/company rollup. */
export function personalHealthOptionsForUser(
  userId: string,
  lookbackHours: number,
  projectOrigins?: string[]
): HealthServiceOptions {
  const origins = projectOrigins?.map((o) => o.trim()).filter(Boolean);
  return {
    userId,
    lookbackHours,
    dashboardView: "tenant_health",
    ...(origins && origins.length > 0 ? { projectOrigins: origins } : {}),
  };
}

export async function resolveHealthOptionsForDashboardRequest(
  admin: SupabaseClient,
  user: User,
  params: { lookbackHours: number; scope: DashboardHealthScopeMode }
): Promise<HealthServiceOptions> {
  if (params.scope === "personal") {
    const projects = await listUserProjects(admin, user.id).catch(() => []);
    const origins = projects.map((p) => p.project_origin);
    return personalHealthOptionsForUser(user.id, params.lookbackHours, origins);
  }

  const op = await resolveSessionDashboardOperator(admin, user);
  return healthOptionsForSessionOperator(admin, op, params.lookbackHours);
}

export function healthPillarsQuery(scope: DashboardHealthScopeMode, lookbackHours = 168): string {
  const params = new URLSearchParams({
    lookback_hours: String(lookbackHours),
    scope,
  });
  return `/api/msgf/health/pillars?${params.toString()}`;
}
