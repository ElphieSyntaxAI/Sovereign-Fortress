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
 * Distribution Build ID: MSGF-853c3b6-20260519T054901Z-internal
 */
/**
 * Signed HTTP-only LTI session cookie (de-identified entity context).
 */
import { createHmac, timingSafeEqual } from "crypto";

import { ltiSessionSecret } from "@/lib/education/lti/lti-config";
import type { EducationLtiPersona } from "@/lib/education/lti/lti-roles";

export const ELPHIE_LTI_SESSION_COOKIE = "elphie_lti_session";

export type LtiSessionPayload = {
  entityId: string;
  anonymousToken: string;
  tenantId: string;
  persona: EducationLtiPersona;
  deploymentId: string;
  launchId?: string;
  lineItemUrl?: string;
  resourceLinkId?: string;
  exp: number;
};

function sign(payloadB64: string): string {
  return createHmac("sha256", ltiSessionSecret())
    .update(payloadB64)
    .digest("base64url");
}

export function sealLtiSession(
  payload: Omit<LtiSessionPayload, "exp">,
  ttlSec = 28800
): string {
  const full: LtiSessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSec,
  };
  const body = Buffer.from(JSON.stringify(full), "utf8").toString("base64url");
  const sig = sign(body);
  return `${body}.${sig}`;
}

export function openLtiSession(token: string): LtiSessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = sign(body);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as LtiSessionPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
