/**
 * GET /api/msgf/ide/connectivity-check — IDE setup probe (auth, tenant, pillar health).
 */

import { NextRequest, NextResponse } from "next/server";

import type { IdeConnectivityResponse } from "@/lib/ide-error-codes";
import { applyPulseCorsHeaders, pulseCorsPreflightResponse } from "@/lib/msgf-cors";
import { runIdeConnectivityChecks } from "@/lib/services/ide-connectivity-check";

function json(req: NextRequest, data: IdeConnectivityResponse, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  const firstFail = data.checks.find((c) => !c.ok && c.error_code);
  if (firstFail?.error_code) {
    res.headers.set("x-msgf-error-code", firstFail.error_code);
  }
  return applyPulseCorsHeaders(req, res);
}

export async function OPTIONS(req: NextRequest) {
  return pulseCorsPreflightResponse(req);
}

export async function GET(req: NextRequest) {
  try {
    const checks = await runIdeConnectivityChecks(req);
    const ok = checks.every((c) => c.ok);
    return json(req, { ok, checks }, { status: ok ? 200 : 503 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Connectivity check failed.";
    console.error("[ide/connectivity-check]", e);
    return json(
      req,
      {
        ok: false,
        checks: [
          {
            name: "connectivity_check",
            ok: false,
            error_code: "SERVER_ERROR",
            user_message: msg,
            fix_steps: ["Retry later or contact support."],
          },
        ],
      },
      { status: 500 }
    );
  }
}
