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
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */
/**
 * IDE workspace settings + connectivity for Security View (Dev lens).
 */

import type { Session } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

import type { IdeConnectivityCheckResult } from "@/lib/ide-error-codes";
import {
  MSGF_ENTITY_ID_HEADER,
  MSGF_IDE_PULSE_HEADER,
  MSGF_TENANT_ID_HEADER,
  MSGF_TENANT_KEY_HEADER,
} from "@/lib/msgf-http-headers";
import { runIdeConnectivityChecks } from "@/lib/services/ide-connectivity-check";
import { listActiveIdeTokens } from "@/lib/services/ide-token-service";
import { listUserProjects } from "@/lib/services/user-projects";
import {
  buildIdeWorkspaceSettings,
  resolveIdeTenantKey,
  resolveMsgfAppOrigin,
  type IdeWorkspaceSettings,
} from "@/lib/workspace-ide-setup";

export type SecurityProjectOption = {
  project_origin: string;
  label: string;
};

export type SecurityIdeContext = {
  apiUrl: string;
  tenantKey: string;
  hasActiveIdeToken: boolean;
  activeTokenCount: number;
  tokenKind: "long_lived_active" | "needs_mint";
  devSession: boolean;
  role: string;
  settingsPath: string;
  authTokenPreview: string;
  projects: SecurityProjectOption[];
  selectedProjectOrigin: string | null;
  connectivity: IdeConnectivityCheckResult[];
  connectivityOk: boolean;
  settingsPreview: IdeWorkspaceSettings;
};

export async function buildSecurityIdeContext(
  admin: SupabaseClient,
  session: Session,
  requestHost: string | null,
  requestedProjectOrigin?: string | null
): Promise<SecurityIdeContext> {
  const userId = session.user.id;
  const projects = await listUserProjects(admin, userId).catch(() => []);
  const projectOptions: SecurityProjectOption[] = projects.map((p) => ({
    project_origin: p.project_origin,
    label: p.project_origin,
  }));

  const matched =
    requestedProjectOrigin &&
    projects.some((p) => p.project_origin === requestedProjectOrigin)
      ? requestedProjectOrigin
      : null;
  const selectedProjectOrigin = matched ?? projects[0]?.project_origin ?? null;

  const apiUrl = resolveMsgfAppOrigin(requestHost);
  const tenantKey = resolveIdeTenantKey(userId, selectedProjectOrigin);
  const devSessionDefault =
    process.env.MSGF_DEV_SESSION_DEFAULT?.trim().toLowerCase() !== "0" &&
    process.env.MSGF_DEV_SESSION_DEFAULT?.trim().toLowerCase() !== "false";

  const activeTokens = await listActiveIdeTokens(admin, userId, tenantKey);
  const hasActiveIdeToken = activeTokens.length > 0;

  const settingsPreview = buildIdeWorkspaceSettings({
    apiUrl,
    tenantKey,
    authToken: hasActiveIdeToken
      ? "msgf_ide_* (active — copy from Workspace)"
      : "← Mint long-lived IDE token in Workspace",
    devSession: devSessionDefault,
  });

  const probeReq = new NextRequest("http://msgf.local/security-ide-probe", {
    headers: new Headers({
      authorization: `Bearer ${session.access_token}`,
      [MSGF_IDE_PULSE_HEADER]: "1",
      [MSGF_TENANT_KEY_HEADER]: tenantKey,
      [MSGF_TENANT_ID_HEADER]: tenantKey,
      [MSGF_ENTITY_ID_HEADER]: userId,
    }),
  });

  const connectivity = await runIdeConnectivityChecks(probeReq);

  return {
    apiUrl,
    tenantKey,
    hasActiveIdeToken,
    activeTokenCount: activeTokens.length,
    tokenKind: hasActiveIdeToken ? "long_lived_active" : "needs_mint",
    devSession: settingsPreview["msgf.devSession"] === true,
    role: settingsPreview["msgf.role"] ?? "dev",
    settingsPath: ".vscode/settings.json",
    authTokenPreview: hasActiveIdeToken
      ? `${activeTokens.length} active msgf_ide_* token(s)`
      : "Session JWT only — mint IDE token for the extension",
    projects: projectOptions,
    selectedProjectOrigin,
    connectivity,
    connectivityOk: connectivity.every((c) => c.ok),
    settingsPreview,
  };
}
