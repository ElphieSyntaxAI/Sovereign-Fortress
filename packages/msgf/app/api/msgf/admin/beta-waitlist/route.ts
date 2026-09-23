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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
/**
 * GET/PATCH /api/msgf/admin/beta-waitlist
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { MsgfAdminAuthError } from "@/lib/msgf-admin-auth";
import { resolveOperatorForAdminRequest } from "@/lib/msgf-admin-request-operator";
import { adminCorsPreflightResponse, applyAdminCorsHeaders } from "@/lib/msgf-cors";
import {
  listBetaWaitlist,
  patchBetaWaitlistStatus,
  type BetaWaitlistProduct,
  type BetaWaitlistStatus,
} from "@/lib/services/beta-waitlist";
import { createAdminClient } from "@/utils/supabase/admin";

function adminJson(req: NextRequest, data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  return applyAdminCorsHeaders(req, res);
}

export async function OPTIONS(req: NextRequest) {
  return adminCorsPreflightResponse(req);
}

async function requireOperator(req: NextRequest) {
  const admin = createAdminClient();
  const op = await resolveOperatorForAdminRequest(req, admin);
  if (op.role === "DEVELOPER") {
    throw new MsgfAdminAuthError("Operators only.", 403);
  }
  return { admin, op };
}

export async function GET(req: NextRequest) {
  try {
    const { admin } = await requireOperator(req);
    const productRaw = req.nextUrl.searchParams.get("product")?.trim() || "all";
    const statusRaw = req.nextUrl.searchParams.get("status")?.trim() || "pending";
    const product = (
      ["msgf", "author", "education", "all"].includes(productRaw)
        ? productRaw
        : "all"
    ) as BetaWaitlistProduct | "all";
    const status = (
      ["pending", "invited", "declined", "all"].includes(statusRaw)
        ? statusRaw
        : "pending"
    ) as BetaWaitlistStatus | "all";
    const limit = Number(req.nextUrl.searchParams.get("limit") || "50");

    const { rows, count } = await listBetaWaitlist(admin, {
      product,
      status,
      limit: Number.isFinite(limit) ? limit : 50,
    });

    return adminJson(req, { ok: true, count, rows });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return adminJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "List failed.";
    return adminJson(req, { ok: false, error: msg }, { status: 500 });
  }
}

const patchSchema = z
  .object({
    id: z.string().uuid(),
    status: z.enum(["pending", "invited", "declined"]),
  })
  .strict();

export async function PATCH(req: NextRequest) {
  try {
    const { admin } = await requireOperator(req);
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return adminJson(req, { ok: false, error: "Invalid JSON." }, { status: 400 });
    }
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return adminJson(
        req,
        { ok: false, error: "Invalid body.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const row = await patchBetaWaitlistStatus(admin, parsed.data);
    return adminJson(req, { ok: true, row });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return adminJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "Update failed.";
    return adminJson(req, { ok: false, error: msg }, { status: 500 });
  }
}
