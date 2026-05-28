/**
 * POST verify-result — audit log after local or cloud heal verification.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { VerifyResultBody } from "@/lib/schemas/verify-result";

export type VerifyResultPersisted = {
  ok: true;
  narrative_log_id: string | null;
  severity: "Info" | "Warning" | "Violation";
};

export async function persistVerifyResult(
  admin: SupabaseClient,
  body: VerifyResultBody
): Promise<VerifyResultPersisted> {
  const severity = body.passed ? "Info" : "Warning";
  const message = body.passed
    ? `Verify passed${body.command ? `: ${body.command}` : ""}`
    : `Verify failed${body.command ? `: ${body.command}` : ""}${
        body.exit_code != null ? ` (exit ${body.exit_code})` : ""
      }`;

  const metadata: Record<string, unknown> = {
    pillar: "P4",
    pulse_engine: false,
    verify_result: true,
    passed: body.passed,
    command: body.command ?? null,
    exit_code: body.exit_code ?? null,
    file_paths: body.file_paths ?? [],
    dev_heal_choice: body.dev_heal_choice ?? null,
    incident_id: body.incident_id ?? null,
    product_surface: body.product_surface ?? "ide",
    stdout_snippet: body.stdout_snippet?.slice(0, 2000) ?? null,
    stderr_snippet: body.stderr_snippet?.slice(0, 2000) ?? null,
    bug_index: {
      level_1_category: "1.0_PULSE",
      level_1_1_branch: "1.1_INGEST",
      level_1_1_1_instance: "1.1.1_VERIFY_RESULT",
    },
  };

  const { data, error } = await admin
    .from("p4_narrative_logs")
    .insert({
      tenant_id: body.tenant_id,
      actor_id: body.actor_id ?? null,
      action_type: "VERIFY_RESULT",
      message,
      severity,
      metadata,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[verify-result] narrative insert failed", error.message);
    return { ok: true, narrative_log_id: null, severity };
  }

  return {
    ok: true,
    narrative_log_id: typeof data?.id === "string" ? data.id : null,
    severity,
  };
}
