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
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */
export type SigningProviderId = "docusign" | "dropbox_sign";

export type CreateSigningEnvelopeParams = {
  inviteId: string;
  companyId: string;
  userId: string;
  email: string;
  signerName?: string;
  returnUrl: string;
};

export type CreateSigningEnvelopeResult = {
  provider: SigningProviderId;
  external_request_id: string;
  signing_url: string;
};

export type ParsedSigningWebhook = {
  provider: SigningProviderId;
  event: string;
  completed: boolean;
  external_request_id: string | null;
  invite_id: string | null;
};

export interface SigningProvider {
  readonly id: SigningProviderId;
  isAvailable(): boolean;
  modeLabel(): "mock" | "live" | "unconfigured";
  createEnvelope(params: CreateSigningEnvelopeParams): Promise<CreateSigningEnvelopeResult | null>;
  parseWebhook(rawBody: string, headers: Headers): ParsedSigningWebhook | null;
  verifyWebhook(rawBody: string, headers: Headers): boolean;
}
