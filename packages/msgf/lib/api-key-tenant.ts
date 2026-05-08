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
