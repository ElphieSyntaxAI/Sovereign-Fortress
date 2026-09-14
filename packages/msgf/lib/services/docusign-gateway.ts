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
/**
 * DocuSign Connect gateway — thin compatibility layer over SigningProvider.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { isDocuSignConfigured } from "@/lib/services/docusign-rest";
import {
  verifyDocuSignWebhookAuth,
  type DocuSignConnectPayload,
} from "@/lib/services/docusign-webhook-auth";
import { completeSigningEnvelope } from "@/lib/services/signing/completeSigningEnvelope";
import { createSigningEnvelopeForInvite } from "@/lib/services/signing/createSigningEnvelopeForInvite";
import { signingMockMode } from "@/lib/services/signing/resolveSigningProvider";

export type { DocuSignConnectPayload };
export { verifyDocuSignWebhookAuth };

export function mockMode(): boolean {
  return signingMockMode();
}

export function docuSignModeLabel(): "mock" | "live" | "unconfigured" {
  if (signingMockMode()) return "mock";
  if (isDocuSignConfigured()) return "live";
  return "unconfigured";
}

/** True when envelopes can be created (mock QA or live JWT credentials). */
export function docuSignIsAvailable(): boolean {
  return signingMockMode() || isDocuSignConfigured();
}

export async function createEnvelopeForInvite(
  admin: SupabaseClient,
  params: {
    inviteId: string;
    companyId: string;
    userId: string;
    email: string;
    signerName?: string;
  }
): Promise<{ envelope_id: string; signing_url: string } | null> {
  const created = await createSigningEnvelopeForInvite(admin, params);
  if (!created) return null;
  return { envelope_id: created.envelope_id, signing_url: created.signing_url };
}

export async function handleConnectWebhook(
  admin: SupabaseClient,
  payload: DocuSignConnectPayload
): Promise<{ ok: boolean; message: string }> {
  const event = payload.event?.toLowerCase() ?? "";
  const envelopeId = payload.envelopeId ?? payload.data?.envelopeId ?? null;

  const isCompleted =
    event.includes("envelope-completed") ||
    payload.data?.envelopeSummary?.status?.toLowerCase() === "completed";

  if (!isCompleted) {
    return { ok: true, message: "event ignored" };
  }

  const result = await completeSigningEnvelope({
    admin,
    provider: "docusign",
    external_request_id: envelopeId,
    invite_id: payload.inviteId ?? null,
    event: event || "envelope-completed",
  });

  return { ok: result.ok, message: result.message };
}
