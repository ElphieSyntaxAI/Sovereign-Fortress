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
import { bundleSentinelTelemetry } from "./sentinel-snapshot-bundle";
import {
  parseSelfHealReportResponse,
  type SelfHealReportApiResponse,
  type SelfHealReportUIResult,
} from "./self-heal-report-ui";

export type ReportSystemIssueParams = {
  operatorNote: string;
  entityId?: string;
  /** @deprecated Use `entityId`. */
  authorId?: string;
  tenantId?: string;
  /** App-provided snapshot fields (editor, pillar_health, …). */
  snapshot?: Record<string, unknown>;
  /** Raw keystrokes when not already on `snapshot.keystrokes_last_10`. */
  keystrokes?: Array<Record<string, unknown>>;
  /**
   * Full report URL. Use Author BFF `/api/msgf/self-heal/report` or MSGF admin route.
   */
  reportEndpointUrl: string;
  getAuthHeaders?: () => HeadersInit | Promise<HeadersInit>;
  adminBearer?: string;
  actAsUserId?: string;
  credentials?: RequestCredentials;
  fetchImpl?: typeof fetch;
};

export type ReportSystemIssueSnapshotBody = Record<string, unknown> & {
  captured_at: string;
  source: string;
  operator_note: string;
  editor: Record<string, unknown>;
  keystrokes_last_10: Array<Record<string, unknown>>;
  local_storage: ReturnType<typeof bundleSentinelTelemetry>["local_storage"];
  biometric_telemetry: ReturnType<typeof bundleSentinelTelemetry>["biometric_telemetry"];
};

export function buildReportSystemIssueBody(
  params: ReportSystemIssueParams
): ReportSystemIssueSnapshotBody {
  const snapshot = params.snapshot ?? {};
  const keystrokes =
    (Array.isArray(snapshot.keystrokes_last_10)
      ? (snapshot.keystrokes_last_10 as Array<Record<string, unknown>>)
      : null) ??
    params.keystrokes ??
    [];

  const telemetry = bundleSentinelTelemetry({ keystrokes });

  const editor =
    snapshot.editor && typeof snapshot.editor === "object"
      ? (snapshot.editor as Record<string, unknown>)
      : {};

  return {
    ...snapshot,
    captured_at:
      typeof snapshot.captured_at === "string" ? snapshot.captured_at : new Date().toISOString(),
    source: typeof snapshot.source === "string" ? snapshot.source : "msgf_client",
    entity_id:
      params.entityId ??
      params.authorId ??
      (typeof snapshot.entity_id === "string" ? snapshot.entity_id : undefined) ??
      (typeof snapshot.author_id === "string" ? snapshot.author_id : undefined),
    tenant_id: params.tenantId ?? snapshot.tenant_id,
    operator_note: params.operatorNote.trim(),
    editor,
    keystrokes_last_10: telemetry.biometric_telemetry.keystrokes_last_10,
    local_storage: telemetry.local_storage,
    biometric_telemetry: telemetry.biometric_telemetry,
  };
}

export async function postReportSystemIssue(
  params: ReportSystemIssueParams
): Promise<SelfHealReportUIResult> {
  const body = buildReportSystemIssueBody(params);
  const fetchImpl = params.fetchImpl ?? fetch.bind(globalThis);
  const credentials = params.credentials ?? "include";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (params.adminBearer?.trim()) {
    headers.Authorization = `Bearer ${params.adminBearer.trim()}`;
    const actAs = params.actAsUserId ?? params.entityId ?? params.authorId;
    if (actAs) headers["x-msgf-act-as-user"] = actAs;
  } else if (params.getAuthHeaders) {
    const extra = await params.getAuthHeaders();
    Object.assign(headers, extra as Record<string, string>);
  }

  const res = await fetchImpl(params.reportEndpointUrl, {
    method: "POST",
    headers,
    credentials,
    body: JSON.stringify(body),
  });

  const raw = (await res.json().catch(() => ({}))) as SelfHealReportApiResponse;
  return parseSelfHealReportResponse(raw, res.ok);
}
