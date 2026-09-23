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
import {
  createTeamComplianceEnvelope,
  isDocuSignConfigured,
} from "@/lib/services/docusign-rest";
import {
  verifyDocuSignWebhookAuth,
  type DocuSignConnectPayload,
} from "@/lib/services/docusign-webhook-auth";
import type {
  CreateSigningEnvelopeParams,
  CreateSigningEnvelopeResult,
  ParsedSigningWebhook,
  SigningProvider,
} from "@/lib/services/signing/SigningProvider";
import { signingMockMode } from "@/lib/services/signing/resolveSigningProvider";

export class DocuSignSigningProvider implements SigningProvider {
  readonly id = "docusign" as const;

  isAvailable(): boolean {
    return signingMockMode() || isDocuSignConfigured();
  }

  modeLabel(): "mock" | "live" | "unconfigured" {
    if (signingMockMode()) return "mock";
    if (isDocuSignConfigured()) return "live";
    return "unconfigured";
  }

  async createEnvelope(
    params: CreateSigningEnvelopeParams
  ): Promise<CreateSigningEnvelopeResult | null> {
    if (signingMockMode()) {
      const external_request_id = `mock-ds-${params.inviteId.slice(0, 8)}`;
      return {
        provider: "docusign",
        external_request_id,
        signing_url: `${params.returnUrl}${params.returnUrl.includes("?") ? "&" : "?"}mock_docusign=1&invite=${params.inviteId}`,
      };
    }
    if (!isDocuSignConfigured()) return null;

    const created = await createTeamComplianceEnvelope({
      signerEmail: params.email,
      signerName: params.signerName ?? params.email,
      clientUserId: params.userId,
      returnUrl: params.returnUrl,
    });
    return {
      provider: "docusign",
      external_request_id: created.envelope_id,
      signing_url: created.signing_url,
    };
  }

  verifyWebhook(rawBody: string, headers: Headers): boolean {
    const req = new Request("https://msgf.local/webhook", { method: "POST", headers, body: rawBody });
    return verifyDocuSignWebhookAuth(req, rawBody);
  }

  parseWebhook(rawBody: string, _headers: Headers): ParsedSigningWebhook | null {
    let payload: DocuSignConnectPayload;
    try {
      payload = JSON.parse(rawBody) as DocuSignConnectPayload;
    } catch {
      return null;
    }
    const event = payload.event?.toLowerCase() ?? "";
    const external_request_id =
      payload.envelopeId ?? payload.data?.envelopeId ?? null;
    const completed =
      event.includes("envelope-completed") ||
      payload.data?.envelopeSummary?.status?.toLowerCase() === "completed";
    return {
      provider: "docusign",
      event: event || "unknown",
      completed,
      external_request_id,
      invite_id: payload.inviteId ?? null,
    };
  }
}
