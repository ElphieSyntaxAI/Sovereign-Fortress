import { Router, type Request, type Response } from "express";

import {
  evaluateAuthorPublisherDeployGate,
  getAuthorGovernanceStatus,
  postAuthorVerifyResult,
} from "../lib/authorMsgfGovernance.js";
import { getAuthorMsgfMappingStatus } from "../lib/authorMsgfMapping.js";
import { readBearerUser } from "../lib/readBearerJwtUser.js";

export const msgfGovernanceController = Router();

/**
 * GET /api/msgf/governance/status
 * Gateway mode, CONVERGE defaults, period-report / quarantine / deploy-gate deep links.
 */
msgfGovernanceController.get("/api/msgf/governance/status", (_req: Request, res: Response) => {
  const mapping = getAuthorMsgfMappingStatus();
  const governance = getAuthorGovernanceStatus();
  return res.status(200).json({
    ok: true,
    ...governance,
    mapping: {
      ready: mapping.ready,
      missing: mapping.missing,
      tenant_id: mapping.tenant_id,
      project_origin: mapping.project_origin,
      dashboard_links: mapping.dashboard_links,
    },
  });
});

/**
 * GET /api/msgf/governance/deploy-gate
 * Soft/enforced publisher readiness for Author project_origin.
 */
msgfGovernanceController.get(
  "/api/msgf/governance/deploy-gate",
  async (_req: Request, res: Response) => {
    const result = await evaluateAuthorPublisherDeployGate();
    return res.status(200).json({ ok: true, ...result });
  }
);

/**
 * POST /api/msgf/governance/verify-result
 * Author session → MSGF verify-result (Vault/Hall learning). Body: { passed, command?, manuscript_id? }.
 */
msgfGovernanceController.post(
  "/api/msgf/governance/verify-result",
  async (req: Request, res: Response) => {
    const user = readBearerUser(req, res);
    if (!user) return;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const passed = body.passed === true;
    const command =
      typeof body.command === "string" && body.command.trim()
        ? body.command.trim().slice(0, 512)
        : "author:manual-verify";
    const manuscriptId =
      typeof body.manuscript_id === "string" ? body.manuscript_id.trim() : null;

    const result = await postAuthorVerifyResult({
      passed,
      command,
      actorId: user.userId,
      manuscriptId,
      surface: "revision_unlock",
      stdoutSnippet: typeof body.stdout_snippet === "string" ? body.stdout_snippet : undefined,
      stderrSnippet: typeof body.stderr_snippet === "string" ? body.stderr_snippet : undefined,
    });

    return res.status(result.ok ? 200 : result.configured ? 502 : 503).json({
      ok: result.ok,
      configured: result.configured,
      status: result.status,
      upstream: result.body,
      error: result.error,
    });
  }
);
