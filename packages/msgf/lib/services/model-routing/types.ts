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
 * Distribution Build ID: MSGF-08289e1a-20260923T172846Z-internal
 */
export const CUSTOM_OPENAI_COMPATIBLE = "CUSTOM_OPENAI_COMPATIBLE" as const;
export const CUSTOM_ANTHROPIC = "CUSTOM_ANTHROPIC" as const;

export type CustomEndpointKind =
  | typeof CUSTOM_OPENAI_COMPATIBLE
  | typeof CUSTOM_ANTHROPIC;

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
};

export type StoredCustomEndpoint = Omit<CustomEndpointInput, "apiKey"> & {
  apiKeyCipher?: string;
};

export type PublicCustomEndpoint = Omit<CustomEndpointInput, "apiKey"> & {
  apiKeyConfigured: boolean;
};

export const ECO_TRIO_SLOT_COUNT = 3;

export const ECO_TRIO_RECOMMENDED_SLOTS = ["Phi-3", "Qwen 2.5", "Mixtral"] as const;

const ENDPOINT_TOOLTIP =
  "Ensure the URL is publicly reachable from this gateway instance (e.g., Cloudflare Tunnel / ngrok HTTPS URLs for local Ollama, or active VPC endpoints for Vertex/Bedrock/SageMaker). Link-local and cloud metadata addresses are blocked.";

export function customEndpointTooltip(): string {
  return ENDPOINT_TOOLTIP;
}

export function publicCustomEndpoint(row: StoredCustomEndpoint): PublicCustomEndpoint {
  const { apiKeyCipher: _cipher, ...rest } = row;
  return { ...rest, apiKeyConfigured: Boolean(_cipher?.trim()) };
}

export function validateEcoTrioEndpoints(
  endpoints: CustomEndpointInput[]
): { ok: true } | { ok: false; error: string } {
  if (endpoints.length !== ECO_TRIO_SLOT_COUNT) {
    return { ok: false, error: "Eco Trio requires 3 eco models" };
  }
  for (const endpoint of endpoints) {
    if (!endpoint.isEcoModel) {
      return { ok: false, error: "Eco Trio requires isEcoModel on every slot" };
    }
    if (
      endpoint.providerKind !== CUSTOM_OPENAI_COMPATIBLE &&
      endpoint.providerKind !== CUSTOM_ANTHROPIC
    ) {
      return { ok: false, error: "Eco Trio slot has an unknown provider kind" };
    }
    if (!endpoint.baseURL.trim() || !endpoint.modelName.trim() || !endpoint.providerId.trim()) {
      return { ok: false, error: "Eco Trio slot is missing baseURL, modelName, or providerId" };
    }
  }
  return { ok: true };
}
