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
/**
 * Register IDE workspaces for tenant handoff (P4).
 */

import { createHash } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

export function fingerprintWorkspace(input: {
  userId: string;
  workspaceName: string;
  workspacePathHint?: string | null;
}): string {
  const material = [
    input.userId,
    input.workspaceName.trim().toLowerCase(),
    input.workspacePathHint?.trim().toLowerCase() ?? "",
  ].join("|");
  return createHash("sha256").update(material, "utf8").digest("hex");
}

export async function registerWorkspace(
  admin: SupabaseClient,
  params: {
    userId: string;
    tenantId: string;
    workspaceName: string;
    workspacePathHint?: string | null;
  }
): Promise<
  | { ok: true; workspace_fingerprint: string; registered_at: string }
  | { ok: false; error: string }
> {
  const workspace_fingerprint = fingerprintWorkspace({
    userId: params.userId,
    workspaceName: params.workspaceName,
    workspacePathHint: params.workspacePathHint,
  });
  const now = new Date().toISOString();

  const { error } = await admin.from("msgf_registered_workspaces").upsert(
    {
      user_id: params.userId,
      tenant_id: params.tenantId,
      workspace_fingerprint,
      workspace_name: params.workspaceName.slice(0, 256),
      registered_at: now,
      last_seen_at: now,
    },
    { onConflict: "user_id,workspace_fingerprint" }
  );

  if (error) {
    return {
      ok: false,
      error: error.message.includes("msgf_registered_workspaces")
        ? "Apply migration 20260628130000_msgf_ide_tokens_workspaces.sql"
        : error.message,
    };
  }

  return { ok: true, workspace_fingerprint, registered_at: now };
}
