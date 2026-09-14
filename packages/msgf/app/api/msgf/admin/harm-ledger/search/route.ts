/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
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
