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
 * Distribution Build ID: MSGF-08289e1a-20260923T172846Z-internal
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
 * When MSGF_REQUIRE_DIFF_IMPACT=1, also refuse deploy if latest hub diff_impact is red.
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

  const verifyDecision = evaluateDeployGateFromVerify({
    projectOrigin,
    passed,
    createdAt: (data?.created_at as string | undefined) ?? null,
    narrativeLogId: (data?.id as string | undefined) ?? null,
    maxAgeHours: params.maxAgeHours,
  });

  if (!verifyDecision.ok) return verifyDecision;

  const requireDiff =
    process.env.MSGF_REQUIRE_DIFF_IMPACT?.trim() === "1" ||
    process.env.MSGF_REQUIRE_DIFF_IMPACT?.trim()?.toLowerCase() === "true";

  if (!requireDiff) return verifyDecision;

  const { data: impactRow } = await admin
    .from("platform_audit_events")
    .select("id, summary, metadata, created_at")
    .eq("kind", "diff_impact")
    .eq("tenant_id", projectOrigin)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const impactMeta = (impactRow?.metadata ?? {}) as Record<string, unknown>;
  const score =
    typeof impactMeta.score === "string" ? impactMeta.score.toLowerCase() : "";

  if (!impactRow) {
    return {
      ...verifyDecision,
      ok: false,
      status: "missing",
      message:
        "MSGF_REQUIRE_DIFF_IMPACT=1: no diff-impact report found for this project_origin. Run POST /api/msgf/diff-impact before deploy.",
    };
  }

  if (score === "red") {
    return {
      ...verifyDecision,
      ok: false,
      status: "red",
      message: `Diff impact is red — ${
        typeof impactRow.summary === "string"
          ? impactRow.summary
          : "acknowledge / re-scan before Starport deploy"
      }.`,
    };
  }

  return verifyDecision;
}
