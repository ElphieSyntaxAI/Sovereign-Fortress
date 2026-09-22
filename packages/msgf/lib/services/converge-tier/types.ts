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
 * Distribution Build ID: MSGF-191e80fa-20260921T055901Z-internal
 */
export const CONVERGE_TIERS = ["TIER_1", "TIER_2", "TIER_3"] as const;
export type ConvergeTier = (typeof CONVERGE_TIERS)[number];

export type CodeDeltaPayload = {
  /** Normalized repo-relative paths touched by the delta. */
  paths: string[];
  linesAdded?: number;
  linesModified?: number;
  linesDeleted?: number;
  /** Optional diff snippet for classifier heuristics. */
  diffSnippet?: string;
  companyId?: string | null;
  projectOrigin?: string | null;
};

export type ClassifierResult = {
  tier: ConvergeTier;
  riskScore: number;
  reasons: string[];
  /** Wall-clock classifier duration (ms). */
  durationMs: number;
};

export type ConvergeModelPair = {
  tier: ConvergeTier;
  modelA: { provider: "openai" | "anthropic" | "google"; modelId: string };
  modelB: { provider: "openai" | "anthropic" | "google"; modelId: string };
};

export type TierConvergeAttempt = {
  tier: ConvergeTier;
  modelA: string;
  modelB: string;
  agreementScore: number;
  agreed: boolean;
};

export type TierConvergeOk = {
  ok: true;
  finalTier: ConvergeTier;
  agreementScore: number;
  resolution: string;
  attempts: TierConvergeAttempt[];
  escalated: boolean;
};

export type TierConvergeErr = {
  ok: false;
  error: string;
  finalTier: ConvergeTier;
  attempts: TierConvergeAttempt[];
  hitlRequired: true;
  quarantineRecommended: boolean;
};

export type TierConvergeResult = TierConvergeOk | TierConvergeErr;
