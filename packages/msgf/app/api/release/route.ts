/**
 * @msgf-license-header
 * GET /api/release — deploy identity for staging smoke + rollback tracking.
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
