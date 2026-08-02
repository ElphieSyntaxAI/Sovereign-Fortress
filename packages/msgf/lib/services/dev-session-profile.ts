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
 * Distribution Build ID: MSGF-149f647f-20260728T230931Z-internal
 */
/**
 * IDE / vibe-coding dev session — routing hints for local gateway vs CONVERGE.
 */

import {
  LOGIC_DRIFT_ESCALATION_THRESHOLD,
  LOGIC_DRIFT_THRESHOLD_MAX,
  resolveLogicDriftEscalationThreshold,
} from "@/lib/services/logic-drift";
import {
  MSGF_ACTIVE_FILE_HEADER,
  MSGF_BUILD_ACTIVE_HEADER,
  MSGF_DEV_SESSION_HEADER,
  MSGF_FLUSH_REASON_HEADER,
} from "@/lib/msgf-http-headers";

export type IdeFlushReason = "save" | "debounce" | "build_end" | "manual";

export type DevSessionHints = {
  devSession: boolean;
  buildActive: boolean;
  flushReason: IdeFlushReason | null;
  activeFilePath: string | null;
};

const EMPTY_HINTS: DevSessionHints = {
  devSession: false,
  buildActive: false,
  flushReason: null,
  activeFilePath: null,
};

function parseFlushReason(raw: string | null): IdeFlushReason | null {
  const v = raw?.trim().toLowerCase();
  if (v === "save" || v === "debounce" || v === "build_end" || v === "manual") return v;
  return null;
}

export function parseDevSessionFromHeaders(headers: {
  get(name: string): string | null;
}): DevSessionHints {
  const devSession = headers.get(MSGF_DEV_SESSION_HEADER)?.trim() === "1";
  if (!devSession) return { ...EMPTY_HINTS };

  const buildActive = headers.get(MSGF_BUILD_ACTIVE_HEADER)?.trim() === "1";
  const activeRaw = headers.get(MSGF_ACTIVE_FILE_HEADER)?.trim();
  let activeFilePath: string | null = null;
  if (activeRaw) {
    try {
      activeFilePath = decodeURIComponent(activeRaw).replace(/\\/g, "/").slice(0, 512);
    } catch {
      activeFilePath = activeRaw.replace(/\\/g, "/").slice(0, 512);
    }
  }

  return {
    devSession: true,
    buildActive,
    flushReason: parseFlushReason(headers.get(MSGF_FLUSH_REASON_HEADER)),
    activeFilePath,
  };
}

/** Dev session uses a more relaxed escalation threshold (stay on local gateway longer). */
export function resolveDevSessionEscalationThreshold(
  baseThreshold: number | undefined,
  hints: DevSessionHints
): number {
  const base = resolveLogicDriftEscalationThreshold(baseThreshold);
  if (!hints.devSession) return base;

  const bump =
    Number(process.env.MSGF_DEV_SESSION_DRIFT_RELAX?.trim()) ||
    (hints.buildActive ? 0.12 : 0.08);
  return Math.min(LOGIC_DRIFT_THRESHOLD_MAX, Math.round((base + bump) * 100) / 100);
}

export function isDevSessionDefaultEnabled(): boolean {
  const v = process.env.MSGF_DEV_SESSION_DEFAULT?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function defaultIdeConnectorDevSession(): boolean {
  return isDevSessionDefaultEnabled();
}

export type DevSessionDriftAdjustments = {
  /** Subtract from raw drift score when build is active (compiler noise). */
  buildActiveDiscount: number;
  /** Subtract when majority of keystrokes are system/paste events. */
  systemHeavyDiscount: number;
};

export function devSessionDriftAdjustments(hints: DevSessionHints): DevSessionDriftAdjustments {
  if (!hints.devSession) {
    return { buildActiveDiscount: 0, systemHeavyDiscount: 0 };
  }
  return {
    buildActiveDiscount: hints.buildActive ? 0.1 : 0,
    systemHeavyDiscount: 0,
  };
}

export function computeSystemEventRatio(
  keystrokes: readonly { isSystemEvent?: boolean }[]
): number {
  if (!keystrokes.length) return 0;
  const n = keystrokes.filter((k) => k.isSystemEvent === true).length;
  return n / keystrokes.length;
}

/** Extra discount when >50% system events (build log paste, CI output). */
export function systemHeavyDriftDiscount(ratio: number, hints: DevSessionHints): number {
  if (!hints.devSession || ratio < 0.5) return 0;
  return Math.min(0.15, 0.05 + ratio * 0.1);
}

export { LOGIC_DRIFT_ESCALATION_THRESHOLD };
