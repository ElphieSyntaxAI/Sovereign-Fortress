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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
import { createHmac, timingSafeEqual } from "crypto";

import type {
  CreateSigningEnvelopeParams,
  CreateSigningEnvelopeResult,
  ParsedSigningWebhook,
  SigningProvider,
} from "@/lib/services/signing/SigningProvider";
import { signingMockMode } from "@/lib/services/signing/resolveSigningProvider";

function dropboxSignApiKey(): string | null {
  return process.env.DROPBOX_SIGN_API_KEY?.trim() || null;
}

export class DropboxSignSigningProvider implements SigningProvider {
  readonly id = "dropbox_sign" as const;

  isAvailable(): boolean {
    return signingMockMode() || Boolean(dropboxSignApiKey());
  }

  modeLabel(): "mock" | "live" | "unconfigured" {
    if (signingMockMode()) return "mock";
    if (dropboxSignApiKey()) return "live";
    return "unconfigured";
  }

  async createEnvelope(
    params: CreateSigningEnvelopeParams
  ): Promise<CreateSigningEnvelopeResult | null> {
    if (signingMockMode()) {
      const external_request_id = `mock-dbs-${params.inviteId.slice(0, 8)}`;
      return {
        provider: "dropbox_sign",
        external_request_id,
        signing_url: `${params.returnUrl}${params.returnUrl.includes("?") ? "&" : "?"}mock_dropbox_sign=1&invite=${params.inviteId}`,
      };
    }

    const apiKey = dropboxSignApiKey();
    if (!apiKey) return null;

    // Live Dropbox Sign embedded request (minimal). Failures return null so invite can skip.
    try {
      const auth = Buffer.from(`${apiKey}:`).toString("base64");
      const res = await fetch("https://api.hellosign.com/v3/signature_request/send", {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "MSGF security policy sign-off",
          subject: "Please review and sign MSGF onboarding policies",
          message: "Complete this signature to unlock your MSGF IDE workspace.",
          signers: [{ email_address: params.email, name: params.signerName ?? params.email }],
          metadata: { invite_id: params.inviteId, company_id: params.companyId, user_id: params.userId },
          test_mode: process.env.DROPBOX_SIGN_TEST_MODE === "1" ? 1 : 0,
        }),
      });
      if (!res.ok) {
        console.warn("[dropbox-sign] create failed", res.status, await res.text().catch(() => ""));
        return null;
      }
      const json = (await res.json()) as {
        signature_request?: { signature_request_id?: string; signing_url?: string };
      };
      const id = json.signature_request?.signature_request_id;
      if (!id) return null;
      return {
        provider: "dropbox_sign",
        external_request_id: id,
        signing_url:
          json.signature_request?.signing_url ||
          `https://app.hellosign.com/editor/embeddedSign?signature_request_id=${id}`,
      };
    } catch (e) {
      console.warn("[dropbox-sign] create error", e);
      return null;
    }
  }

  verifyWebhook(rawBody: string, headers: Headers): boolean {
    if (signingMockMode()) return true;
    const secret = process.env.DROPBOX_SIGN_WEBHOOK_SECRET?.trim();
    if (!secret) {
      const ops = process.env.MSGF_OPS_CRON_SECRET?.trim();
      const auth = headers.get("authorization")?.trim();
      return Boolean(ops && auth === `Bearer ${ops}`);
    }
    const sig = headers.get("x-dropbox-signature") || headers.get("x-hellosign-signature");
    if (!sig) return false;
    try {
      const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
      const a = Buffer.from(sig);
      const b = Buffer.from(expected);
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  parseWebhook(rawBody: string, _headers: Headers): ParsedSigningWebhook | null {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return null;
    }

    // Dropbox Sign often wraps JSON in event / event_hash or sends form-encoded; support JSON body.
    const eventObj =
      payload.event && typeof payload.event === "object"
        ? (payload.event as Record<string, unknown>)
        : payload;
    const eventType = String(
      eventObj.event_type ?? eventObj.type ?? payload.event_type ?? ""
    ).toLowerCase();
    const completed =
      eventType.includes("signature_request_all_signed") ||
      eventType.includes("signature_request_signed") ||
      eventType === "callback_test";

    const sr =
      (payload.signature_request as Record<string, unknown> | undefined) ||
      (eventObj.signature_request as Record<string, unknown> | undefined);
    const external_request_id =
      (typeof sr?.signature_request_id === "string" ? sr.signature_request_id : null) ||
      (typeof payload.signature_request_id === "string" ? payload.signature_request_id : null);

    const meta = (sr?.metadata as Record<string, unknown> | undefined) || {};
    const invite_id =
      typeof meta.invite_id === "string"
        ? meta.invite_id
        : typeof payload.invite_id === "string"
          ? payload.invite_id
          : null;

    return {
      provider: "dropbox_sign",
      event: eventType || "unknown",
      completed,
      external_request_id,
      invite_id,
    };
  }
}
