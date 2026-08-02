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
 * Distribution Build ID: MSGF-149f647f-20260728T230931Z-internal
 */
/**
 * GET /api/msgf/refactoring-directive?profile=website_modernization
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { adminCorsPreflightResponse, applyAdminCorsHeaders } from "@/lib/msgf-cors";
import { buildRefactoringDirectivePack } from "@/lib/services/refactoring-directive-service";

const querySchema = z.object({
  profile: z.enum(["website_modernization"]).default("website_modernization"),
});

function json(req: NextRequest, data: unknown, init?: ResponseInit) {
  return applyAdminCorsHeaders(req, NextResponse.json(data, init));
}

export async function OPTIONS(req: NextRequest) {
  return adminCorsPreflightResponse(req);
}

export async function GET(req: NextRequest) {
  try {
    const parsed = querySchema.safeParse({
      profile: req.nextUrl.searchParams.get("profile") ?? "website_modernization",
    });
    if (!parsed.success) {
      return json(
        req,
        { ok: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const pack = buildRefactoringDirectivePack(parsed.data.profile);
    return json(req, { ok: true, ...pack });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "refactoring-directive failed";
    return json(req, { ok: false, error: msg }, { status: 500 });
  }
}
