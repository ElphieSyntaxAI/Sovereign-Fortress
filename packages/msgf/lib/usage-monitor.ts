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
 * usage_monitor cumulative token accounting (aligns with creditGuard hard cap).
 */

import { createClient } from "@supabase/supabase-js";

import { estimateIncomingRequestTokens } from "@/lib/creditGuard";
import type { NextRequest } from "next/server";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    throw new Error("usage_monitor: missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function isUsageMonitorWriteEnabled(): boolean {
  const v = process.env.MSGF_USAGE_MONITOR_WRITE?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no") return false;
  if (v === "1" || v === "true" || v === "yes") return true;
  return true;
}

/**
 * Increment actor cumulative tokens (service role RPC).
 */
export async function incrementUsageMonitorTokens(
  actorKey: string,
  delta: number
): Promise<void> {
  if (!isUsageMonitorWriteEnabled()) return;
  const userKey = actorKey.trim();
  const d = Math.max(0, Math.floor(delta));
  if (!userKey || d === 0) return;

  try {
    const admin = supabaseAdmin();
    const { error } = await admin.rpc("msgf_usage_monitor_add", {
      p_user_id: userKey,
      p_delta: d,
    });
    if (error) {
      console.warn("[usage_monitor] increment failed:", error.message);
    }
  } catch (e) {
    console.warn("[usage_monitor] increment error:", e);
  }
}

/** Record estimated tokens for a completed MSGF API request. */
export async function recordMsgfRequestUsage(
  actorKey: string,
  tokens: number
): Promise<void> {
  await incrementUsageMonitorTokens(actorKey, tokens);
}

export async function recordMsgfRequestUsageFromRequest(
  request: NextRequest,
  actorKey: string,
  overrideTokens?: number
): Promise<void> {
  const tokens =
    overrideTokens != null
      ? Math.max(0, Math.floor(overrideTokens))
      : await estimateIncomingRequestTokens(request);
  await recordMsgfRequestUsage(actorKey, tokens);
}
