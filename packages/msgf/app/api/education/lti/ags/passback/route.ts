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
 * Distribution Build ID: MSGF-463028d-20260519T150411Z-internal
 */
/**
 * POST /api/education/lti/ags/passback
 *
 * Submit Human Effort Certificate to Canvas SpeedGrader via LTI AGS.
 * Requires valid LTI session cookie or service headers.
 */
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ELPHIE_LTI_SESSION_COOKIE, openLtiSession } from "@/lib/education/lti/lti-session";
import { passbackHumanEffortCertificateToCanvas } from "@/lib/education/lti/lti-ags";
import { resolveLtiDeploymentFromEnv } from "@/lib/education/lti/lti-config";
import {
  MSGF_ENTITY_ID_HEADER,
  MSGF_TENANT_ID_HEADER,
} from "@/lib/msgf-http-headers";
import { createAdminClient } from "@/utils/supabase/admin";

const PassbackBodySchema = z
  .object({
    halScore: z.number().min(0).max(100),
    canvasUserId: z.string().min(1).optional(),
    lineItemUrl: z.string().url().optional(),
    resourceLinkId: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .strict();

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionRaw = cookieStore.get(ELPHIE_LTI_SESSION_COOKIE)?.value;
    const session = sessionRaw ? openLtiSession(sessionRaw) : null;

    const headerEntity = req.headers.get(MSGF_ENTITY_ID_HEADER)?.trim();
    const headerTenant = req.headers.get(MSGF_TENANT_ID_HEADER)?.trim();

    const body = PassbackBodySchema.parse(await req.json());
    const deployment = resolveLtiDeploymentFromEnv();

    const entityId = session?.entityId ?? headerEntity;
    const tenantId = session?.tenantId ?? headerTenant ?? deployment.tenantId;
    const lineItemUrl = body.lineItemUrl ?? session?.lineItemUrl;

    if (!entityId) {
      return NextResponse.json(
        { error: "LTI session or x-msgf-entity-id required." },
        { status: 401 }
      );
    }

    if (!lineItemUrl) {
      return NextResponse.json(
        { error: "lineItemUrl required (from launch AGS claim or request body)." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    let canvasUserId = body.canvasUserId;
    if (!canvasUserId && session?.launchId) {
      const { data: launch } = await admin
        .from("education_lti_launches")
        .select("canvas_ags_user_ref")
        .eq("id", session.launchId)
        .maybeSingle();
      canvasUserId = launch?.canvas_ags_user_ref ?? undefined;
    }

    if (!canvasUserId) {
      return NextResponse.json(
        {
          error:
            "canvasUserId required (request body or active LTI launch session).",
        },
        { status: 400 }
      );
    }

    const { data: vault } = await admin
      .from("education_privacy_vault")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("entity_id", entityId)
      .maybeSingle();

    if (!vault?.id) {
      return NextResponse.json(
        { error: "Privacy vault record not found for entity." },
        { status: 404 }
      );
    }

    const result = await passbackHumanEffortCertificateToCanvas({
      admin,
      tenantId,
      entityId,
      privacyVaultId: String(vault.id),
      canvasUserId,
      lineItemUrl,
      resourceLinkId: body.resourceLinkId ?? session?.resourceLinkId,
      halScore: body.halScore,
      deployment,
      metadata: body.metadata,
    });

    return NextResponse.json({
      ok: result.agsStatus === "submitted",
      certificate_id: result.certificateId,
      certificate_digest: result.certificateDigest,
      teacher_dashboard_url: result.teacherDashboardUrl,
      ags_status: result.agsStatus,
      ags_error: result.agsError ?? null,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid body", details: e.flatten() },
        { status: 400 }
      );
    }
    const message = e instanceof Error ? e.message : String(e);
    console.error("[lti/ags/passback]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
