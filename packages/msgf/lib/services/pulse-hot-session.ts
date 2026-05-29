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
 * Distribution Build ID: MSGF-3a4c1de-20260529T200349Z-internal
 */
/**
 * V3.2-ULTRA Pulse hot session — SHARD (Step 2) + CROSS-REF (Step 4) Redis paths.
 *
 * Used by `POST /api/msgf/pulse` before cold Postgres work. Fail-open to Supabase when
 * Redis is unset, times out, or errors.
 */

import { CURRENT_LEGAL_VERSION } from "@/lib/msgf-legal";
import { getActiveSlice } from "@/lib/msgf-hot-layer";
import {
  isRedisConfigured,
  msgfRedisKey,
  redisDel,
  redisGet,
  redisIncrWithWindow,
  redisSet,
  redisSetNx,
  ensureRedisConnectedWithTimeout,
} from "@/lib/redis";
import {
  deriveLineageDocumentId,
  msgfLineageCacheKey,
} from "@/lib/services/vault-lineage-p2-cache";

const PLEDGE_CACHE_TTL_SEC = Number(process.env.MSGF_PULSE_PLEDGE_CACHE_TTL_SEC || 300);
const SESSION_LOCK_TTL_SEC = Number(process.env.MSGF_PULSE_SESSION_LOCK_TTL_SEC || 45);
const RATE_WINDOW_SEC = 60;
const RATE_LIMIT_PER_MIN = Number(process.env.MSGF_PULSE_RATE_LIMIT_PER_MIN || 120);

export type PulseHotStorageMode = "hot" | "cold";

export type CachedPledgeOk = {
  kind: "ok";
  legalVersion: string;
};

export type CachedPledgeBaseline = {
  kind: "baseline_required";
  body: Record<string, unknown>;
};

export type CachedPledge = CachedPledgeOk | CachedPledgeBaseline;

export type PulseHotSession = {
  traceId: string;
  tenantId: string;
  entityId: string;
  mode: PulseHotStorageMode;
  warnings: string[];
  activeSlicePrefetched: boolean;
  lineagePrefetchHit: boolean;
  sessionLockHeld: boolean;
  rateLimitCount: number;
  getCachedPledge: () => Promise<CachedPledge | null>;
  setCachedPledge: (value: CachedPledge) => Promise<void>;
  release: () => Promise<void>;
};

export type PreparePulseHotLayerParams = {
  traceId: string;
  tenantId: string;
  entityId: string;
  /** Optional pulse text seed for CROSS-REF lineage cache warm-read. */
  pulseTextSeed?: string;
};

function pledgeCacheKey(tenantId: string, entityId: string): string {
  return msgfRedisKey("pulse", "pledge", tenantId, entityId);
}

function rateLimitKey(tenantId: string, entityId: string): string {
  return msgfRedisKey("pulse", "rate", tenantId, entityId);
}

function sessionLockKey(tenantId: string, entityId: string): string {
  return msgfRedisKey("pulse", "lock", tenantId, entityId);
}

/** Lightweight keystroke text seed for CROSS-REF cache warm-read (no full gate). */
export function peekPulseTextSeed(rawBody: unknown): string {
  if (rawBody == null || typeof rawBody !== "object" || Array.isArray(rawBody)) {
    return "";
  }
  const keystrokes = (rawBody as { keystrokes?: unknown }).keystrokes;
  if (!Array.isArray(keystrokes)) return "";
  return keystrokes
    .map((k) => {
      if (k == null || typeof k !== "object") return "";
      const key = (k as { key?: unknown }).key;
      return typeof key === "string" ? key : "";
    })
    .join("");
}

function logHotDiagnostic(message: string): void {
  console.warn(`[msgf/pulse-hot-session] ${message}`);
}

/**
 * SHARD + CROSS-REF warm-up for a single Pulse request. Never throws — returns cold mode on failure.
 */
export async function preparePulseHotLayer(
  params: PreparePulseHotLayerParams
): Promise<{ session: PulseHotSession; rateLimitExceeded: boolean }> {
  const warnings: string[] = [];
  let mode: PulseHotStorageMode = "cold";
  let activeSlicePrefetched = false;
  let lineagePrefetchHit = false;
  let sessionLockHeld = false;
  let rateLimitCount = 0;

  const tenantId = params.tenantId.trim();
  const entityId = params.entityId.trim();

  if (!isRedisConfigured()) {
    logHotDiagnostic(
      "Redis not configured (UPSTASH_REDIS_REST_* or REDIS_HOST or REDIS_URL); using cold Postgres layer only."
    );
    warnings.push("redis_not_configured");
  } else {
    const connected = await ensureRedisConnectedWithTimeout();
    if (!connected) {
      logHotDiagnostic(
        "Redis connection timed out or ping failed; falling back to cold Postgres layer."
      );
      warnings.push("redis_connect_timeout");
    } else {
      mode = "hot";
    }
  }

  if (mode === "hot") {
    const count = await redisIncrWithWindow(rateLimitKey(tenantId, entityId), RATE_WINDOW_SEC);
    if (count != null) {
      rateLimitCount = count;
      if (count > RATE_LIMIT_PER_MIN) {
        return {
          session: buildSession({
            params,
            mode,
            warnings: [...warnings, "rate_limit_exceeded"],
            activeSlicePrefetched,
            lineagePrefetchHit,
            sessionLockHeld,
            rateLimitCount,
          }),
          rateLimitExceeded: true,
        };
      }
    }

    sessionLockHeld = await redisSetNx(
      sessionLockKey(tenantId, entityId),
      params.traceId,
      SESSION_LOCK_TTL_SEC
    );
    if (!sessionLockHeld) {
      warnings.push("session_lock_contended");
    }

    const slice = await getActiveSlice(entityId);
    activeSlicePrefetched = Boolean(slice);

    const seed = params.pulseTextSeed?.trim() ?? "";
    if (seed) {
      const documentId = deriveLineageDocumentId(seed);
      const lineageKey = msgfLineageCacheKey(tenantId, documentId);
      const lineageRaw = await redisGet(lineageKey);
      lineagePrefetchHit = Boolean(lineageRaw);
    }
  }

  return {
    session: buildSession({
      params,
      mode,
      warnings,
      activeSlicePrefetched,
      lineagePrefetchHit,
      sessionLockHeld,
      rateLimitCount,
    }),
    rateLimitExceeded: false,
  };
}

function buildSession(args: {
  params: PreparePulseHotLayerParams;
  mode: PulseHotStorageMode;
  warnings: string[];
  activeSlicePrefetched: boolean;
  lineagePrefetchHit: boolean;
  sessionLockHeld: boolean;
  rateLimitCount: number;
}): PulseHotSession {
  const { params, mode, warnings } = args;
  const tenantId = params.tenantId.trim();
  const entityId = params.entityId.trim();
  const pledgeKey = pledgeCacheKey(tenantId, entityId);
  const lockKey = sessionLockKey(tenantId, entityId);

  return {
    traceId: params.traceId,
    tenantId,
    entityId,
    mode,
    warnings,
    activeSlicePrefetched: args.activeSlicePrefetched,
    lineagePrefetchHit: args.lineagePrefetchHit,
    sessionLockHeld: args.sessionLockHeld,
    rateLimitCount: args.rateLimitCount,
    async getCachedPledge() {
      if (mode !== "hot") return null;
      const raw = await redisGet(pledgeKey);
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as CachedPledge & { legal_version?: string };
        if (parsed.kind === "ok") {
          const lv =
            parsed.legalVersion ??
            (parsed as { legal_version?: string }).legal_version ??
            CURRENT_LEGAL_VERSION;
          if (lv !== CURRENT_LEGAL_VERSION) return null;
          return { kind: "ok", legalVersion: lv };
        }
        if (parsed.kind === "baseline_required") return parsed;
        return null;
      } catch {
        return null;
      }
    },
    async setCachedPledge(value: CachedPledge) {
      if (mode !== "hot") return;
      await redisSet(pledgeKey, JSON.stringify(value), PLEDGE_CACHE_TTL_SEC);
    },
    async release() {
      if (mode !== "hot" || !args.sessionLockHeld) return;
      const raw = await redisGet(lockKey);
      if (raw === params.traceId) {
        await redisDel(lockKey);
      }
    },
  };
}

/** Merge hot-layer diagnostics into Pulse JSON (non-breaking). */
export function pulseHotLayerDiagnostics(
  session: PulseHotSession | undefined
): Record<string, unknown> | undefined {
  if (!session) return undefined;
  return {
    storage: session.mode,
    active_slice_prefetched: session.activeSlicePrefetched,
    lineage_prefetch_hit: session.lineagePrefetchHit,
    session_lock_held: session.sessionLockHeld,
    rate_limit_count: session.rateLimitCount,
    ...(session.warnings.length ? { warnings: session.warnings } : {}),
  };
}
