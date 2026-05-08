import type { PrimeEvent } from "@elphie-syntax/core";

import { createAdminClient } from "@/utils/supabase/admin";

export type NarrativeSeverity = "Info" | "Warning" | "Violation";

function buildMetadata(
  context: PrimeEvent,
  severity: NarrativeSeverity
): Record<string, unknown> {
  const base =
    context.breadcrumb_metadata &&
    typeof context.breadcrumb_metadata === "object" &&
    !Array.isArray(context.breadcrumb_metadata)
      ? { ...(context.breadcrumb_metadata as Record<string, unknown>) }
      : {};
  return { ...base, narrative_severity: severity };
}

/**
 * Logs a POV-tagged narrative line (RAG-style prefix) and mirrors it to
 * `p4_narrative_logs` for a durable, filterable system story.
 *
 * Intended for **server** contexts only (API routes, server actions, jobs):
 * uses the Supabase service role via `createAdminClient`.
 */
export async function logNarrative(
  context: PrimeEvent,
  message: string,
  severity: NarrativeSeverity
): Promise<void> {
  const line = `[POV: ${context.tenant_id}][${context.action_type}] - ${message}`;
  console.log(line);

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("p4_narrative_logs").insert({
      tenant_id: context.tenant_id,
      actor_id: context.actor_id,
      action_type: context.action_type,
      message,
      metadata: buildMetadata(context, severity),
      is_violation: severity === "Violation",
    });
    if (error) {
      console.error("[POV:mirror] p4_narrative_logs insert failed:", error.message);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[POV:mirror] p4_narrative_logs insert failed:", msg);
  }
}
