/** Workspace-standard identity and event primitives (MSGF “Prime” layer). */

export type SovereignUser = {
  id: string;
  global_role: "MasterAdmin" | "TenantAdmin" | "User";
  tenant_access: string[];
};

export type TenantManifestEntry = {
  id: string;
  genre: "Performance" | "Creative";
  timeline_locked: boolean;
};

/** Base shape for every audited action (tenant + actor POV + breadcrumb bag). */
export type PrimeEvent = {
  tenant_id: string;
  /** User or system identity from whose perspective the action is recorded. */
  actor_id: string;
  action_type: string;
  breadcrumb_metadata: Record<string, any>;
};
