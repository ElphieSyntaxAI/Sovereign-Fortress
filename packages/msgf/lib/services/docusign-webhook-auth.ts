/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * DocuSign Connect auth + payload types (no imports into signing create path).
 */
import { createHmac, timingSafeEqual } from "crypto";

import { signingMockMode } from "@/lib/services/signing/resolveSigningProvider";

export type DocuSignConnectPayload = {
  event?: string;
  envelopeId?: string;
  inviteId?: string;
  data?: {
    envelopeId?: string;
    envelopeSummary?: {
      status?: string;
      recipients?: { signers?: Array<{ email?: string; status?: string }> };
    };
  };
};

export function verifyDocuSignWebhookAuth(
  request: Request,
  rawBody: string
): boolean {
  if (signingMockMode()) return true;

  const secret = process.env.MSGF_DOCUSIGN_CONNECT_SECRET?.trim();
  if (!secret) {
    const opsSecret = process.env.MSGF_OPS_CRON_SECRET?.trim();
    const auth = request.headers.get("authorization")?.trim();
    if (opsSecret && auth === `Bearer ${opsSecret}`) return true;
    return false;
  }

  const sig = request.headers.get("x-docusign-signature-1");
  if (!sig) return false;

  try {
    const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
