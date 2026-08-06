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
 * Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
 */
/**
 * MSGF API tenant governance — personal sandbox promotion, domain lock, sandbox writes.
 *
 * Wired from the root `middleware.ts` for `/api/msgf/*`.
 */

import { NextRequest, NextResponse } from "next/server";

import { applyIndividualTenantPromotion } from "@/lib/middleware/individual-tenant-promotion";
import { stripServerOnlyPulseHeaders } from "@/lib/gateway/header-sanitizer";
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
  /** Forward this request (headers may include sandbox write target + promotion). */
  request: NextRequest;
};

/**
 * Enforces:
 * - **Strip spoofable Pulse trust headers** before promotion
 * - **Independent developers** — `tenant-indiv-{userId}` + `company_admin` inside personal sandbox only
 * - **PRODUCTION_AUTHOR** — Origin / Referer / Host must match `MSGF_PRODUCTION_AUTHOR_ALLOWED_ORIGINS`
 * - **DEV_TEST / personal sandbox** — mutating methods set `x-msgf-write-target: sandbox`
 */
export async function applyMsgfApiTenantMiddleware(
  request: NextRequest
): Promise<MsgfApiMiddlewareResult> {
  if (!request.nextUrl.pathname.startsWith("/api/msgf")) {
    return { response: null, request };
  }

  if (request.nextUrl.pathname === "/api/msgf/admin/author-handoff") {
    return { response: null, request };
  }

  // Never trust client-supplied Pulse promotion markers.
  const strippedHeaders = stripServerOnlyPulseHeaders(request.headers);
  const strippedRequest = new NextRequest(request, { headers: strippedHeaders });

  const promotion = await applyIndividualTenantPromotion(strippedRequest);
  if (promotion.response) {
    return { response: promotion.response, request };
  }
  let req = promotion.request;

  const tenantId = normalizeMsgfGovernanceTenantId(
    req.headers.get(MSGF_TENANT_ID_HEADER) ||
      req.headers.get("X-MSGF-Tenant-Key")
  );

  if (!tenantId) {
    return { response: null, request: req };
  }

  const originDenied = assertProductionAuthorOrigin(req, tenantId);
  if (originDenied) {
    return { response: originDenied, request: req };
  }

  const writeTarget = resolveWriteTargetHeader(tenantId);
  if (!writeTarget || !isMsgfWriteMethod(req.method)) {
    return { response: null, request: req };
  }

  const headers = new Headers(req.headers);
  headers.set(MSGF_WRITE_TARGET_HEADER, writeTarget);

  const forwarded = new NextRequest(req, { headers });

  return { response: null, request: forwarded };
}
