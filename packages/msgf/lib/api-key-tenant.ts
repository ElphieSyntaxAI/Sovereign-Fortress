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
 * Distribution Build ID: MSGF-853c3b6-20260519T054901Z-internal
 */
/**
 * Map tenant API keys from env `MSGF_TENANT_API_KEYS` (JSON object:
 * `"tenant_id": "secret"`). Lookup returns tenant_id for a matching secret.
 */
export function resolveTenantIdFromApiKey(apiKey: string | null): string | null {
  if (!apiKey?.trim()) return null;
  const raw = process.env.MSGF_TENANT_API_KEYS;
  if (!raw?.trim()) return null;
  try {
    const map = JSON.parse(raw) as Record<string, string>;
    for (const [tenantId, secret] of Object.entries(map)) {
      if (typeof secret === "string" && secret === apiKey) return tenantId;
    }
  } catch {
    return null;
  }
  return null;
}

export function isTenantApiKeyConfigured(): boolean {
  return Boolean(process.env.MSGF_TENANT_API_KEYS?.trim());
}
