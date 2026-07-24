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
 * Distribution Build ID: MSGF-c1a5d75-20260723T221428Z-internal
 */
/**
 * Verify-result → token savings dashboard counters (24h Redis window).
 */

import type { VerifyResultBody } from "@/lib/schemas/verify-result";
import { getPackFromRedis } from "@/lib/services/pack-registry";
import {
  recordSavingsFeatureCount,
  recordSavingsFeatureTokensSaved,
} from "@/lib/services/savings-features-stats";
import type { VerifyResultLedgerOutcome } from "@/lib/services/verify-result-ledger";

function estimatePackContextTokensSaved(
  naiveCharCount: number,
  shardedCharCount: number
): number {
  return Math.max(0, Math.floor((naiveCharCount - shardedCharCount) / 4));
}

function estimateRunScriptRerunTokensSaved(shardedCharCount: number): number {
  return Math.max(0, Math.floor(shardedCharCount / 4));
}

/** Record 24h savings counters after verify-result persist + ledger effects. */
export async function recordVerifyResultSavingsEffects(params: {
  tenantKey: string;
  body: VerifyResultBody;
  ledger: VerifyResultLedgerOutcome;
}): Promise<void> {
  const tenantKey = params.tenantKey.trim();
  if (!tenantKey) return;

  const { body, ledger } = params;
  const packId = body.pack_id?.trim();
  const pack = packId ? await getPackFromRedis(packId) : null;

  if (body.passed) {
    void recordSavingsFeatureCount(tenantKey, "verify_result_pass");

    if (packId) {
      void recordSavingsFeatureCount(tenantKey, "run_script_rerun");
      if (pack) {
        void recordSavingsFeatureTokensSaved(
          tenantKey,
          "run_script_rerun",
          estimateRunScriptRerunTokensSaved(pack.shardedCharCount)
        );
      }
    }

    if (ledger.vault_persisted && pack) {
      void recordSavingsFeatureCount(tenantKey, "verify_result_vault");
      void recordSavingsFeatureTokensSaved(
        tenantKey,
        "verify_result_vault",
        estimatePackContextTokensSaved(pack.naiveCharCount, pack.shardedCharCount)
      );
    }

    return;
  }

  void recordSavingsFeatureCount(tenantKey, "verify_result_fail");
  if (ledger.hall_persisted) {
    void recordSavingsFeatureCount(tenantKey, "verify_result_hall");
  }
}
