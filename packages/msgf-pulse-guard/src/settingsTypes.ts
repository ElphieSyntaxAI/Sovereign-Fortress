export type SmallBrainProvider =
  | "openai"
  | "anthropic"
  | "ollama"
  | "deepseek"
  | "gemini";

export type MsgfGuardSettings = {
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
