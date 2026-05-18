import type { MsgfGuardSettings } from "./config";
import {
  MSGF_ENTITY_ID_HEADER,
  MSGF_IDE_PULSE_HEADER,
  MSGF_TENANT_ID_HEADER,
  MSGF_TENANT_KEY_HEADER,
} from "./constants";
import { buildRoleTrackingHeaders, hasValidAuthToken } from "./rolePermissions";

export type PulseAuthHeaders = Record<string, string>;

/**
 * V3.2 Pulse request headers: Bearer auth, tenant key, IDE marker, optional role / fallback tracking.
 */
export function buildPulseAuthHeaders(params: {
  settings: MsgfGuardSettings;
  tenantId: string;
  entityId: string;
}): PulseAuthHeaders {
  const { settings, tenantId, entityId } = params;

  const headers: PulseAuthHeaders = {
    "Content-Type": "application/json",
    [MSGF_TENANT_KEY_HEADER]: tenantId,
    [MSGF_TENANT_ID_HEADER]: tenantId,
    [MSGF_ENTITY_ID_HEADER]: entityId,
    [MSGF_IDE_PULSE_HEADER]: "1",
    ...buildRoleTrackingHeaders(settings),
  };

  const authToken = settings.authToken.trim();
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  } else {
    const license = settings.licenseKey.trim();
    if (license.startsWith("msgf_live_")) {
      headers.Authorization = `Bearer ${license}`;
    }
  }

  return headers;
}

export function pulseAuthReady(settings: MsgfGuardSettings): boolean {
  return hasValidAuthToken(settings) || settings.licenseKey.trim().startsWith("msgf_live_");
}

/** Bearer + tenant headers for GET health / dashboard APIs (no IDE pulse marker). */
export function buildApiAuthHeaders(params: {
  settings: MsgfGuardSettings;
  tenantId: string;
}): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    [MSGF_TENANT_KEY_HEADER]: params.tenantId,
    [MSGF_TENANT_ID_HEADER]: params.tenantId,
    ...buildRoleTrackingHeaders(params.settings),
  };

  const authToken = params.settings.authToken.trim();
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  } else {
    const license = params.settings.licenseKey.trim();
    if (license.startsWith("msgf_live_")) {
      headers.Authorization = `Bearer ${license}`;
    }
  }

  return headers;
}
