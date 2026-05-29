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
 * Distribution Build ID: MSGF-3ea5d0e-20260529T033030Z-internal
 */
/**
 * OIDC state / nonce storage for LTI login (Redis hot layer).
 */
import { randomBytes } from "crypto";

import { msgfRedisKey, redisGet, redisSet } from "@/lib/redis";

const OIDC_STATE_TTL_SEC = Number(process.env.MSGF_LTI_OIDC_STATE_TTL_SEC || 600);

export type OidcStatePayload = {
  state: string;
  nonce: string;
  targetLinkUri: string;
  loginHint?: string;
  ltiMessageHint?: string;
  clientId: string;
  issuer: string;
  deploymentId: string;
  tenantId: string;
  createdAt: string;
};

function stateKey(state: string): string {
  return msgfRedisKey("lti", "oidc-state", state);
}

export function generateOidcState(): string {
  return randomBytes(24).toString("base64url");
}

export function generateOidcNonce(): string {
  return randomBytes(24).toString("base64url");
}

export async function storeOidcState(payload: OidcStatePayload): Promise<void> {
  await redisSet(stateKey(payload.state), JSON.stringify(payload), OIDC_STATE_TTL_SEC);
}

export async function consumeOidcState(state: string): Promise<OidcStatePayload | null> {
  const raw = await redisGet(stateKey(state));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OidcStatePayload;
  } catch {
    return null;
  }
}
