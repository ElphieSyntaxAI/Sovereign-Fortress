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
 * Distribution Build ID: MSGF-e3b90d5-20260522T030006Z-internal
 */
import { createAdminClient } from "@/utils/supabase/admin";
import { getPulseTraceContext } from "@/lib/runtime/pulse-trace-context";

import { tenantIdForNarrativeLog } from "@msgf/lib/tenant-ids";

export type MsgfLogMetadata = Record<string, unknown>;

// Temporary toggle for upstream outage: set `true` here, or `MSGF_LOGGER_OFFLINE=1` in env (no redeploy).
const IS_OFFLINE_MODE =
  false ||
  process.env.MSGF_LOGGER_OFFLINE === "1" ||
  process.env.MSGF_LOGGER_OFFLINE === "true";

const IS_PRODUCTION_JSON_LOGS = process.env.NODE_ENV === "production";

type GcpLogSeverity = "DEBUG" | "INFO" | "NOTICE" | "WARNING" | "ERROR" | "CRITICAL";

function toGcpSeverity(severity: "Info" | "Warning" | "Violation"): GcpLogSeverity {
  switch (severity) {
    case "Info":
      return "INFO";
    case "Warning":
      return "WARNING";
    case "Violation":
      return "ERROR";
    default:
      return "INFO";
  }
}

function gcpTraceResource(gcpTraceHeader: string | undefined): string | undefined {
  const project =
    process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
    process.env.GCP_PROJECT?.trim() ||
    process.env.GCLOUD_PROJECT?.trim();
  const traceId = gcpTraceHeader?.split("/")?.[0]?.trim();
  if (!project || !traceId) return undefined;
  return `projects/${project}/traces/${traceId}`;
}

function emitProductionJsonLog(params: {
  gcpSeverity: GcpLogSeverity;
  message: string;
  tenantId: string;
  actorId?: string;
  msgfActionType: string;
  metadata: MsgfLogMetadata;
  trace?: { traceId: string; gcpTraceHeader?: string };
}): void {
  const payload: Record<string, unknown> = {
    severity: params.gcpSeverity,
    message: params.message,
    tenantId: params.tenantId,
    component: "msgf",
    msgfActionType: params.msgfActionType,
    metadata: params.metadata,
  };
  if (params.actorId) {
    payload.actorId = params.actorId;
  }
  if (params.trace?.traceId) {
    payload.traceId = params.trace.traceId;
  }
  const traceResource = gcpTraceResource(params.trace?.gcpTraceHeader);
  if (traceResource) {
    payload["logging.googleapis.com/trace"] = traceResource;
  }
  console.log(JSON.stringify(payload));
}

function enrichMetadataWithTrace(metadata: MsgfLogMetadata): MsgfLogMetadata {
  const trace = getPulseTraceContext();
  if (!trace?.traceId) {
    return metadata;
  }
  return { ...metadata, pulse_trace_id: trace.traceId };
}

/** Server-only: uses the Supabase service role (never import in client components). */
export const msgfLogger = {
  async log(
    severity: "Info" | "Warning" | "Violation",
    tenantId: string,
    message: string,
    actorId?: string,
    metadata: MsgfLogMetadata = {}
  ) {
    const siloTenantId = tenantIdForNarrativeLog(tenantId);
    const mergedMeta = enrichMetadataWithTrace(metadata);
    const trace = getPulseTraceContext();

    if (IS_OFFLINE_MODE) {
      if (IS_PRODUCTION_JSON_LOGS) {
        emitProductionJsonLog({
          gcpSeverity: toGcpSeverity(severity),
          message: `[OFFLINE] ${message}`,
          tenantId: siloTenantId,
          actorId,
          msgfActionType: severity.toUpperCase(),
          metadata: mergedMeta,
          trace,
        });
      } else {
        console.log("🛠 [OFFLINE MODE] Log saved to console instead of DB:", {
          severity,
          message,
          tenantId: siloTenantId,
          actorId,
          metadata: mergedMeta,
        });
      }
      return { data: null, error: null };
    }

    if (IS_PRODUCTION_JSON_LOGS) {
      emitProductionJsonLog({
        gcpSeverity: toGcpSeverity(severity),
        message,
        tenantId: siloTenantId,
        actorId,
        msgfActionType: severity.toUpperCase(),
        metadata: mergedMeta,
        trace,
      });
    }

    const admin = createAdminClient();
    return await admin.from("p4_narrative_logs").insert({
      tenant_id: siloTenantId,
      actor_id: actorId,
      action_type: severity.toUpperCase(),
      message,
      severity,
      metadata: mergedMeta,
    });
  },

  async info(tenantId: string, message: string, actorId?: string, metadata: MsgfLogMetadata = {}) {
    return this.log("Info", tenantId, message, actorId, metadata);
  },

  async violation(tenantId: string, message: string, actorId?: string, metadata: MsgfLogMetadata = {}) {
    return this.log("Violation", tenantId, message, actorId, metadata);
  },

  async warning(tenantId: string, message: string, actorId?: string, metadata: MsgfLogMetadata = {}) {
    return this.log("Warning", tenantId, message, actorId, metadata);
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
