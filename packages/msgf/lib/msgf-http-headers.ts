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
 * Distribution Build ID: MSGF-2790974-20260519T053954Z-internal
 */
/** Client → MSGF API: project silo slug or UUID (overrides license tenant for pillar scope). */
export const MSGF_TENANT_ID_HEADER = "x-msgf-tenant-id";

/** IDE / BFF canonical tenant key (mirrored to {@link MSGF_TENANT_ID_HEADER}). */
export const MSGF_TENANT_KEY_HEADER = "X-MSGF-Tenant-Key";

/** Personal-token sandbox: grant company-admin scope on individual tenant silo. */
export const MSGF_FALLBACK_ROLE_HEADER = "x-msgf-fallback-role";

/** Explicit V3.2 operator tier from IDE (`global_admin` | `company_admin` | `dev`). */
export const MSGF_ACCESS_ROLE_HEADER = "x-msgf-access-role";

/** Team / company organization bound to the tenant key. */
export const MSGF_ORGANIZATION_ID_HEADER = "x-msgf-organization-id";

/** Trusted marker: independent developer promoted to personal sandbox (set by middleware only). */
export const MSGF_PERSONAL_SANDBOX_HEADER = "x-msgf-personal-sandbox";

/** Trusted marker: access role was elevated server-side after profile validation. */
export const MSGF_AUTO_PROMOTED_HEADER = "x-msgf-auto-promoted";

/** IDE `.msgf/keys/gemini.key` — tenant Gemini BYOK for dual-model consensus. */
export const MSGF_BYOK_GEMINI_HEADER = "x-msgf-byok-gemini";

/** IDE `.msgf/keys/claude.key` — tenant Anthropic BYOK for dual-model consensus. */
export const MSGF_BYOK_CLAUDE_HEADER = "x-msgf-byok-claude";

/** CONVERGE allowance state echoed to IDE (e.g. `soft_cap_exceeded`). */
export const MSGF_ALLOWANCE_STATE_HEADER = "x-msgf-allowance-state";

export const MSGF_SMALL_BRAIN_PROVIDER_HEADER = "x-msgf-small-brain-provider";
export const MSGF_SMALL_BRAIN_MODEL_HEADER = "x-msgf-small-brain-model";
export const MSGF_SMALL_BRAIN_API_KEY_HEADER = "x-msgf-small-brain-api-key";

/** Headless IDE / CLI: stable developer identity (machine id, extension install id, etc.). */
export const MSGF_ENTITY_ID_HEADER = "x-msgf-entity-id";

/** Marks a contract-license Pulse from {@link IdeConnector} (no browser session). */
export const MSGF_IDE_PULSE_HEADER = "x-msgf-ide-pulse";

/** Dashboard / BFF: Supabase `auth.users` id of the human operator (RBAC + audit). */
export const MSGF_OPERATOR_USER_ID_HEADER = "x-msgf-operator-user-id";

export { MSGF_WRITE_TARGET_HEADER } from "@/lib/msgf-tenant-governance";