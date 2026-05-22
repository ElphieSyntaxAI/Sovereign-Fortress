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
 * Distribution Build ID: MSGF-1013d7a-20260522T022234Z-internal
 */
/**
 * IDE workspace BYOK keys forwarded on Pulse (x-msgf-byok-gemini / x-msgf-byok-claude).
 */

import type { NextRequest } from "next/server";

import {
  MSGF_BYOK_CLAUDE_HEADER,
  MSGF_BYOK_GEMINI_HEADER,
} from "@/lib/msgf-http-headers";

export type PulseByokKeys = {
  gemini: string | null;
  anthropic: string | null;
};

export function extractPulseByokFromRequest(req: NextRequest): PulseByokKeys {
  const gemini = req.headers.get(MSGF_BYOK_GEMINI_HEADER)?.trim() || null;
  const anthropic = req.headers.get(MSGF_BYOK_CLAUDE_HEADER)?.trim() || null;
  return {
    gemini: gemini && gemini.length >= 8 ? gemini : null,
    anthropic: anthropic && anthropic.length >= 8 ? anthropic : null,
  };
}
