/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * Deploy gate — last VERIFY_RESULT for a project_origin / tenant_id (Starport story).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type DeployGateStatus = "green" | "red" | "missing" | "stale";

export type DeployGateDecision = {
  ok: boolean;
  status: DeployGateStatus;
  project_origin: string;
  last_verify_at: string | null;
  passed: boolean | null;
  narrative_log_id: string | null;
  message: string;
  max_age_hours: number;
};

export function defaultDeployGateMaxAgeHours(
  env: NodeJS.ProcessEnv = process.env
): number {
  const raw = env.MSGF_DEPLOY_GATE_MAX_AGE_HOURS?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 72;
  return Number.isFinite(n) && n > 0 ? Math.min(n, 24 * 30) : 72;
}

/**
 * Pure decision from a stored verify row (unit-testable).
 */
export function evaluateDeployGateFromVerify(params: {
  projectOrigin: string;
  passed: boolean | null;
  createdAt: string | null;
  narrativeLogId?: string | null;
  maxAgeHours?: number;
  nowMs?: number;
}): DeployGateDecision {
  const maxAgeHours = params.maxAgeHours ?? defaultDeployGateMaxAgeHours();
  const project_origin = params.projectOrigin.trim();
  const base = {
    project_origin,
    max_age_hours: maxAgeHours,
    narrative_log_id: params.narrativeLogId ?? null,
  };

  if (params.passed == null || !params.createdAt) {
    return {
      ...base,
      ok: false,
      status: "missing",
      last_verify_at: params.createdAt,
      passed: params.passed,
      message:
        "No VERIFY_RESULT found for this project_origin. Run Safe Build / verify-result before deploy.",
    };
  }

  const createdMs = Date.parse(params.createdAt);
  const now = params.nowMs ?? Date.now();
  if (!Number.isFinite(createdMs)) {
    return {
      ...base,
      ok: false,
      status: "missing",
      last_verify_at: params.createdAt,
      passed: params.passed,
      message: "Last verify timestamp is invalid.",
    };
  }

  const ageHours = (now - createdMs) / (1000 * 60 * 60);
  if (ageHours > maxAgeHours) {
    return {
      ...base,
      ok: false,
      status: "stale",
      last_verify_at: params.createdAt,
      passed: params.passed,
      message: `Last verify is older than ${maxAgeHours}h — re-run Safe Build before deploy.`,
    };
  }

  if (!params.passed) {
    return {
      ...base,
      ok: false,
      status: "red",
      last_verify_at: params.createdAt,
      passed: false,
      message: "Last verify failed (red). Heal / re-verify before Starport deploy.",
    };
  }

  return {
    ...base,
    ok: true,
    status: "green",
    last_verify_at: params.createdAt,
    passed: true,
    message: "Last verify passed within the deploy gate window.",
  };
}

/**
 * Load latest VERIFY_RESULT for tenant_id (= project_origin / IDE tenantKey).
 */
export async function resolveDeployGate(
  admin: SupabaseClient,
  params: {
    projectOrigin: string;
    maxAgeHours?: number;
  }
): Promise<DeployGateDecision> {
  const projectOrigin = params.projectOrigin.trim();
  if (!projectOrigin) {
    return evaluateDeployGateFromVerify({
      projectOrigin: "",
      passed: null,
      createdAt: null,
      maxAgeHours: params.maxAgeHours,
    });
  }

  const { data, error } = await admin
    .from("p4_narrative_logs")
    .select("id, created_at, metadata")
    .eq("action_type", "VERIFY_RESULT")
    .eq("tenant_id", projectOrigin)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[deploy-gate] lookup failed:", error.message);
    return {
      ok: false,
      status: "missing",
      project_origin: projectOrigin,
      last_verify_at: null,
      passed: null,
      narrative_log_id: null,
      message: `Deploy gate lookup failed: ${error.message}`,
      max_age_hours: params.maxAgeHours ?? defaultDeployGateMaxAgeHours(),
    };
  }

  const md = (data?.metadata ?? {}) as Record<string, unknown>;
  const passed = typeof md.passed === "boolean" ? md.passed : null;

  return evaluateDeployGateFromVerify({
    projectOrigin,
    passed,
    createdAt: (data?.created_at as string | undefined) ?? null,
    narrativeLogId: (data?.id as string | undefined) ?? null,
    maxAgeHours: params.maxAgeHours,
  });
}
