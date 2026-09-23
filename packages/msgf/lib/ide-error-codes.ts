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
/**
 * Shared MSGF IDE connectivity error codes (extension + API).
 */
export const MSGF_IDE_ERROR_CODES = [
  "AUTH_MISSING",
  "AUTH_EXPIRED",
  "AUTH_INVALID",
  "TENANT_MISMATCH",
  "ENTITLEMENT_DENIED",
  "CREDITS_402",
  "GATEWAY_TIMEOUT",
  "GATEWAY_504",
  "DNS_UNREACHABLE",
  "NETWORK_ERROR",
  "SERVER_ERROR",
  "UNKNOWN",
] as const;

export type MsgfIdeErrorCode = (typeof MSGF_IDE_ERROR_CODES)[number];

export type IdeConnectivityCheckResult = {
  name: string;
  ok: boolean;
  status?: number;
  latency_ms?: number;
  error_code?: MsgfIdeErrorCode;
  user_message?: string;
  fix_steps?: string[];
};

export type IdeConnectivityResponse = {
  ok: boolean;
  checks: IdeConnectivityCheckResult[];
};
