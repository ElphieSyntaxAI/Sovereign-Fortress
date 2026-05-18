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
