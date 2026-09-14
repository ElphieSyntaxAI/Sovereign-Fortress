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
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { completeSigningEnvelope } from "@/lib/services/signing/completeSigningEnvelope";
import type { SigningProviderId } from "@/lib/services/signing/SigningProvider";
import { enqueueDropboxArchiveJob } from "@/lib/services/msgf-job-queue";
import {
  buildWebhookIdempotencyKey,
  claimWebhookInbox,
  markWebhookInboxProcessed,
} from "@/lib/services/webhook-inbox";

export type ProcessSigningWebhookResult = {
  ok: boolean;
  message: string;
  invite_id: string | null;
  duplicate?: boolean;
  archive?: "queued" | "pending_local" | "skipped";
  idempotency_key: string;
};

export async function processSigningWebhookCompletion(params: {
  admin: SupabaseClient;
  provider: SigningProviderId;
  event: string;
  external_request_id?: string | null;
  invite_id?: string | null;
  rawPayload: Record<string, unknown>;
}): Promise<ProcessSigningWebhookResult> {
  const idempotency_key = buildWebhookIdempotencyKey({
    provider: params.provider,
    externalRequestId: params.external_request_id,
    inviteId: params.invite_id,
    event: params.event,
  });

  const claim = await claimWebhookInbox(params.admin, {
    idempotencyKey: idempotency_key,
    provider: params.provider,
    event: params.event,
    payload: params.rawPayload,
    inviteId: params.invite_id,
    externalRequestId: params.external_request_id,
  });

  if (claim.kind === "error") {
    // Fail-open: still complete so IDE unlock is not blocked by inbox outage
    console.warn("[signing-webhook] inbox claim failed:", claim.message);
  }

  if (claim.kind === "duplicate_done") {
    return {
      ok: true,
      message: "duplicate ignored (already processed)",
      invite_id: params.invite_id ?? null,
      duplicate: true,
      archive: "skipped",
      idempotency_key,
    };
  }

  if (claim.kind === "duplicate_inflight") {
    // Another worker may be completing; treat as soft success for provider retries
    return {
      ok: true,
      message: "duplicate ignored (in flight)",
      invite_id: params.invite_id ?? null,
      duplicate: true,
      archive: "skipped",
      idempotency_key,
    };
  }

  const result = await completeSigningEnvelope({
    admin: params.admin,
    provider: params.provider,
    external_request_id: params.external_request_id,
    invite_id: params.invite_id,
    event: params.event,
  });

  if (!result.ok) {
    await markWebhookInboxProcessed(params.admin, idempotency_key, result.message);
    return {
      ok: false,
      message: result.message,
      invite_id: result.invite_id,
      idempotency_key,
    };
  }

  let archive: ProcessSigningWebhookResult["archive"] = "skipped";
  const inviteId = result.invite_id;

  if (inviteId) {
    const { data: env } = await params.admin
      .from("msgf_docusign_envelopes")
      .select("id, company_id")
      .eq("invite_id", inviteId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const companyId = (env as { company_id?: string } | null)?.company_id;
    const envelopeId = (env as { id?: string } | null)?.id;

    if (companyId) {
      const enq = await enqueueDropboxArchiveJob({
        invite_id: inviteId,
        company_id: companyId,
        envelope_id: envelopeId ?? null,
        provider: params.provider,
      });

      const archiveStatus = enq.queued ? "queued" : "pending_local";
      archive = archiveStatus;

      if (envelopeId) {
        await params.admin
          .from("msgf_docusign_envelopes")
          .update({ archive_status: archiveStatus })
          .eq("id", envelopeId);
      }
    }
  }

  await markWebhookInboxProcessed(params.admin, idempotency_key, null);

  return {
    ok: true,
    message: result.message,
    invite_id: inviteId,
    archive,
    idempotency_key,
  };
}
