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
 * Context-pack registry (Redis, 24h) + guided-session counters + Supabase audit.
 */

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { msgfRedisKey, redisGet, redisIncrWithWindow, redisSet } from "@/lib/redis";
import { sanitizeTenantScope } from "@/lib/sanitize-tenant-scope";

const PACK_TTL_SEC = 86_400;
const WINDOW_SEC = 86_400;

export type PackRegistryRecord = {
  packId: string;
  tenantKey: string;
  userIntent: string;
  activeFilePaths: string[];
  naiveCharCount: number;
  shardedCharCount: number;
  entityId: string | null;
  userId: string | null;
  createdAt: string;
};

export function packRedisKey(packId: string): string {
  return msgfRedisKey("pack", packId.trim());
}

export function guidedSessionsRedisKey(tenantKey: string): string {
  return msgfRedisKey("tenant", sanitizeTenantScope(tenantKey), "guided_sessions");
}

export function contextSavingsTokensRedisKey(tenantKey: string): string {
  return msgfRedisKey("tenant", sanitizeTenantScope(tenantKey), "context_savings_tokens");
}

export async function registerPackInRedis(record: PackRegistryRecord): Promise<void> {
  await redisSet(packRedisKey(record.packId), JSON.stringify(record), PACK_TTL_SEC);
}

export async function getPackFromRedis(packId: string): Promise<PackRegistryRecord | null> {
  const raw = await redisGet(packRedisKey(packId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PackRegistryRecord;
    if (!parsed?.packId || !parsed?.tenantKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function mintPackId(): string {
  return randomUUID();
}

export async function incrementGuidedSession(tenantKey: string): Promise<number> {
  const count = await redisIncrWithWindow(guidedSessionsRedisKey(tenantKey), WINDOW_SEC);
  return count ?? 1;
}

export async function addContextSavingsTokens(
  tenantKey: string,
  tokens: number
): Promise<void> {
  const delta = Math.max(0, Math.floor(tokens));
  if (!delta) return;
  const key = contextSavingsTokensRedisKey(tenantKey);
  const prior = Number(await redisGet(key));
  const next = (Number.isFinite(prior) ? prior : 0) + delta;
  await redisSet(key, String(next), WINDOW_SEC);
}

export async function readGuidedSessions24h(tenantKey: string): Promise<number> {
  const raw = await redisGet(guidedSessionsRedisKey(tenantKey));
  const n = Number(raw ?? 0);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export async function readContextSavingsTokens24h(tenantKey: string): Promise<number> {
  const raw = await redisGet(contextSavingsTokensRedisKey(tenantKey));
  const n = Number(raw ?? 0);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export async function insertContextPackTransaction(params: {
  admin: SupabaseClient;
  packId: string;
  tenantKey: string;
  entityId: string | null;
  userId: string | null;
  naiveCharCount: number;
  shardedCharCount: number;
  userIntent?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await params.admin.from("context_pack_transactions").insert({
    pack_id: params.packId,
    tenant_id: sanitizeTenantScope(params.tenantKey),
    entity_id: params.entityId,
    user_id: params.userId,
    naive_char_count: Math.max(0, Math.floor(params.naiveCharCount)),
    sharded_char_count: Math.max(0, Math.floor(params.shardedCharCount)),
    user_intent_excerpt: params.userIntent?.slice(0, 500) ?? null,
    source: "confirm_pack",
  });

  if (error) {
    if (error.message.includes("context_pack_transactions")) {
      return {
        ok: false,
        error:
          "Apply migration 20260628140000_context_pack_transactions.sql before confirm-pack.",
      };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
