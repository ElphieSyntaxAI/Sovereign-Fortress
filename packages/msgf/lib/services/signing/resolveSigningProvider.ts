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
 * Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { SigningProviderId } from "@/lib/services/signing/SigningProvider";

export function signingMockMode(): boolean {
  const a = process.env.MSGF_SIGNING_MOCK?.trim().toLowerCase();
  const b = process.env.MSGF_DOCUSIGN_MOCK?.trim().toLowerCase();
  return a === "1" || a === "true" || b === "1" || b === "true";
}

export function envSigningProviderDefault(): SigningProviderId {
  const v = process.env.SIGNING_PROVIDER?.trim().toLowerCase();
  if (v === "dropbox_sign" || v === "hellosign") return "dropbox_sign";
  return "docusign";
}

/**
 * Company row override wins over SIGNING_PROVIDER env.
 */
export async function resolveSigningProviderId(
  admin: SupabaseClient,
  companyId: string | null | undefined
): Promise<SigningProviderId> {
  const cid = companyId?.trim();
  if (cid) {
    const { data } = await admin
      .from("msgf_companies")
      .select("signing_provider")
      .eq("id", cid)
      .maybeSingle();
    const p = (data as { signing_provider?: string } | null)?.signing_provider?.trim().toLowerCase();
    if (p === "dropbox_sign") return "dropbox_sign";
    if (p === "docusign") return "docusign";
  }
  return envSigningProviderDefault();
}
