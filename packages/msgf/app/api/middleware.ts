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
/**
 * MSGF API tenant governance — `x-msgf-tenant-id` domain lock + sandbox write routing.
 *
 * Wired from the root `middleware.ts` for `/api/msgf/*`.
 */

import { NextRequest, NextResponse } from "next/server";

import { MSGF_TENANT_ID_HEADER } from "@/lib/msgf-http-headers";
import { MSGF_WRITE_TARGET_HEADER } from "@/lib/msgf-tenant-governance";
import {
  assertProductionAuthorOrigin,
  isMsgfWriteMethod,
  normalizeMsgfGovernanceTenantId,
  resolveWriteTargetHeader,
} from "@/lib/msgf-tenant-governance";

export type MsgfApiMiddlewareResult = {
  /** When set, return immediately (403, etc.). */
  response: NextResponse | null;
  /** Forward this request (headers may include sandbox write target). */
  request: NextRequest;
};

/**
 * Enforces:
 * - **PRODUCTION_AUTHOR** — Origin / Referer / Host must match `MSGF_PRODUCTION_AUTHOR_ALLOWED_ORIGINS`
 * - **DEV_TEST** — mutating methods set `x-msgf-write-target: sandbox` for downstream Hall/Vault writes
 */
export function applyMsgfApiTenantMiddleware(
  request: NextRequest
): MsgfApiMiddlewareResult {
  if (!request.nextUrl.pathname.startsWith("/api/msgf")) {
    return { response: null, request };
  }

  const tenantId = normalizeMsgfGovernanceTenantId(
    request.headers.get(MSGF_TENANT_ID_HEADER)
  );

  if (!tenantId) {
    return { response: null, request };
  }

  const originDenied = assertProductionAuthorOrigin(request, tenantId);
  if (originDenied) {
    return { response: originDenied, request };
  }

  const writeTarget = resolveWriteTargetHeader(tenantId);
  if (!writeTarget || !isMsgfWriteMethod(request.method)) {
    return { response: null, request };
  }

  const headers = new Headers(request.headers);
  headers.set(MSGF_WRITE_TARGET_HEADER, writeTarget);

  const forwarded = new NextRequest(request, { headers });

  return { response: null, request: forwarded };
}
