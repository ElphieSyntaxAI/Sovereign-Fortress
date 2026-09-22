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
 * Distribution Build ID: MSGF-191e80fa-20260921T055901Z-internal
 */
/**
 * POST /api/msgf/prompt-optimizer — structured V1 targeted prompt (no LLM).
 */

import { NextRequest, NextResponse } from "next/server";

import { adminCorsPreflightResponse, applyAdminCorsHeaders } from "@/lib/msgf-cors";
import { PromptOptimizerBodySchema } from "@/lib/schemas/prompt-optimizer";
import { IdePackAuthError, resolveIdePackActor } from "@/lib/services/ide-pack-auth";
import { buildOptimizedPrompt } from "@/lib/services/prompt-optimizer-service";
import { recordSavingsFeatureCount } from "@/lib/services/savings-features-stats";
import { sanitizeTenantScope } from "@/lib/sanitize-tenant-scope";

function json(req: NextRequest, data: unknown, init?: ResponseInit) {
  return applyAdminCorsHeaders(req, NextResponse.json(data, init));
}

export async function OPTIONS(req: NextRequest) {
  return adminCorsPreflightResponse(req);
}

export async function POST(req: NextRequest) {
  try {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return json(req, { ok: false, error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = PromptOptimizerBodySchema.safeParse(raw);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      return json(
        req,
        {
          ok: false,
          error: {
            ...flat.fieldErrors,
            ...(flat.formErrors.length ? { _form: flat.formErrors } : {}),
          },
        },
        { status: 400 }
      );
    }

    const tenantKey = sanitizeTenantScope(parsed.data.tenantKey);
    const { admin, token, entityId } = await resolveIdePackActor(req, tenantKey);

    const result = await buildOptimizedPrompt({
      admin,
      tenantKey,
      userIntent: parsed.data.userIntent,
      activeFilePaths: parsed.data.activeFilePaths,
      goalType: parsed.data.goalType,
      entityId,
      userId: token.user_id,
      projectOrigin: parsed.data.projectOrigin ?? parsed.data.tenantKey,
    });

    void recordSavingsFeatureCount(tenantKey, "agent_context_pack");

    return json(req, {
      ok: true,
      packId: result.packId,
      markdown: result.markdown,
      naiveCharCount: result.naiveCharCount,
      shardedCharCount: result.shardedCharCount,
      task_count: result.task_count,
      shadow_files_indexed: result.shadow_files_indexed,
      verifyScripts: result.verifyScripts,
      prompt_hash: result.prompt_hash,
      /** Clients may echo this as `x-msgf-prompt-hash` on gateway calls for fitness lineage. */
      prompt_hash_header: "x-msgf-prompt-hash",
    });
  } catch (e) {
    if (e instanceof IdePackAuthError) {
      return json(req, { ok: false, error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "prompt-optimizer failed";
    console.error("[prompt-optimizer]", e);
    return json(req, { ok: false, error: msg }, { status: 500 });
  }
}
