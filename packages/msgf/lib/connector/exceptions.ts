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
 * Distribution Build ID: MSGF-e3b90d5-20260522T030006Z-internal
 */
/** Shared MSGF connector error surface for any host app (browser, Node, mobile WebView). */

export type MsgfErrorDetails = {
  status: number;
  code?: string;
  body: Record<string, unknown>;
};

export class MsgfBridgeException extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly body: Record<string, unknown>;

  constructor(message: string, details: MsgfErrorDetails) {
    super(message);
    this.name = "MsgfBridgeException";
    this.status = details.status;
    this.code = details.code;
    this.body = details.body;
  }
}

/** Pipeline halt, pledge/DEFEND/LOM guard, or other **403** MSGF blocks. */
export class HaltException extends MsgfBridgeException {
  constructor(message: string, details: MsgfErrorDetails) {
    super(message, details);
    this.name = "HaltException";
  }
}

/** Credits, entitlements, or contract license exhaustion (**429**). */
export class EntitlementException extends MsgfBridgeException {
  constructor(message: string, details: MsgfErrorDetails) {
    super(message, details);
    this.name = "EntitlementException";
  }
}
