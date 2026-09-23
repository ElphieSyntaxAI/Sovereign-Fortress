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
 * Distribution Build ID: MSGF-fca2d532-20260923T201750Z-internal
 */
/**
 * Deploy-env helpers. Cloud Run staging and production both use NODE_ENV=production;
 * DEPLOY_ENV is the split. Fabricated dashboard/eco/signing data must never ship on
 * the production host.
 */

export function isStagingDeploy(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.DEPLOY_ENV?.trim().toLowerCase() === "staging";
}

export function isProductionDeploy(env: NodeJS.ProcessEnv = process.env): boolean {
  if (isStagingDeploy(env)) return false;
  const deploy = env.DEPLOY_ENV?.trim().toLowerCase();
  if (deploy === "production" || deploy === "prod") return true;
  return env.NODE_ENV === "production";
}

/**
 * In-memory demo streams (fake tenants, seeded eco, mock ticker). Allowed on
 * local/test and staging. Never on production Cloud Run.
 */
export function allowMockTelemetry(env: NodeJS.ProcessEnv = process.env): boolean {
  if (isProductionDeploy(env)) return false;
  const allow = env.MSGF_ALLOW_MOCK_DATA?.trim().toLowerCase();
  if (allow === "0" || allow === "false" || allow === "no") return false;
  return true;
}
