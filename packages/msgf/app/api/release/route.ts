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
 * Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
 */
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: process.env.K_SERVICE ?? "msgf-api",
    revision: process.env.K_REVISION ?? null,
    deploy_env: process.env.DEPLOY_ENV?.trim() || "production",
    git_sha: process.env.GIT_SHA?.trim() || process.env.IMAGE_TAG?.trim() || null,
    deployed_at: process.env.DEPLOYED_AT?.trim() || null,
    build_id: process.env.MSGF_BUILD_ID?.trim() || null,
  });
}
