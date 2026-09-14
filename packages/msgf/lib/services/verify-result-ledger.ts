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
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */
/**
 * Verify-result → Vault / Hall side effects (deduped failures, pack-linked passes).
 */

import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { CURRENT_LEGAL_VERSION } from "@/lib/msgf-legal";
import type { VerifyResultBody } from "@/lib/schemas/verify-result";
import { buildGenealogicalBugIndex } from "@/lib/schemas/vault-hall-metadata";
import { persistToHall, persistToVault } from "@/lib/services/constraint-ledger";
import { pathToGenealogicalBugIndex } from "@/lib/services/IngestService";
import { getPackFromRedis } from "@/lib/services/pack-registry";
import { msgfRedisKey, redisIncrWithWindow } from "@/lib/redis";
import { redactTerminalSnippet } from "@/lib/utils/shell-safe-path";

const HALL_FAIL_THRESHOLD =
  Number(process.env.MSGF_VERIFY_HALL_FAIL_THRESHOLD?.trim()) || 3;
const HALL_FAIL_WINDOW_SEC =
  Number(process.env.MSGF_VERIFY_HALL_FAIL_WINDOW_SEC?.trim()) || 86_400;

function resolveBugIndex(body: VerifyResultBody) {
  const path = body.file_paths?.[0]?.trim();
  if (path) {
    return pathToGenealogicalBugIndex(path);
  }
  return buildGenealogicalBugIndex({
    level_1_category: "1.0_PULSE",
    level_1_1_branch: "1.1_VERIFY",
    level_1_1_1_instance: "1.1.1_VERIFY_RESULT",
  });
}

function failFingerprint(body: VerifyResultBody): string {
  const basis = [
    body.command ?? "",
    body.file_paths?.join("|") ?? "",
    body.stderr_snippet ?? "",
  ].join("\n");
  return createHash("sha256").update(basis, "utf8").digest("hex").slice(0, 16);
}

export type VerifyResultLedgerOutcome = {
  hall_persisted: boolean;
  vault_persisted: boolean;
  verify_fail_count: number;
};

export async function applyVerifyResultLedgerEffects(
  admin: SupabaseClient,
  body: VerifyResultBody,
  entityId: string | null
): Promise<VerifyResultLedgerOutcome> {
  const tenantId = body.tenant_id.trim();
  const actorId = body.actor_id?.trim() || entityId || tenantId;
  const bugIndex = resolveBugIndex(body);
  let hall_persisted = false;
  let vault_persisted = false;
  let verify_fail_count = 0;

  if (!body.passed) {
    const fp = failFingerprint(body);
    const redisKey = msgfRedisKey(
      "verify",
      "fail",
      tenantId,
      bugIndex.level_1_1_1_instance,
      fp
    );
    verify_fail_count = (await redisIncrWithWindow(redisKey, HALL_FAIL_WINDOW_SEC)) ?? 1;

    if (verify_fail_count >= HALL_FAIL_THRESHOLD) {
      const reason = redactTerminalSnippet(
        body.stderr_snippet?.trim() ||
          `Repeated verify failure (${verify_fail_count}x): ${body.command ?? "unknown command"}`
      );
      await persistToHall({
        supabase: admin,
        entityId: actorId,
        tenantId,
        content: reason,
        reason: `IDE verify failure pattern (${verify_fail_count}×): ${body.command ?? "verify"}`,
        bugIndex,
        tier: "RED",
        severity: "Violation",
        actionType: "VERIFY_RESULT_HALL",
        narrativeExtra: {
          verify_fail_count,
          command: body.command ?? null,
          file_paths: body.file_paths ?? [],
          fingerprint: fp,
        },
      });
      hall_persisted = true;
    }

    return { hall_persisted, vault_persisted, verify_fail_count };
  }

  if (body.pack_id?.trim()) {
    const pack = await getPackFromRedis(body.pack_id.trim());
    if (pack) {
      const summary = `Verify passed: ${body.command ?? "verify"} · pack ${pack.packId.slice(0, 8)}`;
      await persistToVault({
        supabase: admin,
        entityId: actorId,
        tenantId,
        content: summary,
        bugIndex,
        summaryBeat: summary,
        legalVersion: CURRENT_LEGAL_VERSION,
        halScore: 90,
        actionType: "VERIFY_RESULT_VAULT",
        narrativeExtra: {
          pack_id: pack.packId,
          command: body.command ?? null,
          user_intent: pack.userIntent.slice(0, 500),
        },
      });
      vault_persisted = true;
    }
  }

  return { hall_persisted, vault_persisted, verify_fail_count };
}
