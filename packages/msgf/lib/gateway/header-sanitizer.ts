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
 * Upstream header allowlist + Pulse trust-header strip for sandbox routes.
 */

import type { MsgfGatewayProvider } from "@/lib/gateway/types";
import {
  MSGF_AUTO_PROMOTED_HEADER,
  MSGF_PERSONAL_SANDBOX_HEADER,
} from "@/lib/msgf-http-headers";

const UPSTREAM_ALLOWLIST = new Set([
  "accept",
  "accept-encoding",
  "accept-language",
  "content-type",
  "user-agent",
  "anthropic-version",
  "anthropic-beta",
  "openai-organization",
  "openai-project",
]);

/** Server-only trust markers — clients must never set these. */
export const SERVER_ONLY_PULSE_HEADERS = [
  MSGF_AUTO_PROMOTED_HEADER,
  MSGF_PERSONAL_SANDBOX_HEADER,
  "x-msgf-internal-bypass",
] as const;

/**
 * Build upstream OpenAI/Anthropic headers from an allowlist only.
 * Strips Cookie, Host, Authorization, and all x-msgf-* before injecting provider key.
 */
export function sanitizeUpstreamHeaders(
  reqHeaders: Headers,
  provider: MsgfGatewayProvider,
  upstreamApiKey: string
): Headers {
  const out = new Headers();
  reqHeaders.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (!UPSTREAM_ALLOWLIST.has(lower)) return;
    out.set(key, value);
  });

  if (!out.has("content-type")) {
    out.set("content-type", "application/json");
  }

  if (provider === "anthropic") {
    out.set("x-api-key", upstreamApiKey);
    if (!out.has("anthropic-version")) {
      out.set("anthropic-version", "2023-06-01");
    }
  } else {
    out.set("Authorization", `Bearer ${upstreamApiKey}`);
  }

  return out;
}

/**
 * Remove client-spoofable Pulse trust headers. Middleware re-sets after real promotion.
 */
export function stripServerOnlyPulseHeaders(reqHeaders: Headers): Headers {
  const out = new Headers(reqHeaders);
  for (const name of SERVER_ONLY_PULSE_HEADERS) {
    out.delete(name);
  }
  return out;
}
