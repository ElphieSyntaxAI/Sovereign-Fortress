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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
import { msgfRedisKey, redisDel, redisGet, redisIncrWithWindow, redisSet } from "@/lib/redis";

const CIRCUIT_KEY = msgfRedisKey("google_sso", "circuit");
const FAIL_KEY = msgfRedisKey("google_sso", "failures");

/** In-memory fallback when Redis is unavailable (single-instance / local). */
let memoryFailures = 0;
let memoryOpenedUntil = 0;

function failureThreshold(): number {
  const n = Number.parseInt(process.env.GOOGLE_SSO_CIRCUIT_FAILURES?.trim() || "5", 10);
  return Number.isFinite(n) && n > 0 ? n : 5;
}

function windowSeconds(): number {
  const n = Number.parseInt(process.env.GOOGLE_SSO_CIRCUIT_WINDOW_SEC?.trim() || "300", 10);
  return Number.isFinite(n) && n > 0 ? n : 300;
}

export async function isGoogleSsoCircuitOpen(): Promise<boolean> {
  if (process.env.GOOGLE_SSO_CIRCUIT_FORCE_OPEN === "1") return true;

  const fromRedis = await redisGet(CIRCUIT_KEY);
  if (fromRedis === "1" || fromRedis === "open") return true;

  if (Date.now() < memoryOpenedUntil) return true;
  return false;
}

export async function recordGoogleSsoFailure(reason?: string): Promise<{ open: boolean }> {
  const threshold = failureThreshold();
  const windowSec = windowSeconds();

  try {
    const count = await redisIncrWithWindow(FAIL_KEY, windowSec);
    if (count != null && count >= threshold) {
      await redisSet(CIRCUIT_KEY, "open", windowSec);
      console.warn("[google-sso-circuit] opened (redis)", { count, reason: reason ?? null });
      return { open: true };
    }
    if (count != null) return { open: false };
  } catch {
    /* fall through to memory */
  }

  memoryFailures += 1;
  if (memoryFailures >= threshold) {
    memoryOpenedUntil = Date.now() + windowSec * 1000;
    memoryFailures = 0;
    console.warn("[google-sso-circuit] opened (memory)", { reason: reason ?? null });
    return { open: true };
  }
  return { open: await isGoogleSsoCircuitOpen() };
}

export async function clearGoogleSsoCircuit(): Promise<void> {
  memoryFailures = 0;
  memoryOpenedUntil = 0;
  try {
    await redisDel(CIRCUIT_KEY);
    await redisDel(FAIL_KEY);
  } catch {
    /* ignore */
  }
}

/** Extract Google Workspace hosted domain from Supabase user identities / metadata. */
export function extractGoogleHostedDomain(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
  identities?: Array<{ provider?: string; identity_data?: Record<string, unknown> }> | null;
}): string | null {
  const identities = user.identities ?? [];
  for (const id of identities) {
    if (id.provider !== "google") continue;
    const data = id.identity_data ?? {};
    const hd =
      (typeof data.hd === "string" && data.hd) ||
      (typeof data.hosted_domain === "string" && data.hosted_domain) ||
      null;
    if (hd) return hd.trim().toLowerCase();
  }
  const meta = user.user_metadata ?? {};
  if (typeof meta.hd === "string" && meta.hd.trim()) return meta.hd.trim().toLowerCase();
  if (typeof meta.hosted_domain === "string" && meta.hosted_domain.trim()) {
    return meta.hosted_domain.trim().toLowerCase();
  }
  return null;
}

export function userHasGoogleIdentity(user: {
  identities?: Array<{ provider?: string }> | null;
  app_metadata?: { provider?: string; providers?: string[] } | null;
}): boolean {
  if (user.identities?.some((i) => i.provider === "google")) return true;
  if (user.app_metadata?.provider === "google") return true;
  if (user.app_metadata?.providers?.includes("google")) return true;
  return false;
}
