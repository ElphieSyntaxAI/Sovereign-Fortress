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
import { isProductionDeploy, isStagingDeploy } from "@/lib/deploy-env";

import {
  CUSTOM_ANTHROPIC,
  CUSTOM_OPENAI_COMPATIBLE,
  type CustomEndpointKind,
  type StoredCustomEndpoint,
} from "@/lib/services/model-routing/types";

export type GatewayGateSnapshot = {
  p1Pass: boolean;
  cacheHit: boolean;
  swarmAbort: boolean;
  p6Pass: boolean;
};

export function customEndpointDispatchGate(
  gates: GatewayGateSnapshot
): { ok: true } | { ok: false; reason: "p1" | "active_cache" | "p6" | "swarm_abort" } {
  if (!gates.p1Pass) return { ok: false, reason: "p1" };
  if (gates.cacheHit) return { ok: false, reason: "active_cache" };
  if (!gates.p6Pass) return { ok: false, reason: "p6" };
  if (gates.swarmAbort) return { ok: false, reason: "swarm_abort" };
  return { ok: true };
}

export function isCloudRunGateway(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.K_SERVICE?.trim()) return true;
  return isProductionDeploy(env) || isStagingDeploy(env);
}

const METADATA_HOSTS = new Set([
  "metadata.google.internal",
  "metadata.google.internal.",
  "metadata",
]);

function ipv4ToInt(host: string): number | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((part) => Number(part));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return ((nums[0]! << 24) | (nums[1]! << 16) | (nums[2]! << 8) | nums[3]!) >>> 0;
}

function inCidr(ip: number, base: number, bits: number): boolean {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ip & mask) === (base & mask);
}

export function isBlockedEndpointHost(
  hostname: string,
  options: { cloudRun: boolean; privateHostAllowed: boolean }
): string | null {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (METADATA_HOSTS.has(host)) return "metadata";
  if (host === "169.254.169.254") return "metadata";

  const v4 = ipv4ToInt(host);
  if (v4 != null && inCidr(v4, ipv4ToInt("169.254.0.0")!, 16)) return "link_local";

  const loopback =
    host === "localhost" ||
    host === "localhost.localdomain" ||
    host === "::1" ||
    host === "0:0:0:0:0:0:0:1" ||
    (v4 != null && inCidr(v4, ipv4ToInt("127.0.0.0")!, 8));
  if (loopback && options.cloudRun) return "loopback";

  const privateV4 =
    v4 != null &&
    (inCidr(v4, ipv4ToInt("10.0.0.0")!, 8) ||
      inCidr(v4, ipv4ToInt("172.16.0.0")!, 12) ||
      inCidr(v4, ipv4ToInt("192.168.0.0")!, 16));
  const privateV6 = host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80");
  if ((privateV4 || privateV6) && !options.privateHostAllowed) return "private_unlisted";
  return null;
}

export function assertSafeCustomEndpointUrl(
  raw: string,
  options: { cloudRun: boolean; privateHostAllowed: boolean }
): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("custom endpoint URL is invalid");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("custom endpoint URL must be http or https");
  }
  const blocked = isBlockedEndpointHost(url.hostname, options);
  if (blocked) {
    throw new Error(`custom endpoint blocked: ${blocked}`);
  }
  return url;
}

export function customEndpointRequestUrl(baseURL: string, kind: CustomEndpointKind): string {
  const trimmed = baseURL.replace(/\/+$/, "");
  if (kind === CUSTOM_ANTHROPIC) {
    return trimmed.endsWith("/messages") ? trimmed : `${trimmed}/messages`;
  }
  return trimmed.endsWith("/chat/completions") ? trimmed : `${trimmed}/chat/completions`;
}

export function buildCustomEndpointBody(
  kind: CustomEndpointKind,
  modelName: string,
  parsedBody: unknown
): Record<string, unknown> {
  const source =
    parsedBody && typeof parsedBody === "object" ? { ...(parsedBody as Record<string, unknown>) } : {};
  source.model = modelName;
  if (kind === CUSTOM_OPENAI_COMPATIBLE && !source.messages && source.prompt) {
    source.messages = [{ role: "user", content: source.prompt }];
  }
  return source;
}

export function buildCustomEndpointHeaders(
  kind: CustomEndpointKind,
  apiKey: string | null
): Headers {
  const headers = new Headers({ "content-type": "application/json" });
  if (!apiKey?.trim()) return headers;
  if (kind === CUSTOM_ANTHROPIC) {
    headers.set("x-api-key", apiKey);
    headers.set("anthropic-version", "2023-06-01");
  } else {
    headers.set("authorization", `Bearer ${apiKey}`);
  }
  return headers;
}

export type CustomDispatchResult = {
  response: Response;
  endpoint: StoredCustomEndpoint;
  attempted: number;
};

export async function dispatchCustomEndpoints(params: {
  gates: GatewayGateSnapshot;
  endpoints: StoredCustomEndpoint[];
  parsedBody: unknown;
  cloudRun?: boolean;
  fetchImpl?: typeof fetch;
  resolveApiKey?: (endpoint: StoredCustomEndpoint) => Promise<string | null>;
}): Promise<CustomDispatchResult> {
  const gate = customEndpointDispatchGate(params.gates);
  if (!gate.ok) {
    throw new Error(`custom endpoint blocked by gateway: ${gate.reason}`);
  }
  const fetchImpl = params.fetchImpl ?? fetch;
  const cloudRun = params.cloudRun ?? isCloudRunGateway();
  let lastResponse: Response | null = null;
  let lastEndpoint: StoredCustomEndpoint | null = null;
  let attempted = 0;

  for (const endpoint of params.endpoints) {
    assertSafeCustomEndpointUrl(endpoint.baseURL, {
      cloudRun,
      privateHostAllowed: Boolean(endpoint.privateHostAllowed),
    });
    const apiKey = params.resolveApiKey ? await params.resolveApiKey(endpoint) : null;
    const response = await fetchImpl(customEndpointRequestUrl(endpoint.baseURL, endpoint.providerKind), {
      method: "POST",
      headers: buildCustomEndpointHeaders(endpoint.providerKind, apiKey),
      body: JSON.stringify(
        buildCustomEndpointBody(endpoint.providerKind, endpoint.modelName, params.parsedBody)
      ),
    });
    attempted += 1;
    lastResponse = response;
    lastEndpoint = endpoint;
    if (response.status !== 429 && response.status < 500) {
      return { response, endpoint, attempted };
    }
  }

  if (!lastResponse || !lastEndpoint) {
    throw new Error("custom endpoint dispatch had no models");
  }
  return { response: lastResponse, endpoint: lastEndpoint, attempted };
}

export function pickScopedEcoEndpoints<T>(project: T[] | null, tenantDefault: T[]): T[] {
  return project ?? tenantDefault;
}
