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
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  SMALL_BRAIN_DEFAULT,
  TENANT_PRESET_IDS,
  configFromTenantPreset,
  type MSGFConsensusConfig,
  type MsgfConsensusProvider,
  type TenantConsensusPresetId,
  validateConsensusConfig,
} from "@/lib/services/consensus/msgf-consensus-config";

export type TenantConsensusConfigRow = {
  tenant_id: string;
  profile_id: string;
  mode: string;
  providers: MsgfConsensusProvider[];
  strictness: string;
  updated_at: string;
};

function rowToConfig(row: {
  profile_id: string;
  mode: string;
  providers: unknown;
  strictness: string;
}): MSGFConsensusConfig {
  const providers = Array.isArray(row.providers)
    ? (row.providers as MsgfConsensusProvider[])
    : SMALL_BRAIN_DEFAULT.providers;
  const v = validateConsensusConfig({
    mode: row.mode as MSGFConsensusConfig["mode"],
    providers,
    strictness: row.strictness as MSGFConsensusConfig["strictness"],
    profileId: row.profile_id,
  });
  return v.ok ? v.config : { ...SMALL_BRAIN_DEFAULT };
}

export async function getTenantConsensusConfig(params: {
  admin: SupabaseClient;
  tenantId: string;
}): Promise<MSGFConsensusConfig> {
  const tid = params.tenantId.trim();
  const { data, error } = await params.admin
    .from("msgf_tenant_consensus_config")
    .select("profile_id, mode, providers, strictness")
    .eq("tenant_id", tid)
    .maybeSingle();

  if (error) {
    // Table may not exist yet — soft default
    console.warn("[getTenantConsensusConfig]", error.message);
    return { ...SMALL_BRAIN_DEFAULT };
  }
  if (!data) return { ...SMALL_BRAIN_DEFAULT };
  return rowToConfig(data as { profile_id: string; mode: string; providers: unknown; strictness: string });
}

export async function upsertTenantConsensusConfig(params: {
  admin: SupabaseClient;
  tenantId: string;
  profileId: TenantConsensusPresetId;
  customProviders?: MsgfConsensusProvider[];
}): Promise<MSGFConsensusConfig> {
  const tid = params.tenantId.trim();
  if (!TENANT_PRESET_IDS.includes(params.profileId)) {
    throw new Error(`Invalid profileId: ${params.profileId}`);
  }
  const resolved = configFromTenantPreset(params.profileId, params.customProviders);
  if ("error" in resolved) {
    throw new Error(resolved.error);
  }

  const { error } = await params.admin.from("msgf_tenant_consensus_config").upsert(
    {
      tenant_id: tid,
      profile_id: resolved.profileId ?? params.profileId,
      mode: resolved.mode,
      providers: resolved.providers,
      strictness: resolved.strictness,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id" }
  );

  if (error) {
    throw new Error(`upsertTenantConsensusConfig: ${error.message}`);
  }
  return resolved;
}
