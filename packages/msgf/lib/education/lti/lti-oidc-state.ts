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
