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
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */
/**
 * Anthropic-compatible messages proxy.
 * POST /api/v1/messages
 */

import { NextRequest } from "next/server";

import { handleProviderGateway } from "@/lib/gateway/provider-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return handleProviderGateway({
    req,
    provider: "anthropic",
    upstreamPath: "/v1/messages",
    endpointLabel: "/v1/messages",
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Authorization, Content-Type, x-api-key, anthropic-version, x-msgf-mode, x-msgf-key, x-msgf-tenant-id, X-MSGF-Tenant-Key",
    },
  });
}
