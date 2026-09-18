export type SmallBrainProvider =
  | "openai"
  | "anthropic"
  | "ollama"
  | "deepseek"
  | "gemini";

export type MsgfGuardSettings = {
  /** When false, Pulse / .msgf scaffold / stoplight stay off (per-workspace opt-in). */
  enabled: boolean;
  productPath: string;
  tenantKey: string;
  authToken: string;
  apiUrl: string;
  devSession: boolean;
  /** A5: return local Safe Build exit immediately; sync verify-result async. */
  asyncPreflight: boolean;
  /** A5: emergency bypass — must still POST skip-audit (never silent). */
  skipMsgf: boolean;
  /** HMAC / Bearer secret for POST /api/msgf/ops/skip-audit. */
  skipAuditSecret: string;
  role: string;
  organizationId: string;
  licenseKey: string;
  entityId: string;
  smallBrainProvider: SmallBrainProvider;
  smallBrainApiKey: string;
  smallBrainModelName: string;
  /** Optional child agent id (defaults to entityId). */
  agentId: string;
  /** When set, Pulse is a secondary agent bound to this parent. */
  parentAgentId: string;
  /** `primary` | `secondary` | `system_heal`. Inferred from parentAgentId when empty. */
  agentRole: string;
  /** SHA-256 hex of the parent user mandate. Required for secondary. */
  mandateHash: string;
};
