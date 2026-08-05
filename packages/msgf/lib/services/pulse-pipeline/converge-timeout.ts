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
 * Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
 */
import { isIdeSandboxLicense } from "@/lib/services/converge-consensus-routing";
import type { PulseLicenseContext } from "@/lib/services/pulse-license";
import { LLM_REQUEST_TIMEOUT_MS } from "@/lib/services/cost-runaway-guard";

/** Default dual-model CONVERGE wall clock (full dashboard Pulse). */
export const PULSE_CONVERGE_TIMEOUT_MS_DEFAULT = LLM_REQUEST_TIMEOUT_MS;

/** Shorter CONVERGE budget for IDE / extension onboarding (fail-open to local gateway). */
export const PULSE_CONVERGE_TIMEOUT_MS_IDE = 12_000;

export type PulseConvergeTimeoutContext = {
  isIdePulse?: boolean;
  license: PulseLicenseContext;
};

export function resolvePulseConvergeTimeoutMs(ctx: PulseConvergeTimeoutContext): number {
  const fromEnvDefault = Number(process.env.MSGF_PULSE_CONVERGE_TIMEOUT_MS);
  const fromEnvIde = Number(process.env.MSGF_PULSE_IDE_CONVERGE_TIMEOUT_MS);
  const ide =
    Boolean(ctx.isIdePulse) || isIdeSandboxLicense(ctx.license);

  if (ide) {
    return Number.isFinite(fromEnvIde) && fromEnvIde > 0
      ? fromEnvIde
      : PULSE_CONVERGE_TIMEOUT_MS_IDE;
  }
  return Number.isFinite(fromEnvDefault) && fromEnvDefault > 0
    ? fromEnvDefault
    : PULSE_CONVERGE_TIMEOUT_MS_DEFAULT;
}

export function shouldGracefulDegradeConvergeOnTimeout(
  ctx: PulseConvergeTimeoutContext
): boolean {
  return Boolean(ctx.isIdePulse) || isIdeSandboxLicense(ctx.license);
}
