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
 * Distribution Build ID: MSGF-e98bd4c-20260522T053721Z-internal
 */
/**
 * Logic drift scoring — routes routine pulses to Local Gateway vs Global MSGF Brain (CONVERGE).
 */

import type { PrioritizedVaultLineage } from "@/lib/services/p2-flow-roadmap";
import type { ShadowPreflightResult } from "@/lib/msgf-shadow";

/** Default escalation threshold when no sensitivity header is sent. */
export const LOGIC_DRIFT_ESCALATION_THRESHOLD = 0.3;

/** Sensitivity slider floor — stricter Brain (escalate sooner). */
export const LOGIC_DRIFT_THRESHOLD_MIN = 0.1;

/** Sensitivity slider ceiling — more relaxed local-gateway routing. */
export const LOGIC_DRIFT_THRESHOLD_MAX = 0.5;

/**
 * Pulse API header: logic-drift score above this value escalates to Global Brain (CONVERGE).
 * Lower values = stricter; higher = more relaxed. Clamped to [0.1, 0.5].
 */
export const MSGF_BRAIN_SENSITIVITY_HEADER = "x-msgf-brain-sensitivity";

/** Alias for {@link MSGF_BRAIN_SENSITIVITY_HEADER}. */
export const MSGF_DRIFT_THRESHOLD_HEADER = "x-msgf-drift-threshold";

export type LogicDriftInput = {
  pulseText: string;
  /** 0–100 HAL score from partial or full scoring. */
  halScore?: number;
  /** Biometric speed delta > 30% vs EWMA. */
  biometricDeltaOver30?: boolean;
  vaultP2Prioritized: PrioritizedVaultLineage;
  preflight: ShadowPreflightResult;
  /**
   * Escalation threshold for this pulse (sensitivity slider).
   * @default {@link LOGIC_DRIFT_ESCALATION_THRESHOLD}
   */
  escalationThreshold?: number;
};

export type LogicDriftAssessment = {
  score: number;
  contradictsP2Roadmap: boolean;
  escalateToGlobalBrain: boolean;
  /** Threshold applied for this assessment (after clamping). */
  escalation_threshold: number;
  factors: {
    vault_contradiction: number;
    shadow_tier: number;
    hal_penalty: number;
    biometric_drift: number;
    text_entropy: number;
  };
};

export function contradictsP2Roadmap(vaultP2: PrioritizedVaultLineage): boolean {
  return vaultP2.contradicts.length > 0;
}

/**
 * Clamps a sensitivity value into the allowed slider range.
 * Invalid input falls back to {@link LOGIC_DRIFT_ESCALATION_THRESHOLD}.
 */
export function resolveLogicDriftEscalationThreshold(
  value?: string | number | null
): number {
  if (value == null || value === "") {
    return LOGIC_DRIFT_ESCALATION_THRESHOLD;
  }

  const n = typeof value === "number" ? value : Number.parseFloat(String(value).trim());
  if (!Number.isFinite(n)) {
    return LOGIC_DRIFT_ESCALATION_THRESHOLD;
  }

  return Math.max(
    LOGIC_DRIFT_THRESHOLD_MIN,
    Math.min(LOGIC_DRIFT_THRESHOLD_MAX, Math.round(n * 1000) / 1000)
  );
}

export function parseLogicDriftThresholdFromHeaders(
  headers: { get(name: string): string | null }
): number {
  const raw =
    headers.get(MSGF_BRAIN_SENSITIVITY_HEADER) ??
    headers.get(MSGF_DRIFT_THRESHOLD_HEADER);
  return resolveLogicDriftEscalationThreshold(raw);
}

export function assessLogicDrift(input: LogicDriftInput): LogicDriftAssessment {
  const escalationThreshold = resolveLogicDriftEscalationThreshold(
    input.escalationThreshold
  );

  const vaultContradiction = contradictsP2Roadmap(input.vaultP2Prioritized)
    ? 0.45
    : 0;

  const shadowTier =
    input.preflight.tier === "RED"
      ? 0.35
      : input.preflight.tier === "YELLOW"
        ? 0.15
        : 0;

  const hal = input.halScore ?? 85;
  const halPenalty = hal < 70 ? 0.25 : hal < 85 ? 0.1 : 0;

  const biometricDrift = input.biometricDeltaOver30 ? 0.2 : 0;

  const text = input.pulseText.trim();
  const uniqueRatio =
    text.length > 0 ? new Set(text.toLowerCase().split(/\s+/)).size / Math.max(1, text.split(/\s+/).length) : 1;
  const textEntropy = uniqueRatio < 0.35 && text.length > 120 ? 0.12 : 0;

  const raw =
    vaultContradiction + shadowTier + halPenalty + biometricDrift + textEntropy;
  const score = Math.max(0, Math.min(1, Math.round(raw * 100) / 100));

  const contradicts = vaultContradiction > 0;
  const escalateToGlobalBrain =
    contradicts || score > escalationThreshold;

  return {
    score,
    contradictsP2Roadmap: contradicts,
    escalateToGlobalBrain,
    escalation_threshold: escalationThreshold,
    factors: {
      vault_contradiction: vaultContradiction,
      shadow_tier: shadowTier,
      hal_penalty: halPenalty,
      biometric_drift: biometricDrift,
      text_entropy: textEntropy,
    },
  };
}

export function shouldEscalateToGlobalBrain(
  assessment: LogicDriftAssessment,
  options?: { forceGlobal?: boolean }
): boolean {
  if (options?.forceGlobal) return true;
  return assessment.escalateToGlobalBrain;
}
