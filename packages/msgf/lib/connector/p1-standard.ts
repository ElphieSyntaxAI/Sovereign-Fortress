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
/**
 * Universal P1 envelope for cross-app MSGF Pulse dispatch.
 * Normative telemetry contract: `src/lib/universal/p1HalStandard.ts` / `.msgf/P1_HAL.md`.
 */

import {
  assertP1UniversalNonPolluted,
  type UniversalP1KeystrokeEvent,
} from "@/src/lib/universal/p1HalStandard";

export type { UniversalP1KeystrokeEvent as P1KeystrokeEvent };

/** App-agnostic Pulse body accepted by `POST /api/msgf/pulse`. */
export type P1Standard = {
  keystrokes: UniversalP1KeystrokeEvent[];
  humanTieBreakerResolved?: boolean;
  /** Operator-approved delta when clearing HITL (privacy-safe engineering summary). */
  approvedDelta?: string;
  /**
   * Per-request Brain sensitivity (logic-drift escalation threshold).
   * 0.1 = strict, 0.5 = relaxed. Sent as `x-msgf-brain-sensitivity` when using MsgfBridge.
   */
  brainSensitivity?: number;
};

export function toPulseRequestBody(payload: P1Standard): Record<string, unknown> {
  const body: Record<string, unknown> = {
    keystrokes: [...payload.keystrokes],
  };
  if (payload.humanTieBreakerResolved === true) {
    body.humanTieBreakerResolved = true;
  }
  if (payload.approvedDelta?.trim()) {
    body.approvedDelta = payload.approvedDelta.trim();
  }
  assertP1UniversalNonPolluted(body);
  return body;
}
