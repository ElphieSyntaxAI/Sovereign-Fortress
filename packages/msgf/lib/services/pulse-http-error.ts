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
 * Distribution Build ID: MSGF-3a4c1de-20260529T200349Z-internal
 */
/** Structured early-exit for the Pulse HTTP route (gate / defend). */
export class PulseHttpError extends Error {
  readonly status: number;
  readonly body: Record<string, unknown>;

  constructor(status: number, body: Record<string, unknown>, message?: string) {
    super(message ?? (typeof body.error === "string" ? body.error : "Pulse pipeline halted"));
    this.name = "PulseHttpError";
    this.status = status;
    this.body = body;
  }
}
