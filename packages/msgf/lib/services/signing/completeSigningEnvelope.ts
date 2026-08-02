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
 * Distribution Build ID: MSGF-149f647f-20260728T230931Z-internal
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { SigningProviderId } from "@/lib/services/signing/SigningProvider";
import { appendVaultLog } from "@/lib/services/tenant-onboarding-vault";

export type CompleteSigningParams = {
  admin: SupabaseClient;
  provider: SigningProviderId;
  external_request_id?: string | null;
  invite_id?: string | null;
  event?: string;
};

/**
 * Marks envelope completed, invite APPROVED, profile active.
 * Returns true when an invite was resolved and updated.
 */
export async function completeSigningEnvelope(params: CompleteSigningParams): Promise<{
  ok: boolean;
  invite_id: string | null;
  message: string;
}> {
  const { admin, provider } = params;
  let inviteId = params.invite_id?.trim() || null;
  let companyId: string | null = null;
  let userId: string | null = null;
  let envelopeRowId: string | null = null;

  if (params.external_request_id) {
    const ext = params.external_request_id;
    const { data: byExt } = await admin
      .from("msgf_docusign_envelopes")
      .select("id, invite_id, user_id, company_id, status")
      .eq("provider", provider)
      .eq("external_request_id", ext)
      .maybeSingle();
    if (byExt) {
      envelopeRowId = (byExt as { id: string }).id;
      inviteId = inviteId || (byExt as { invite_id: string }).invite_id;
      userId = (byExt as { user_id?: string | null }).user_id ?? null;
      companyId = (byExt as { company_id: string }).company_id;
    }

    // Legacy DocuSign rows keyed only by envelope_id
    if (!envelopeRowId && provider === "docusign") {
      const { data: legacy } = await admin
        .from("msgf_docusign_envelopes")
        .select("id, invite_id, user_id, company_id")
        .eq("envelope_id", ext)
        .maybeSingle();
      if (legacy) {
        envelopeRowId = (legacy as { id: string }).id;
        inviteId = inviteId || (legacy as { invite_id: string }).invite_id;
        userId = (legacy as { user_id?: string | null }).user_id ?? null;
        companyId = (legacy as { company_id: string }).company_id;
      }
    }
  }

  if (!inviteId) {
    return { ok: false, invite_id: null, message: "invite_not_found" };
  }

  if (!envelopeRowId) {
    const { data: byInvite } = await admin
      .from("msgf_docusign_envelopes")
      .select("id, user_id, company_id")
      .eq("invite_id", inviteId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (byInvite) {
      envelopeRowId = (byInvite as { id: string }).id;
      userId = userId || (byInvite as { user_id?: string | null }).user_id || null;
      companyId = companyId || (byInvite as { company_id: string }).company_id;
    }
  }

  const now = new Date().toISOString();

  if (envelopeRowId) {
    await admin
      .from("msgf_docusign_envelopes")
      .update({
        status: "completed",
        completed_at: now,
        connect_event_id: params.event || "signing-completed",
      })
      .eq("id", envelopeRowId);
  } else {
    await admin
      .from("msgf_docusign_envelopes")
      .update({
        status: "completed",
        completed_at: now,
        connect_event_id: params.event || "signing-completed",
      })
      .eq("invite_id", inviteId);
  }

  await admin
    .from("msgf_team_invites")
    .update({
      status: "accepted",
      onboarding_status: "APPROVED",
      accepted_at: now,
      accepted_user_id: userId,
    })
    .eq("id", inviteId);

  if (!userId || !companyId) {
    const { data: invite } = await admin
      .from("msgf_team_invites")
      .select("accepted_user_id, company_id")
      .eq("id", inviteId)
      .maybeSingle();
    userId = userId || (invite as { accepted_user_id?: string } | null)?.accepted_user_id || null;
    companyId = companyId || (invite as { company_id?: string } | null)?.company_id || null;
  }

  if (userId) {
    await admin
      .from("p4_profiles")
      .update({ account_status: "active", updated_at: now })
      .eq("user_id", userId);
  }

  if (companyId) {
    await appendVaultLog(admin, companyId, "signing_completed", {
      provider,
      invite_id: inviteId,
      external_request_id: params.external_request_id ?? null,
      event: params.event ?? null,
      user_id: userId,
      completed_at: now,
    });
  }

  if (!userId) {
    return { ok: false, invite_id: inviteId, message: "envelope not matched to user" };
  }

  return { ok: true, invite_id: inviteId, message: "account activated" };
}
