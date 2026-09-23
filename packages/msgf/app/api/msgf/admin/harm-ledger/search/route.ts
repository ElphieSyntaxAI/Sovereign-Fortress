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
 * GET /api/msgf/admin/harm-ledger/search — alias for prompt-sessions?harm_only=1
 */

import { NextRequest } from "next/server";

import {
  GET as promptSessionsGet,
  OPTIONS,
} from "@/app/api/msgf/admin/prompt-sessions/search/route";

export { OPTIONS };

export async function GET(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.searchParams.set("harm_only", "1");
  const forwarded = new NextRequest(url, req);
  return promptSessionsGet(forwarded);
}
