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
 * Distribution Build ID: MSGF-44d0906-20260522T043912Z-internal
 */
/**
 * Universal **P1 — HAL** contract (telemetry-only). Normative human doc: `../../.msgf/P1_HAL.md`.
 * Do not import Author Ecosystem–specific types here — this module is the MSGF-side universal envelope.
 *
 * Keystroke shape is aligned with `lib/P4.ts` `KeystrokeEvent` but duplicated here so consumers
 * (e.g. author-ecosystem) do not pull MSGF runtime graph into their `tsc` graph.
 */

export const P1_HAL_PILLAR_ID = "P1_HAL" as const;

/** Rhythm-layer event (matches `lib/P4.ts` — keep in sync manually). */
export type UniversalP1KeystrokeEvent = {
  ts: number;
  key: string;
  type?: "keydown" | "keyup" | "input";
  /** Optional opaque editor surface id — never a book title. */
  target?: string;
  dwellMs?: number;
  flightMs?: number;
  isBackspace?: boolean;
  isSystemEvent?: boolean;
  wordsPasted?: number;
};

/** Keys that must never appear on payloads forwarded into MSGF universal verification. */
export const P1_FORBIDDEN_AUTHOR_SPECIFIC_KEYS = [
  "book_title",
  "bookTitle",
  "manuscript_title",
  "manuscriptTitle",
  "tier_price",
  "tierPrice",
  "display_price",
  "displayPrice",
  "authorship_tier_label",
  "billing_display_name",
] as const;

/** Strict universal body fragment accepted by `/api/msgf/pulse` (rhythm / slice only). */
export type UniversalP1PulseBody = {
  keystrokes: UniversalP1KeystrokeEvent[];
  humanTieBreakerResolved?: boolean;
};

/**
 * Throws if a plain object (e.g. merged request body) contains author-marketing keys that would
 * pollute MSGF P1 telemetry semantics.
 */
export function assertP1UniversalNonPolluted(payload: Record<string, unknown>): void {
  for (const k of P1_FORBIDDEN_AUTHOR_SPECIFIC_KEYS) {
    if (k in payload && payload[k] !== undefined) {
      throw new Error(`P1 universal envelope polluted by forbidden key: ${k}`);
    }
  }
}

/**
 * Builds the pulse JSON body with **only** universal P1 fields. Drops any unknown keys.
 */
export function toUniversalP1PulseBody(input: {
  keystrokes: readonly UniversalP1KeystrokeEvent[];
  humanTieBreakerResolved?: boolean;
}): UniversalP1PulseBody {
  const o: Record<string, unknown> = {
    keystrokes: [...input.keystrokes],
  };
  if (input.humanTieBreakerResolved === true) {
    o["humanTieBreakerResolved"] = true;
  }
  assertP1UniversalNonPolluted(o);
  return o as UniversalP1PulseBody;
}
