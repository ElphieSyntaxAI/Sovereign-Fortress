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
 * Distribution Build ID: MSGF-51d39b5-20260516T031044Z-internal
 */
/** Client → MSGF API: project silo slug or UUID (overrides license tenant for pillar scope). */
export const MSGF_TENANT_ID_HEADER = "x-msgf-tenant-id";

/** Headless IDE / CLI: stable developer identity (machine id, extension install id, etc.). */
export const MSGF_ENTITY_ID_HEADER = "x-msgf-entity-id";

/** Marks a contract-license Pulse from {@link IdeConnector} (no browser session). */
export const MSGF_IDE_PULSE_HEADER = "x-msgf-ide-pulse";

/** Dashboard / BFF: Supabase `auth.users` id of the human operator (RBAC + audit). */
export const MSGF_OPERATOR_USER_ID_HEADER = "x-msgf-operator-user-id";

export { MSGF_WRITE_TARGET_HEADER } from "@/lib/msgf-tenant-governance";