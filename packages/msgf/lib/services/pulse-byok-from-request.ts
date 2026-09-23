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
/**
 * IDE workspace BYOK keys forwarded on Pulse (gemini / claude / xai).
 */

import type { NextRequest } from "next/server";

import {
  MSGF_BYOK_CLAUDE_HEADER,
  MSGF_BYOK_GEMINI_HEADER,
  MSGF_BYOK_XAI_HEADER,
} from "@/lib/msgf-http-headers";

export type PulseByokKeys = {
  gemini: string | null;
  anthropic: string | null;
  xai: string | null;
};

export function extractPulseByokFromRequest(req: NextRequest): PulseByokKeys {
  const gemini = req.headers.get(MSGF_BYOK_GEMINI_HEADER)?.trim() || null;
  const anthropic = req.headers.get(MSGF_BYOK_CLAUDE_HEADER)?.trim() || null;
  const xai = req.headers.get(MSGF_BYOK_XAI_HEADER)?.trim() || null;
  return {
    gemini: gemini && gemini.length >= 8 ? gemini : null,
    anthropic: anthropic && anthropic.length >= 8 ? anthropic : null,
    xai: xai && xai.length >= 8 ? xai : null,
  };
}
