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
 * Distribution Build ID: MSGF-0265450-20260522T171829Z-internal
 */
/**
 * LTI 1.3 id_token verification (platform JWKS) + tool client assertion for AGS.
 */
import { createPrivateKey, randomUUID } from "crypto";

import {
  SignJWT,
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
} from "jose";

import type { LtiDeploymentConfig } from "@/lib/education/lti/lti-config";
import {
  ltiToolKeyId,
  ltiToolPrivateKeyPem,
} from "@/lib/education/lti/lti-config";

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getPlatformJwks(jwksUrl: string) {
  let set = jwksCache.get(jwksUrl);
  if (!set) {
    set = createRemoteJWKSet(new URL(jwksUrl));
    jwksCache.set(jwksUrl, set);
  }
  return set;
}

export type VerifiedLtiIdToken = JWTPayload & {
  sub: string;
  [key: string]: unknown;
};

export async function verifyPlatformIdToken(params: {
  idToken: string;
  deployment: LtiDeploymentConfig;
  expectedNonce: string;
}): Promise<VerifiedLtiIdToken> {
  const jwks = getPlatformJwks(params.deployment.platformJwksUrl);

  const { payload } = await jwtVerify(params.idToken, jwks, {
    issuer: params.deployment.issuer,
    audience: params.deployment.clientId,
  });

  if (payload.nonce !== params.expectedNonce) {
    throw new Error("LTI id_token nonce mismatch.");
  }

  const deploymentClaim = payload["https://purl.imsglobal.org/spec/lti/claim/deployment_id"];
  if (
    deploymentClaim &&
    String(deploymentClaim) !== params.deployment.deploymentId
  ) {
    throw new Error("LTI deployment_id mismatch.");
  }

  return payload as VerifiedLtiIdToken;
}

export async function signToolClientAssertion(params: {
  deployment: LtiDeploymentConfig;
  scope: string;
}): Promise<string> {
  const privateKey = createPrivateKey(ltiToolPrivateKeyPem());
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({ scope: params.scope })
    .setProtectedHeader({ alg: "RS256", kid: ltiToolKeyId(), typ: "JWT" })
    .setIssuer(params.deployment.clientId)
    .setSubject(params.deployment.clientId)
    .setAudience(params.deployment.platformTokenUrl)
    .setJti(randomUUID())
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(privateKey);
}
