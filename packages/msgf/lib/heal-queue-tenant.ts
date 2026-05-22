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
 * Distribution Build ID: MSGF-0265450-20260522T171829Z-internal
 */
import type { User } from "@supabase/supabase-js";

import { tenantIdFromSupabaseUser } from "@/src/lib/gatekeeper";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** UUID silo for GET/POST /api/msgf/heal-queue from the signed-in dashboard. */
export function resolveHealQueueTenantIdForUser(user: Pick<User, "id">): string {
  const fromMeta = tenantIdFromSupabaseUser(user as User);
  if (fromMeta && UUID_RE.test(fromMeta.trim())) {
    return fromMeta.trim().toLowerCase();
  }
  if (UUID_RE.test(user.id)) {
    return user.id.toLowerCase();
  }
  return user.id;
}
