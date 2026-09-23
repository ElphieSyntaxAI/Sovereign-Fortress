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
 * Distribution Build ID: MSGF-fca2d532-20260923T201750Z-internal
 */
/**
 * Actor resolution for POST /api/msgf/report-issue (IDE token / license / session).
 */

import type { NextRequest } from "next/server";

import { resolveDevEventActor } from "@/lib/services/dev-event-auth";

export async function resolveReportIssueActor(
  req: NextRequest,
  tenantKey: string
): Promise<{ admin: ReturnType<typeof import("@/utils/supabase/admin").createAdminClient>; entityId: string }> {
  return resolveDevEventActor(req, tenantKey);
}
