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

import { getSigningProviderForCompany } from "@/lib/services/signing/index";
import { signingMockMode } from "@/lib/services/signing/resolveSigningProvider";
import type { SigningProviderId } from "@/lib/services/signing/SigningProvider";

export async function createSigningEnvelopeForInvite(
  admin: SupabaseClient,
  params: {
    inviteId: string;
    companyId: string;
    userId: string;
    email: string;
    signerName?: string;
  }
): Promise<{
  provider: SigningProviderId;
  envelope_id: string;
  signing_url: string;
} | null> {
  const provider = await getSigningProviderForCompany(admin, params.companyId);
  if (!provider.isAvailable()) return null;

  const appUrl = process.env.MSGF_APP_URL?.trim() || "http://127.0.0.1:3001";
  const returnUrl = `${appUrl}/workspace?tab=architecture&signing=complete&invite=${params.inviteId}`;

  const created = await provider.createEnvelope({
    inviteId: params.inviteId,
    companyId: params.companyId,
    userId: params.userId,
    email: params.email,
    signerName: params.signerName,
    returnUrl,
  });
  if (!created) return null;

  const { error } = await admin.from("msgf_docusign_envelopes").insert({
    invite_id: params.inviteId,
    user_id: params.userId,
    company_id: params.companyId,
    envelope_id: created.external_request_id,
    external_request_id: created.external_request_id,
    provider: created.provider,
    signing_url: created.signing_url,
    status: "sent",
  });

  if (error) throw new Error(`createSigningEnvelopeForInvite: ${error.message}`);

  await admin
    .from("msgf_team_invites")
    .update({ onboarding_status: "PENDING_SIGNATURE" })
    .eq("id", params.inviteId);

  return {
    provider: created.provider,
    envelope_id: created.external_request_id,
    signing_url: created.signing_url,
  };
}

/** True when any signing adapter can create envelopes (mock or live credentials). */
export function signingIsAvailable(_providerId?: SigningProviderId): boolean {
  if (signingMockMode()) return true;
  const ds =
    Boolean(process.env.DOCUSIGN_INTEGRATION_KEY?.trim()) &&
    Boolean(process.env.DOCUSIGN_USER_ID?.trim()) &&
    Boolean(process.env.DOCUSIGN_ACCOUNT_ID?.trim()) &&
    Boolean(process.env.DOCUSIGN_RSA_PRIVATE_KEY?.trim());
  const dbs = Boolean(process.env.DROPBOX_SIGN_API_KEY?.trim());
  return ds || dbs;
}
