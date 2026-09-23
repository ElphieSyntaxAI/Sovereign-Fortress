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
 * Distribution Build ID: MSGF-08289e1a-20260923T172846Z-internal
 */
/**
 * OpenAI-compatible chat completions proxy.
 * POST /api/v1/chat/completions
 */

import { NextRequest } from "next/server";

import { handleProviderGateway } from "@/lib/gateway/provider-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return handleProviderGateway({
    req,
    provider: "openai",
    upstreamPath: "/v1/chat/completions",
    endpointLabel: "/v1/chat/completions",
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Authorization, Content-Type, x-msgf-mode, x-msgf-key, x-msgf-tenant-id, X-MSGF-Tenant-Key",
    },
  });
}
