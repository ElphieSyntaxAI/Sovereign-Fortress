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
 * Distribution Build ID: MSGF-2b663b7-20260519T155850Z-internal
 */
import type { GenealogicalBugIndex } from "@/lib/schemas/vault-hall-metadata";

/** Payload MSGF forwards to the Author App reject webhook. */
export type AuthorPulseRejectedPayload = {
  userId: string;
  incidentId: string;
  narrativeLogId: string | null;
  resolutionNote: string;
  bugIndex: GenealogicalBugIndex;
};

export type AuthorPulseRejectedNotifyResult = {
  notified: boolean;
  skipped?: string;
};

/**
 * Ops bridge: notify Author App that a Pulse was permanently rejected (admin Bearer required).
 */
export async function notifyAuthorPulseRejected(params: {
  baseUrl: string;
  adminBearer: string;
  payload: AuthorPulseRejectedPayload;
  fetchImpl?: typeof fetch;
}): Promise<AuthorPulseRejectedNotifyResult> {
  const base = params.baseUrl.trim().replace(/\/$/, "");
  const fetchImpl = params.fetchImpl ?? fetch.bind(globalThis);

  const res = await fetchImpl(`${base}/api/msgf/admin/incidents/notify-reject`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.adminBearer}`,
    },
    body: JSON.stringify({
      user_id: params.payload.userId,
      incident_id: params.payload.incidentId,
      narrative_log_id: params.payload.narrativeLogId,
      resolution_note: params.payload.resolutionNote,
      bug_index: params.payload.bugIndex,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    notified?: boolean;
    skipped?: string;
    error?: string;
  };

  if (!res.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : `Author notify failed (${res.status})`
    );
  }

  if (data.notified === true) {
    return { notified: true };
  }

  return {
    notified: false,
    skipped: typeof data.skipped === "string" ? data.skipped : "Webhook not configured.",
  };
}
