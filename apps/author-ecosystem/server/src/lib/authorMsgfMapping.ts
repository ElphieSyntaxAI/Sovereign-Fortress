/**
 * Author BFF ↔ MSGF wiring — env checks for `/api/status` and ops probes.
 */

export type AuthorMsgfMappingStatus = {
  tenant_id: string;
  msgf_app_url: string | null;
  msgf_app_url_configured: boolean;
  pulse_license_configured: boolean;
  hal_pulse_enabled: boolean;
  ingest_api_key_configured: boolean;
  ingest_tenant_id: string | null;
  author_hal_header: "x-msgf-author-hal";
  chunk_words: 175;
  chunk_overlap_words: 10;
  ready: boolean;
  missing: string[];
};

function trim(name: string): string {
  return process.env[name]?.trim() || "";
}

export function resolveAuthorMsgfTenantId(raw?: string | null): string {
  return raw?.trim() || trim("MSGF_AUTHOR_TENANT_ID") || "author_ecosystem";
}

export function resolveAuthorMsgfAppUrl(): string | null {
  const url =
    trim("MSGF_APP_URL") ||
    trim("NEXT_PUBLIC_MSGF_APP_URL") ||
    trim("MSGF_BASE_URL");
  return url ? url.replace(/\/+$/, "") : null;
}

export function getAuthorMsgfMappingStatus(): AuthorMsgfMappingStatus {
  const tenant_id = resolveAuthorMsgfTenantId();
  const msgf_app_url = resolveAuthorMsgfAppUrl();
  const pulse_license_configured = Boolean(
    trim("MSGF_AUTHOR_PULSE_LICENSE_KEY") || trim("MSGF_CONTRACT_LICENSE_KEY")
  );
  const hal_pulse_enabled = trim("MSGF_AUTHOR_HAL_PULSE_ENABLED").toLowerCase() !== "0";
  const ingest_api_key_configured = Boolean(trim("MSGF_INGEST_API_KEY"));
  const ingest_tenant_id = trim("MSGF_INGEST_TENANT_ID") || tenant_id;

  const missing: string[] = [];
  if (!msgf_app_url) missing.push("MSGF_APP_URL");
  if (!pulse_license_configured) {
    missing.push("MSGF_AUTHOR_PULSE_LICENSE_KEY or MSGF_CONTRACT_LICENSE_KEY");
  }

  const ready = missing.length === 0 && hal_pulse_enabled;

  return {
    tenant_id,
    msgf_app_url,
    msgf_app_url_configured: Boolean(msgf_app_url),
    pulse_license_configured,
    hal_pulse_enabled,
    ingest_api_key_configured,
    ingest_tenant_id,
    author_hal_header: "x-msgf-author-hal",
    chunk_words: 175,
    chunk_overlap_words: 10,
    ready,
    missing,
  };
}
