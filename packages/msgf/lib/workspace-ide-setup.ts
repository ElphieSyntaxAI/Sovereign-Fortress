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
 * Distribution Build ID: MSGF-c1a5d75-20260723T221428Z-internal
 */
import { allocatePersonalSandboxTenantId } from "@/lib/msgf-tenant-governance";
import { sanitizeTenantScope } from "@/lib/sanitize-tenant-scope";

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
  const origin = sanitizeTenantScope(preferredProjectOrigin ?? "");
  if (origin) return origin;
  return allocatePersonalSandboxTenantId(userId);
}

export type IdeWorkspaceSettings = {
  /** Opt in for this workspace only (off by default in the Pulse Guard extension). */
  "msgf.enabled": boolean;
  "msgf.apiUrl": string;
  "msgf.tenantKey": string;
  "msgf.authToken": string;
  "msgf.role": string;
  /** Monorepo: relative app path when workspace root is the git repo (e.g. apps/author-ecosystem). */
  "msgf.productPath"?: string;
  /** Vibe-coding profile: save-primary pulse flush + build-active drift relax. */
  "msgf.devSession"?: boolean;
  /** Brain sensitivity 0.1 (strict) → 0.5 (relaxed). */
  "msgf.brainSensitivity"?: number;
};

export function buildIdeWorkspaceSettings(input: {
  apiUrl: string;
  tenantKey: string;
  authToken: string;
  role?: string;
  productPath?: string | null;
  devSession?: boolean;
  brainSensitivity?: number;
}): IdeWorkspaceSettings {
  const settings: IdeWorkspaceSettings = {
    "msgf.enabled": true,
    "msgf.apiUrl": input.apiUrl.replace(/\/$/, ""),
    "msgf.tenantKey": input.tenantKey,
    "msgf.authToken": input.authToken,
    "msgf.role": input.role ?? "dev",
  };
  const productPath = input.productPath?.trim();
  if (productPath) settings["msgf.productPath"] = productPath;
  if (input.devSession === true) settings["msgf.devSession"] = true;
  if (input.brainSensitivity != null && Number.isFinite(input.brainSensitivity)) {
    settings["msgf.brainSensitivity"] = input.brainSensitivity;
  }
  return settings;
}

export function formatIdeSettingsJson(settings: IdeWorkspaceSettings): string {
  return JSON.stringify(settings, null, 2);
}
