/**
 * Author BFF ↔ MSGF wiring — env checks for `/api/status` and ops probes.
 */

import { buildAuthorMsgfDashboardLinks, type AuthorMsgfDashboardLinks } from "./authorMsgfDashboardLinks.js";
import {
  AUTHOR_MSGF_LOCAL_DEV_ORIGIN,
  AUTHOR_MSGF_PROJECT_ORIGIN,
  authorMsgfBridgeConfigured,
  resolveAuthorMsgfAppUrl,
  resolveAuthorMsgfTenantId,
  resolveAuthorPulseLicenseKey,
} from "./authorMsgfEnv.js";
import { getAuthorGovernanceStatus, resolveAuthorGatewayMode } from "./authorMsgfGovernance.js";

export {
  AUTHOR_MSGF_LOCAL_DEV_ORIGIN,
  AUTHOR_MSGF_PROJECT_ORIGIN,
  resolveAuthorMsgfAppUrl,
  resolveAuthorMsgfTenantId,
};

export type AuthorMsgfMappingStatus = {
  tenant_id: string;
  msgf_app_url: string | null;
  msgf_app_url_configured: boolean;
  pulse_license_configured: boolean;
  hal_pulse_enabled: boolean;
  ingest_api_key_configured: boolean;
  ingest_tenant_id: string | null;
  author_hal_header: "x-msgf-author-hal";
  project_origin: typeof AUTHOR_MSGF_PROJECT_ORIGIN;
  chunk_words: 175;
  chunk_overlap_words: 10;
  ready: boolean;
  missing: string[];
  dashboard_links: AuthorMsgfDashboardLinks;
  gateway_mode: ReturnType<typeof resolveAuthorGatewayMode>;
  governance: ReturnType<typeof getAuthorGovernanceStatus>;
  stress_test_commands: {
    probe: string;
    track_tokens_live: string;
    track_tokens_offline: string;
    mint_license: string;
  };
};

function trim(name: string): string {
  return process.env[name]?.trim() || "";
}

export function getAuthorMsgfMappingStatus(): AuthorMsgfMappingStatus {
  const tenant_id = resolveAuthorMsgfTenantId();
  const msgf_app_url = resolveAuthorMsgfAppUrl();
  const pulse_license_configured = Boolean(resolveAuthorPulseLicenseKey());
  const hal_pulse_enabled = trim("MSGF_AUTHOR_HAL_PULSE_ENABLED").toLowerCase() !== "0";
  const ingest_api_key_configured = Boolean(trim("MSGF_INGEST_API_KEY"));
  const ingest_tenant_id = trim("MSGF_INGEST_TENANT_ID") || tenant_id;

  const missing: string[] = [];
  if (!msgf_app_url) missing.push("MSGF_APP_URL");
  if (!pulse_license_configured) {
    missing.push("MSGF_AUTHOR_PULSE_LICENSE_KEY or MSGF_CONTRACT_LICENSE_KEY");
  }

  const ready = missing.length === 0 && hal_pulse_enabled;
  const governance = getAuthorGovernanceStatus();

  return {
    tenant_id,
    msgf_app_url,
    msgf_app_url_configured: Boolean(msgf_app_url),
    pulse_license_configured,
    hal_pulse_enabled,
    ingest_api_key_configured,
    ingest_tenant_id,
    author_hal_header: "x-msgf-author-hal",
    project_origin: AUTHOR_MSGF_PROJECT_ORIGIN,
    chunk_words: 175,
    chunk_overlap_words: 10,
    ready,
    missing,
    dashboard_links: buildAuthorMsgfDashboardLinks(tenant_id),
    gateway_mode: resolveAuthorGatewayMode(),
    governance,
    stress_test_commands: {
      probe: "npm run probe:author-ecosystem -w msgf",
      track_tokens_live: "npm run track:author-tokens:live -w msgf",
      track_tokens_offline: "npm run track:author-tokens -w msgf",
      mint_license:
        "npm run bootstrap:author-msgf -w msgf  (prints MSGF_AUTHOR_PULSE_LICENSE_KEY for .env)",
    },
  };
}

/** @deprecated Prefer {@link authorMsgfBridgeConfigured} from authorMsgfEnv. */
export function isAuthorMsgfReady(): boolean {
  return authorMsgfBridgeConfigured();
}
