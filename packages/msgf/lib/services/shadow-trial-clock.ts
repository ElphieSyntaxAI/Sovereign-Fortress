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
 * Distribution Build ID: MSGF-570add3d-20260922T212921Z-internal
 */
/**
 * Pure Shadow Proxy trial clock — 14-day unused expiry, 7-day window on first eval.
 */

export const SHADOW_TRIAL_HOURS = 168;
export const SHADOW_TRIAL_ACTIVATION_DAYS = 14;
export const SHADOW_TRIAL_TIER = "shadow_trial_7d";
export const SHADOW_TRIAL_CREDITS = 50_000;

export type ShadowTrialClockFields = {
  first_eval_at: string | null;
  expires_at: string;
  activation_expires_at: string | null;
  report_sent_at?: string | null;
};

export type ShadowTrialClockState = {
  awaitingFirstEval: boolean;
  unusedExpired: boolean;
  windowEnded: boolean;
  expired: boolean;
};

export function computeShadowTrialActivationExpiresAt(now: Date): Date {
  return new Date(
    now.getTime() + SHADOW_TRIAL_ACTIVATION_DAYS * 24 * 60 * 60 * 1000
  );
}

export function computeShadowTrialWindowExpiresAt(firstEvalAt: Date): Date {
  return new Date(firstEvalAt.getTime() + SHADOW_TRIAL_HOURS * 60 * 60 * 1000);
}

export function isShadowTrialLicenseTier(
  tierId: string | null | undefined
): boolean {
  return (tierId ?? "").startsWith("shadow_trial_");
}

export function isShadowTrialTenantId(
  tenantId: string | null | undefined
): boolean {
  return (tenantId ?? "").startsWith("shadow_trial_");
}

export function isShadowTrialFullAccessLive(
  fullAccessExpiresAt: string | null | undefined,
  now = Date.now()
): boolean {
  if (!fullAccessExpiresAt) return false;
  const t = new Date(fullAccessExpiresAt).getTime();
  return Number.isFinite(t) && t > now;
}

export function evaluateShadowTrialClock(
  trial: ShadowTrialClockFields,
  now = Date.now()
): ShadowTrialClockState {
  if (!trial.first_eval_at) {
    const deadline = trial.activation_expires_at ?? trial.expires_at;
    const unusedExpired = new Date(deadline).getTime() <= now;
    return {
      awaitingFirstEval: !unusedExpired,
      unusedExpired,
      windowEnded: false,
      expired: unusedExpired,
    };
  }

  const windowEnded = new Date(trial.expires_at).getTime() <= now;
  return {
    awaitingFirstEval: false,
    unusedExpired: false,
    windowEnded,
    expired: windowEnded,
  };
}

export function shouldSendShadowTrialProofReport(
  trial: ShadowTrialClockFields,
  now = Date.now()
): boolean {
  if (trial.report_sent_at) return false;
  if (!trial.first_eval_at) return false;
  return evaluateShadowTrialClock(trial, now).windowEnded;
}

export function shouldExpireUnusedShadowTrial(
  trial: ShadowTrialClockFields,
  now = Date.now()
): boolean {
  return evaluateShadowTrialClock(trial, now).unusedExpired;
}

export function resolveEffectiveGatewayMode(params: {
  requested: "shadow" | "active";
  licenseTierId?: string | null;
  tenantId?: string | null;
  fullAccessLive: boolean;
}): "shadow" | "active" {
  if (params.requested !== "active") return "shadow";
  const trialKey =
    isShadowTrialLicenseTier(params.licenseTierId) ||
    isShadowTrialTenantId(params.tenantId);
  if (!trialKey) return "active";
  return params.fullAccessLive ? "active" : "shadow";
}
