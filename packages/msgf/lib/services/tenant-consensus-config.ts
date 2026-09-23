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
 * Distribution Build ID: MSGF-fca2d532-20260923T201750Z-internal
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { CryptoService } from "@/lib/crypto/CryptoService";
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
import {
  applyCatalogDefaults,
  publicCustomEndpoint,
  validateEcoTrioEndpoints,
  validateReasoningEndpoint,
  type CustomEndpointInput,
  type StoredCustomEndpoint,
} from "@/lib/services/model-routing/types";

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

const SELECT_COLUMNS =
  "profile_id, mode, providers, strictness, default_provider, custom_eco_endpoints, custom_reasoning_endpoint";

function asProviders(value: unknown): MsgfConsensusProvider[] {
  if (!Array.isArray(value)) return [...SMALL_BRAIN_DEFAULT.providers];
  const providers: MsgfConsensusProvider[] = [];
  for (const item of value) {
    if (item === "anthropic" || item === "google" || item === "xai") providers.push(item);
  }
  return providers.length ? providers : [...SMALL_BRAIN_DEFAULT.providers];
}

function parseStoredEcoEndpoints(value: unknown): StoredCustomEndpoint[] {
  if (!Array.isArray(value)) return [];
  const rows: StoredCustomEndpoint[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as StoredCustomEndpoint;
    if (!row.providerId || !row.baseURL || !row.modelName) continue;
    rows.push(row);
  }
  return rows;
}

function parseStoredReasoningEndpoint(value: unknown): StoredCustomEndpoint | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as StoredCustomEndpoint;
  if (!row.providerId || !row.baseURL || !row.modelName) return null;
  return row;
}

export function consensusConfigFromStoredRow(row: {
  profile_id: string;
  mode: string;
  providers: unknown;
  strictness: string;
  default_provider?: unknown;
  custom_eco_endpoints?: unknown;
  custom_reasoning_endpoint?: unknown;
}): MSGFConsensusConfig {
  const providers = asProviders(row.providers);
  const reasoning = parseStoredReasoningEndpoint(row.custom_reasoning_endpoint);
  const reasoningPublic = reasoning ? publicCustomEndpoint(reasoning) : null;
  if (row.profile_id === "eco_trio") {
    return {
      mode: "TRI",
      providers,
      strictness: "MAJORITY",
      profileId: "eco_trio",
      defaultProvider: parseDefaultProvider(row.default_provider) ?? "google",
      customEcoEndpoints: parseStoredEcoEndpoints(row.custom_eco_endpoints).map(publicCustomEndpoint),
      customReasoningEndpoint: reasoningPublic,
    };
  }
  const v = validateConsensusConfig({
    mode: row.mode as MSGFConsensusConfig["mode"],
    providers,
    strictness: row.strictness as MSGFConsensusConfig["strictness"],
    profileId: row.profile_id,
    defaultProvider: parseDefaultProvider(row.default_provider),
  });
  if (!v.ok) return { ...SMALL_BRAIN_DEFAULT };
  const ordered = orderProvidersWithDefault(v.config.providers, v.config.defaultProvider);
  return {
    ...v.config,
    ...ordered,
    customReasoningEndpoint: reasoningPublic,
  };
}

function rowToConfig(row: {
  profile_id: string;
  mode: string;
  providers: unknown;
  strictness: string;
  default_provider?: unknown;
  custom_eco_endpoints?: unknown;
}): MSGFConsensusConfig {
  return consensusConfigFromStoredRow(row);
}

export async function readStoredEcoEndpointsForScope(params: {
  admin: SupabaseClient;
  tenantId: string;
  projectOrigin?: string;
}): Promise<StoredCustomEndpoint[]> {
  const tid = params.tenantId.trim();
  const origin = params.projectOrigin?.trim() ?? "";
  const load = async (projectOrigin: string) => {
    const row = await params.admin
      .from("msgf_tenant_consensus_config")
      .select("profile_id, custom_eco_endpoints")
      .eq("tenant_id", tid)
      .eq("project_origin", projectOrigin)
      .maybeSingle();
    if (row.error || !row.data) return null;
    if (row.data.profile_id !== "eco_trio") return [];
    return parseStoredEcoEndpoints(row.data.custom_eco_endpoints);
  };
  if (origin) {
    const project = await load(origin);
    if (project && project.length) return project;
    if (project && project.length === 0) {
      const scoped = await params.admin
        .from("msgf_tenant_consensus_config")
        .select("profile_id")
        .eq("tenant_id", tid)
        .eq("project_origin", origin)
        .maybeSingle();
      if (!scoped.error && scoped.data?.profile_id === "eco_trio") return [];
    }
  }
  return (await load("")) ?? [];
}

export async function readStoredReasoningEndpointForScope(params: {
  admin: SupabaseClient;
  tenantId: string;
  projectOrigin?: string;
}): Promise<StoredCustomEndpoint | null> {
  const tid = params.tenantId.trim();
  const origin = params.projectOrigin?.trim() ?? "";
  const load = async (projectOrigin: string) => {
    const row = await params.admin
      .from("msgf_tenant_consensus_config")
      .select("custom_reasoning_endpoint")
      .eq("tenant_id", tid)
      .eq("project_origin", projectOrigin)
      .maybeSingle();
    if (row.error || !row.data) return null;
    return parseStoredReasoningEndpoint(row.data.custom_reasoning_endpoint);
  };
  if (origin) {
    const project = await load(origin);
    if (project) return project;
  }
  return (await load("")) ?? null;
}

export async function getTenantConsensusConfig(params: {
  admin: SupabaseClient;
  tenantId: string;
  projectOrigin?: string;
}): Promise<MSGFConsensusConfig> {
  const tid = params.tenantId.trim();
  const origin = params.projectOrigin?.trim() ?? "";
  const projectRow = origin ? await readConsensusRow(params.admin, tid, origin) : null;
  if (projectRow) return projectRow;
  const fallback = await readConsensusRow(params.admin, tid, "");
  return fallback ?? { ...SMALL_BRAIN_DEFAULT };
}

async function readConsensusRow(
  admin: SupabaseClient,
  tenantId: string,
  projectOrigin: string
): Promise<MSGFConsensusConfig | null> {
  const scoped = await admin
    .from("msgf_tenant_consensus_config")
    .select(SELECT_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("project_origin", projectOrigin)
    .maybeSingle();

  if (scoped.error && /project_origin/i.test(scoped.error.message) && projectOrigin === "") {
    const legacy = await admin
      .from("msgf_tenant_consensus_config")
      .select("profile_id, mode, providers, strictness, default_provider")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!legacy.error && legacy.data) return rowToConfig(legacy.data);
    return null;
  }
  if (scoped.error && /custom_eco_endpoints|custom_reasoning_endpoint/i.test(scoped.error.message)) {
    const retry = await admin
      .from("msgf_tenant_consensus_config")
      .select("profile_id, mode, providers, strictness, default_provider")
      .eq("tenant_id", tenantId)
      .eq("project_origin", projectOrigin)
      .maybeSingle();
    if (!retry.error && retry.data) return rowToConfig(retry.data);
    return null;
  }
  if (scoped.error && /default_provider/i.test(scoped.error.message)) {
    const retry = await admin
      .from("msgf_tenant_consensus_config")
      .select("profile_id, mode, providers, strictness")
      .eq("tenant_id", tenantId)
      .eq("project_origin", projectOrigin)
      .maybeSingle();
    if (!retry.error && retry.data) return rowToConfig(retry.data);
    return null;
  }
  if (scoped.error) {
    console.warn("[getTenantConsensusConfig]", scoped.error.message);
    return null;
  }
  if (!scoped.data) return null;
  return rowToConfig(scoped.data);
}

async function encryptEcoEndpoints(
  endpoints: CustomEndpointInput[] | undefined,
  previous: StoredCustomEndpoint[]
): Promise<StoredCustomEndpoint[] | null> {
  if (!endpoints) return null;
  const normalized = endpoints.map(applyCatalogDefaults);
  const check = validateEcoTrioEndpoints(normalized);
  if (!check.ok) throw new Error(check.error);
  const stored: StoredCustomEndpoint[] = [];
  for (const endpoint of normalized) {
    const prior = previous.find((row) => row.providerId === endpoint.providerId);
    let apiKeyCipher = prior?.apiKeyCipher;
    if (endpoint.apiKey?.trim()) {
      apiKeyCipher = await CryptoService.encryptKey(endpoint.apiKey.trim());
    }
    const { apiKey: _plain, ...rest } = endpoint;
    stored.push({ ...rest, apiKeyCipher });
  }
  return stored;
}

async function encryptReasoningEndpoint(
  endpoint: CustomEndpointInput | null | undefined,
  previous: StoredCustomEndpoint | null
): Promise<StoredCustomEndpoint | null | undefined> {
  if (endpoint === undefined) return undefined;
  if (endpoint === null) return null;
  const check = validateReasoningEndpoint(endpoint);
  if (!check.ok) throw new Error(check.error);
  if (!check.endpoint) return null;
  const resolved = check.endpoint;
  let apiKeyCipher = previous?.apiKeyCipher;
  if (resolved.apiKey?.trim()) {
    apiKeyCipher = await CryptoService.encryptKey(resolved.apiKey.trim());
  }
  const { apiKey: _plain, ...rest } = resolved;
  return { ...rest, apiKeyCipher };
}

export async function upsertTenantConsensusConfig(params: {
  admin: SupabaseClient;
  tenantId: string;
  profileId: TenantConsensusPresetId;
  customProviders?: MsgfConsensusProvider[];
  defaultProvider?: MsgfConsensusProvider;
  projectOrigin?: string;
  ecoEndpoints?: CustomEndpointInput[];
  reasoningEndpoint?: CustomEndpointInput | null;
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

  const origin = params.projectOrigin?.trim() ?? "";
  let customEco: StoredCustomEndpoint[] | null = null;
  if (params.profileId === "eco_trio") {
    const existing = await params.admin
      .from("msgf_tenant_consensus_config")
      .select("custom_eco_endpoints, custom_reasoning_endpoint")
      .eq("tenant_id", tid)
      .eq("project_origin", origin)
      .maybeSingle();
    const previous = parseStoredEcoEndpoints(existing.data?.custom_eco_endpoints);
    customEco = await encryptEcoEndpoints(params.ecoEndpoints, previous);
  }

  const existingReasoning = await params.admin
    .from("msgf_tenant_consensus_config")
    .select("custom_reasoning_endpoint")
    .eq("tenant_id", tid)
    .eq("project_origin", origin)
    .maybeSingle();
  const priorReasoning = parseStoredReasoningEndpoint(
    existingReasoning.data?.custom_reasoning_endpoint
  );
  const reasoningStored = await encryptReasoningEndpoint(
    params.reasoningEndpoint,
    priorReasoning
  );

  const row: Record<string, unknown> = {
    tenant_id: tid,
    project_origin: origin,
    profile_id: resolved.profileId ?? params.profileId,
    mode: resolved.mode,
    providers: resolved.providers,
    strictness: resolved.strictness,
    default_provider: params.profileId === "eco_trio" ? "google" : resolved.defaultProvider ?? resolved.providers[0],
    updated_at: new Date().toISOString(),
  };
  if (params.profileId === "eco_trio") {
    row.custom_eco_endpoints = customEco;
  }
  if (reasoningStored !== undefined) {
    row.custom_reasoning_endpoint = reasoningStored;
  }
  const { error } = await params.admin
    .from("msgf_tenant_consensus_config")
    .upsert(row, { onConflict: "tenant_id,project_origin" });

  if (error && /project_origin/i.test(error.message)) {
    const { project_origin: _origin, ...legacy } = row;
    const retry = await params.admin
      .from("msgf_tenant_consensus_config")
      .upsert(legacy, { onConflict: "tenant_id" });
    if (retry.error) {
      throw new Error(`upsertTenantConsensusConfig: ${retry.error.message}`);
    }
    return resolved;
  }

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

  if (error && /custom_reasoning_endpoint/i.test(error.message)) {
    const { custom_reasoning_endpoint: _, ...legacy } = row;
    const retry = await params.admin
      .from("msgf_tenant_consensus_config")
      .upsert(legacy, { onConflict: "tenant_id,project_origin" });
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
