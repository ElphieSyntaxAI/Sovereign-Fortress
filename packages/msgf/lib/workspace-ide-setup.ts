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
 * Distribution Build ID: MSGF-44d0906-20260522T043912Z-internal
 */
import { allocatePersonalSandboxTenantId } from "@/lib/msgf-tenant-governance";

const DEFAULT_ORIGIN = "https://elphiesgatedai.elphiesyntax.com";

/** MSGF API origin for Pulse + health (matches hosted request or env). */
export function resolveMsgfAppOrigin(requestHost?: string | null): string {
  const fromEnv =
    process.env.MSGF_APP_URL?.trim() || process.env.NEXT_PUBLIC_MSGF_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const host = requestHost?.trim().toLowerCase();
  if (host) {
    const proto = host.includes("localhost") || host.startsWith("127.") ? "http" : "https";
    return `${proto}://${host}`;
  }

  return DEFAULT_ORIGIN;
}

export function resolveIdeTenantKey(userId: string, preferredProjectOrigin?: string | null): string {
  const origin = preferredProjectOrigin?.trim();
  if (origin) return origin;
  return allocatePersonalSandboxTenantId(userId);
}

export type IdeWorkspaceSettings = {
  "msgf.apiUrl": string;
  "msgf.tenantKey": string;
  "msgf.authToken": string;
  "msgf.role": string;
};

export function buildIdeWorkspaceSettings(input: {
  apiUrl: string;
  tenantKey: string;
  authToken: string;
  role?: string;
}): IdeWorkspaceSettings {
  return {
    "msgf.apiUrl": input.apiUrl.replace(/\/$/, ""),
    "msgf.tenantKey": input.tenantKey,
    "msgf.authToken": input.authToken,
    "msgf.role": input.role ?? "dev",
  };
}

export function formatIdeSettingsJson(settings: IdeWorkspaceSettings): string {
  return JSON.stringify(settings, null, 2);
}
