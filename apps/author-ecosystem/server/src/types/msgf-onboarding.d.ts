declare module "msgf/onboarding" {
  import type { SupabaseClient } from "@supabase/supabase-js";

  export type PlatformId = "author" | "education" | "gatedai";

  export const MSGF: {
    createPledgeBeat: (
      entityId: string,
      options?: { tenantId: string; supabase?: SupabaseClient; beatText?: string }
    ) => Promise<{ beatId: string; created: boolean }>;
    ensureMsgfPulseProfile: (input: {
      entityId: string;
      tierId: number;
      username: string;
      preferredTheme?: string;
      supabase?: SupabaseClient;
      userRole?: string;
      tenantId?: string;
    }) => Promise<void>;
    syncPlatformEntitlement: (input: {
      entityId: string;
      username: string;
      platform: PlatformId;
      persona: string;
      supabase?: SupabaseClient;
      preferredTheme?: string;
    }) => Promise<{ provisionedLicense: boolean; tenantId: string; userRole: string }>;
    bootstrapTenantBrain: (
      supabase: SupabaseClient,
      tenantId: string,
      entityId?: string
    ) => Promise<unknown>;
    ensureAuthorPulseProfile: (input: unknown) => Promise<void>;
  };

  export const bootstrapTenantBrain: typeof MSGF.bootstrapTenantBrain;
}
