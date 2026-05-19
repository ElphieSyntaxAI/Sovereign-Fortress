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
 * Distribution Build ID: MSGF-2790974-20260519T053954Z-internal
 */
/**
 * Tool public JWKS for Canvas LTI 1.3 registration.
 */
import { createPrivateKey } from "crypto";

import { exportJWK } from "jose";

import { ltiToolKeyId, ltiToolPrivateKeyPem } from "@/lib/education/lti/lti-config";

let cachedJwks: { keys: Record<string, unknown>[] } | null = null;

export async function getToolPublicJwks(): Promise<{ keys: Record<string, unknown>[] }> {
  if (cachedJwks) return cachedJwks;

  const privateKey = createPrivateKey(ltiToolPrivateKeyPem());
  const jwk = await exportJWK(privateKey);
  delete jwk.d;
  delete jwk.p;
  delete jwk.q;
  delete jwk.dp;
  delete jwk.dq;
  delete jwk.qi;

  cachedJwks = {
    keys: [
      {
        ...jwk,
        kid: ltiToolKeyId(),
        alg: "RS256",
        use: "sig",
      },
    ],
  };

  return cachedJwks;
}
