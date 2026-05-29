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
 * Distribution Build ID: MSGF-3ea5d0e-20260529T033030Z-internal
 */
import { EntitlementException, HaltException, MsgfBridgeException } from "./exceptions";

const ENTITLEMENT_CODES = new Set([
  "ERR_CREDIT_GUARD_EXHAUSTED",
  "CREDIT_GUARD_429",
]);

const HALT_ERR_CODES = new Set([
  "ERR_RECURSION_LIMIT",
  "ERR_LICENSE_MISSING",
  "ERR_LICENSE_INVALID",
]);

function readMessage(body: Record<string, unknown>, status: number): string {
  if (typeof body.error === "string" && body.error.trim()) return body.error.trim();
  if (typeof body.message === "string" && body.message.trim()) return body.message.trim();
  return `MSGF request failed (${status})`;
}

function readCode(body: Record<string, unknown>): string | undefined {
  const raw = body.code ?? body.err;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return undefined;
}

/**
 * Maps MSGF Pulse HTTP responses into typed exceptions any frontend can catch.
 */
export function throwForMsgfPulseResponse(
  status: number,
  body: Record<string, unknown>
): never {
  const code = readCode(body);
  const message = readMessage(body, status);

  if (
    status === 429 ||
    (code && ENTITLEMENT_CODES.has(code))
  ) {
    throw new EntitlementException(message, { status, code, body });
  }

  if (status === 403 || (code && HALT_ERR_CODES.has(code))) {
    throw new HaltException(message, { status: status || 403, code, body });
  }

  throw new MsgfBridgeException(message, { status, code, body });
}
