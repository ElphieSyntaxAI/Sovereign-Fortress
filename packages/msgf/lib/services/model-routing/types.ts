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
export const CUSTOM_OPENAI_COMPATIBLE = "CUSTOM_OPENAI_COMPATIBLE" as const;
export const CUSTOM_ANTHROPIC = "CUSTOM_ANTHROPIC" as const;

export type CustomEndpointKind =
  | typeof CUSTOM_OPENAI_COMPATIBLE
  | typeof CUSTOM_ANTHROPIC;

export type CredentialMode = "api_key" | "https";

export type CustomEndpointInput = {
  providerId: string;
  displayName: string;
  baseURL: string;
  apiKey?: string;
  modelName: string;
  maxTokens: number;
  costPer1kInput: number;
  costPer1kOutput: number;
  isEcoModel: boolean;
  providerKind: CustomEndpointKind;
  /** Tenant explicitly allowlisted this host for a private VPC endpoint. */
  privateHostAllowed?: boolean;
  /** How the operator entered credentials. Defaults to api_key when a catalog URL exists. */
  credentialMode?: CredentialMode;
  /** When true, DeepSeek R1 (or other reasoning row) may run on medium drift. */
  useForReasoning?: boolean;
  /** Header style for hosted Google OpenAI-compat (Bearer vs x-goog-api-key). */
  authHeaderStyle?: "bearer" | "x-goog-api-key";
};

export type StoredCustomEndpoint = Omit<CustomEndpointInput, "apiKey"> & {
  apiKeyCipher?: string;
};

export type PublicCustomEndpoint = Omit<CustomEndpointInput, "apiKey"> & {
  apiKeyConfigured: boolean;
};

export const ECO_TRIO_SLOT_COUNT = 3;

export const ECO_TRIO_RECOMMENDED_SLOTS = ["Gemma 3", "Qwen 3", "Phi-3"] as const;

export type HostedCatalogEntry = {
  displayName: string;
  baseURL: string;
  modelName: string;
  authHeaderStyle: "bearer" | "x-goog-api-key";
  defaultCredentialMode: CredentialMode;
};

/** Hosted defaults used only in API-key mode. */
export const HOSTED_ENDPOINT_CATALOG: Record<string, HostedCatalogEntry> = {
  "Gemma 3": {
    displayName: "Gemma 3",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    modelName: "gemma-3-4b-it",
    authHeaderStyle: "bearer",
    defaultCredentialMode: "api_key",
  },
  "Qwen 3": {
    displayName: "Qwen 3",
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    modelName: "qwen3-8b",
    authHeaderStyle: "bearer",
    defaultCredentialMode: "api_key",
  },
  "DeepSeek R1": {
    displayName: "DeepSeek R1",
    baseURL: "https://api.deepseek.com/v1",
    modelName: "deepseek-reasoner",
    authHeaderStyle: "bearer",
    defaultCredentialMode: "api_key",
  },
};

const ENDPOINT_TOOLTIP =
  "Ensure the URL is publicly reachable from this gateway instance (e.g., Cloudflare Tunnel / ngrok HTTPS URLs for local Ollama, or active VPC endpoints for Vertex/Bedrock/SageMaker). Link-local and cloud metadata addresses are blocked.";

export function customEndpointTooltip(): string {
  return ENDPOINT_TOOLTIP;
}

export function publicCustomEndpoint(row: StoredCustomEndpoint): PublicCustomEndpoint {
  const { apiKeyCipher: _cipher, ...rest } = row;
  return { ...rest, apiKeyConfigured: Boolean(_cipher?.trim()) };
}

/**
 * Resolve the baseURL written on save.
 * API-key mode uses the hosted catalog when the display name matches; HTTPS mode keeps the typed URL.
 */
export function resolveEndpointBaseURL(input: {
  displayName: string;
  baseURL: string;
  credentialMode?: CredentialMode;
}): string {
  const mode = input.credentialMode ?? "https";
  if (mode === "api_key") {
    const catalog = HOSTED_ENDPOINT_CATALOG[input.displayName.trim()];
    if (catalog) return catalog.baseURL;
  }
  return input.baseURL.trim();
}

export function applyCatalogDefaults(input: CustomEndpointInput): CustomEndpointInput {
  const catalog = HOSTED_ENDPOINT_CATALOG[input.displayName.trim()];
  const credentialMode =
    input.credentialMode ?? catalog?.defaultCredentialMode ?? "https";
  const baseURL = resolveEndpointBaseURL({
    displayName: input.displayName,
    baseURL: input.baseURL,
    credentialMode,
  });
  return {
    ...input,
    credentialMode,
    baseURL,
    modelName: input.modelName.trim() || catalog?.modelName || input.modelName,
    authHeaderStyle: input.authHeaderStyle ?? catalog?.authHeaderStyle ?? "bearer",
  };
}

export function validateEcoTrioEndpoints(
  endpoints: CustomEndpointInput[]
): { ok: true } | { ok: false; error: string } {
  if (endpoints.length !== ECO_TRIO_SLOT_COUNT) {
    return { ok: false, error: "Eco Trio requires 3 eco models" };
  }
  for (const endpoint of endpoints) {
    const resolved = applyCatalogDefaults(endpoint);
    if (!resolved.isEcoModel) {
      return { ok: false, error: "Eco Trio requires isEcoModel on every slot" };
    }
    if (
      resolved.providerKind !== CUSTOM_OPENAI_COMPATIBLE &&
      resolved.providerKind !== CUSTOM_ANTHROPIC
    ) {
      return { ok: false, error: "Eco Trio slot has an unknown provider kind" };
    }
    if (!resolved.baseURL.trim() || !resolved.modelName.trim() || !resolved.providerId.trim()) {
      return { ok: false, error: "Eco Trio slot is missing baseURL, modelName, or providerId" };
    }
  }
  return { ok: true };
}

export function validateReasoningEndpoint(
  endpoint: CustomEndpointInput | null | undefined
): { ok: true; endpoint: CustomEndpointInput | null } | { ok: false; error: string } {
  if (!endpoint) return { ok: true, endpoint: null };
  const resolved = applyCatalogDefaults(endpoint);
  if (
    resolved.providerKind !== CUSTOM_OPENAI_COMPATIBLE &&
    resolved.providerKind !== CUSTOM_ANTHROPIC
  ) {
    return { ok: false, error: "Reasoning endpoint has an unknown provider kind" };
  }
  if (!resolved.baseURL.trim() || !resolved.modelName.trim() || !resolved.providerId.trim()) {
    return { ok: false, error: "Reasoning endpoint is missing baseURL, modelName, or providerId" };
  }
  return { ok: true, endpoint: resolved };
}
