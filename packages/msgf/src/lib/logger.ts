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
 * Distribution Build ID: MSGF-7175065-20260515T200509Z-internal
 */
import { createAdminClient } from "@/utils/supabase/admin";

import { tenantIdForNarrativeLog } from "@msgf/lib/tenant-ids";

export type MsgfLogMetadata = Record<string, unknown>;

// Temporary toggle for upstream outage: set `true` here, or `MSGF_LOGGER_OFFLINE=1` in env (no redeploy).
const IS_OFFLINE_MODE =
  false ||
  process.env.MSGF_LOGGER_OFFLINE === "1" ||
  process.env.MSGF_LOGGER_OFFLINE === "true";

/** Server-only: uses the Supabase service role (never import in client components). */
export const msgfLogger = {
  async log(
    severity: "Info" | "Warning" | "Violation",
    tenantId: string,
    message: string,
    actorId?: string,
    metadata: MsgfLogMetadata = {}
  ) {
    if (IS_OFFLINE_MODE) {
      console.log("🛠 [OFFLINE MODE] Log saved to console instead of DB:", {
        severity,
        message,
        tenantId,
        actorId,
        metadata,
      });
      return { data: null, error: null };
    }

    const admin = createAdminClient();
    return await admin.from("p4_narrative_logs").insert({
      tenant_id: tenantIdForNarrativeLog(tenantId),
      actor_id: actorId,
      action_type: severity.toUpperCase(),
      message,
      severity,
      metadata,
    });
  },

  async info(tenantId: string, message: string, actorId?: string, metadata: MsgfLogMetadata = {}) {
    return this.log("Info", tenantId, message, actorId, metadata);
  },

  async violation(tenantId: string, message: string, actorId?: string, metadata: MsgfLogMetadata = {}) {
    return this.log("Violation", tenantId, message, actorId, metadata);
  },
};

export function logViolation(
  tenantId: string,
  message: string,
  actorId?: string,
  metadata: MsgfLogMetadata = {}
) {
  return msgfLogger.violation(tenantId, message, actorId, metadata);
}

export function logInfo(tenantId: string, message: string, actorId?: string, metadata: MsgfLogMetadata = {}) {
  return msgfLogger.info(tenantId, message, actorId, metadata);
}
