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
 * Distribution Build ID: MSGF-fca2d532-20260923T201750Z-internal
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type WebhookInboxProvider = "docusign" | "dropbox_sign" | "sentry" | "other";

export type ClaimWebhookInboxResult =
  | { kind: "claimed"; idempotency_key: string }
  | { kind: "duplicate_done"; idempotency_key: string }
  | { kind: "duplicate_inflight"; idempotency_key: string }
  | { kind: "error"; message: string };

/** Stable key: provider:external_or_invite:event */
export function buildWebhookIdempotencyKey(params: {
  provider: string;
  externalRequestId?: string | null;
  inviteId?: string | null;
  event?: string | null;
}): string {
  const provider = params.provider.trim().toLowerCase() || "other";
  const ext =
    params.externalRequestId?.trim() ||
    params.inviteId?.trim() ||
    "unknown";
  const event = (params.event?.trim() || "event").toLowerCase().replace(/\s+/g, "_");
  return `${provider}:${ext}:${event}`.slice(0, 512);
}

/**
 * Insert inbox row. On conflict: if already processed → duplicate_done; else inflight.
 */
export async function claimWebhookInbox(
  admin: SupabaseClient,
  params: {
    idempotencyKey: string;
    provider: WebhookInboxProvider;
    event?: string | null;
    payload: Record<string, unknown>;
    inviteId?: string | null;
    externalRequestId?: string | null;
  }
): Promise<ClaimWebhookInboxResult> {
  const key = params.idempotencyKey.trim();
  if (!key) return { kind: "error", message: "empty_idempotency_key" };

  const { error } = await admin.from("msgf_webhook_inbox").insert({
    idempotency_key: key,
    provider: params.provider,
    event: params.event ?? null,
    payload: params.payload,
    invite_id: params.inviteId ?? null,
    external_request_id: params.externalRequestId ?? null,
  });

  if (!error) {
    return { kind: "claimed", idempotency_key: key };
  }

  const msg = error.message.toLowerCase();
  const isConflict =
    error.code === "23505" ||
    msg.includes("duplicate") ||
    msg.includes("unique");

  if (!isConflict) {
    return { kind: "error", message: error.message };
  }

  const { data: existing } = await admin
    .from("msgf_webhook_inbox")
    .select("processed_at")
    .eq("idempotency_key", key)
    .maybeSingle();

  if ((existing as { processed_at?: string | null } | null)?.processed_at) {
    return { kind: "duplicate_done", idempotency_key: key };
  }
  return { kind: "duplicate_inflight", idempotency_key: key };
}

export async function markWebhookInboxProcessed(
  admin: SupabaseClient,
  idempotencyKey: string,
  errorMessage?: string | null
): Promise<void> {
  const now = new Date().toISOString();
  await admin
    .from("msgf_webhook_inbox")
    .update({
      processed_at: now,
      error: errorMessage?.trim() || null,
    })
    .eq("idempotency_key", idempotencyKey);
}
