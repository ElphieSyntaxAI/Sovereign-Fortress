/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
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
