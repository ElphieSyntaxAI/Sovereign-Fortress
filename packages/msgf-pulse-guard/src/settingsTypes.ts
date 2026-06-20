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
  role: string;
  organizationId: string;
  licenseKey: string;
  entityId: string;
  smallBrainProvider: SmallBrainProvider;
  smallBrainApiKey: string;
  smallBrainModelName: string;
};
