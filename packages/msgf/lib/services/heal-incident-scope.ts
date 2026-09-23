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
 * Distribution Build ID: MSGF-fca2d532-20260923T201750Z-internal
 */
/**
 * Project-origin + bug-index helpers so heal / state-ledger flows appear in the
 * governance dashboard incident queue (scoped by mapped `project_origins`).
 */

import type { GenealogicalBugIndex } from "@/lib/schemas/vault-hall-metadata";
import {
  PULSE_BUG_INDEX,
  type MsgfGovernancePillar,
} from "@/lib/schemas/vault-hall-metadata";
import { tenantKeyLooksLikeProjectOrigin } from "@/lib/services/project-tracking-rails";
import { deriveProjectOrigin } from "@/lib/services/msgf-metadata-scope";

export function resolveHealIncidentProjectOrigin(params: {
  filePath?: string | null;
  tenantKey?: string | null;
  explicit?: string | null;
  editorHref?: string | null;
}): string | undefined {
  const explicit = params.explicit?.trim();
  if (explicit) return explicit.slice(0, 256);

  const tenantKey = params.tenantKey?.trim();
  if (tenantKeyLooksLikeProjectOrigin(tenantKey)) {
    return tenantKey!.slice(0, 256);
  }

  const href = params.editorHref?.trim();
  if (href && !href.startsWith("governance://")) {
    const fromHref = deriveProjectOrigin([{ path: href.replace(/^file:\/\//i, "") }]);
    if (fromHref !== "unknown") return fromHref.slice(0, 256);
  }

  const filePath = params.filePath?.replace(/\\/g, "/").trim();
  if (filePath && !filePath.startsWith("governance://")) {
    const fromPath = deriveProjectOrigin([{ path: filePath }]);
    if (fromPath !== "unknown") return fromPath.slice(0, 256);
  }

  return undefined;
}

export function bugIndexForGovernanceHeal(params: {
  governancePillar?: MsgfGovernancePillar | string | null;
  taskBugIndex?: GenealogicalBugIndex | null;
}): GenealogicalBugIndex {
  const pillar = params.governancePillar?.trim();
  if (pillar === "P4") {
    return params.taskBugIndex ?? PULSE_BUG_INDEX.p4StateLedgerHeal;
  }
  if (params.taskBugIndex) {
    return params.taskBugIndex;
  }
  return PULSE_BUG_INDEX.userSentinelReport;
}
