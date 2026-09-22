/** Default production MSGF host (V3.2 SaaS). */
export const DEFAULT_MSGF_API_URL = "https://elphiesgatedai.elphiesyntax.com";

/** User-facing tenant header (also mirrored to `x-msgf-tenant-id` for Pulse API). */
export const MSGF_TENANT_KEY_HEADER = "X-MSGF-Tenant-Key";

export const MSGF_TENANT_ID_HEADER = "x-msgf-tenant-id";
export const MSGF_ENTITY_ID_HEADER = "x-msgf-entity-id";
export const MSGF_IDE_PULSE_HEADER = "x-msgf-ide-pulse";

/** Explicit V3.2 operator tier from IDE settings (`msgf.role`). */
export const MSGF_ACCESS_ROLE_HEADER = "x-msgf-access-role";

/** Sandbox auto-provision: personal token without team org → company_admin on tenant silo. */
export const MSGF_FALLBACK_ROLE_HEADER = "x-msgf-fallback-role";

/** Team / company silo when the developer belongs to an organization. */
export const MSGF_ORGANIZATION_ID_HEADER = "x-msgf-organization-id";

export const MSGF_RBAC_FORBIDDEN_WARNING =
  "[MSGF Security] Permission Denied: Insufficient privileges for this tenant scope.";

/** Micro-batch flush cadence for editor telemetry. */
export const TELEMETRY_FLUSH_INTERVAL_MS = 3_000;

/** Six-pillar stoplight poll cadence. */
export const PILLAR_POLL_INTERVAL_MS = 30_000;

/** Insert length at or above this in one change → treat as block paste. */
export const PASTE_DELTA_THRESHOLD = 8;

/** Workspace BYOK — forwarded on pulse flush for tenant dual-model consensus. */
export const MSGF_BYOK_GEMINI_HEADER = "x-msgf-byok-gemini";
export const MSGF_BYOK_CLAUDE_HEADER = "x-msgf-byok-claude";

/** Local Small Brain preferences (IDE → cloud orchestration). */
export const MSGF_SMALL_BRAIN_PROVIDER_HEADER = "x-msgf-small-brain-provider";
export const MSGF_SMALL_BRAIN_MODEL_HEADER = "x-msgf-small-brain-model";
export const MSGF_SMALL_BRAIN_API_KEY_HEADER = "x-msgf-small-brain-api-key";

/** IDE vibe-coding: save-primary pulse + relaxed drift (server dev-session-profile). */
export const MSGF_DEV_SESSION_HEADER = "x-msgf-dev-session";

export const MSGF_FLUSH_REASON_HEADER = "x-msgf-flush-reason";

export const MSGF_ACTIVE_FILE_HEADER = "x-msgf-active-file";

export const MSGF_BUILD_ACTIVE_HEADER = "x-msgf-build-active";

export const MSGF_AGENT_ID_HEADER = "x-msgf-agent-id";
export const MSGF_PARENT_AGENT_ID_HEADER = "x-msgf-parent-agent-id";
export const MSGF_AGENT_ROLE_HEADER = "x-msgf-agent-role";
export const MSGF_MANDATE_HASH_HEADER = "x-msgf-mandate-hash";

/** SHA-256 of the Pulse keystroke payload. Reputation joins this; the body is unchanged. */
export const MSGF_PROMPT_HASH_HEADER = "x-msgf-prompt-hash";
