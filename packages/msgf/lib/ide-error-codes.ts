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
