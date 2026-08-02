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

import { DocuSignSigningProvider } from "@/lib/services/signing/DocuSignSigningProvider";
import { DropboxSignSigningProvider } from "@/lib/services/signing/DropboxSignSigningProvider";
import type { SigningProvider, SigningProviderId } from "@/lib/services/signing/SigningProvider";
import { resolveSigningProviderId } from "@/lib/services/signing/resolveSigningProvider";

export function getSigningProviderById(id: SigningProviderId): SigningProvider {
  return id === "dropbox_sign"
    ? new DropboxSignSigningProvider()
    : new DocuSignSigningProvider();
}

export async function getSigningProviderForCompany(
  admin: SupabaseClient,
  companyId: string | null | undefined
): Promise<SigningProvider> {
  const id = await resolveSigningProviderId(admin, companyId);
  return getSigningProviderById(id);
}
