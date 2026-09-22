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
 * Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  SMALL_BRAIN_DEFAULT,
  TENANT_PRESET_IDS,
  configFromTenantPreset,
  orderProvidersWithDefault,
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
  default_provider?: MsgfConsensusProvider;
  updated_at: string;
};

function parseDefaultProvider(value: unknown): MsgfConsensusProvider | undefined {
  const p = typeof value === "string" ? value.trim() : "";
  if (p === "anthropic" || p === "google" || p === "xai") return p;
  return undefined;
}

function rowToConfig(row: {
  profile_id: string;
  mode: string;
  providers: unknown;
  strictness: string;
  default_provider?: unknown;
}): MSGFConsensusConfig {
  const providers = Array.isArray(row.providers)
    ? (row.providers as MsgfConsensusProvider[])
    : SMALL_BRAIN_DEFAULT.providers;
  const v = validateConsensusConfig({
    mode: row.mode as MSGFConsensusConfig["mode"],
    providers,
    strictness: row.strictness as MSGFConsensusConfig["strictness"],
    profileId: row.profile_id,
    defaultProvider: parseDefaultProvider(row.default_provider),
  });
  if (!v.ok) return { ...SMALL_BRAIN_DEFAULT };
  const ordered = orderProvidersWithDefault(v.config.providers, v.config.defaultProvider);
  return { ...v.config, ...ordered };
}

export async function getTenantConsensusConfig(params: {
  admin: SupabaseClient;
  tenantId: string;
}): Promise<MSGFConsensusConfig> {
  const tid = params.tenantId.trim();
  const { data, error } = await params.admin
    .from("msgf_tenant_consensus_config")
    .select("profile_id, mode, providers, strictness, default_provider")
    .eq("tenant_id", tid)
    .maybeSingle();

  if (error) {
    const missingCol = /default_provider/i.test(error.message);
    if (missingCol) {
      const retry = await params.admin
        .from("msgf_tenant_consensus_config")
        .select("profile_id, mode, providers, strictness")
        .eq("tenant_id", tid)
        .maybeSingle();
      if (!retry.error && retry.data) return rowToConfig(retry.data);
    }
    // Table may not exist yet — soft default
    console.warn("[getTenantConsensusConfig]", error.message);
    return { ...SMALL_BRAIN_DEFAULT };
  }
  if (!data) return { ...SMALL_BRAIN_DEFAULT };
  return rowToConfig(
    data as {
      profile_id: string;
      mode: string;
      providers: unknown;
      strictness: string;
      default_provider?: unknown;
    }
  );
}

export async function upsertTenantConsensusConfig(params: {
  admin: SupabaseClient;
  tenantId: string;
  profileId: TenantConsensusPresetId;
  customProviders?: MsgfConsensusProvider[];
  defaultProvider?: MsgfConsensusProvider;
}): Promise<MSGFConsensusConfig> {
  const tid = params.tenantId.trim();
  if (!TENANT_PRESET_IDS.includes(params.profileId)) {
    throw new Error(`Invalid profileId: ${params.profileId}`);
  }
  const resolved = configFromTenantPreset(
    params.profileId,
    params.customProviders,
    params.defaultProvider
  );
  if ("error" in resolved) {
    throw new Error(resolved.error);
  }

  const row = {
    tenant_id: tid,
    profile_id: resolved.profileId ?? params.profileId,
    mode: resolved.mode,
    providers: resolved.providers,
    strictness: resolved.strictness,
    default_provider: resolved.defaultProvider ?? resolved.providers[0],
    updated_at: new Date().toISOString(),
  };
  const { error } = await params.admin
    .from("msgf_tenant_consensus_config")
    .upsert(row, { onConflict: "tenant_id" });

  if (error && /default_provider/i.test(error.message)) {
    const { default_provider: _, ...legacy } = row;
    const retry = await params.admin
      .from("msgf_tenant_consensus_config")
      .upsert(legacy, { onConflict: "tenant_id" });
    if (retry.error) {
      throw new Error(`upsertTenantConsensusConfig: ${retry.error.message}`);
    }
    return resolved;
  }

  if (error) {
    throw new Error(`upsertTenantConsensusConfig: ${error.message}`);
  }
  return resolved;
}
