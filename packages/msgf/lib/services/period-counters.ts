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
/**
 * ISO-week + calendar-month Redis accumulators for MSGF consumed / saved reporting.
 */

import { msgfRedisKey, redisGet, redisSet } from "@/lib/redis";

export type PeriodKind = "weekly" | "monthly";

const WEEK_TTL_SEC = 86_400 * 45;
const MONTH_TTL_SEC = 86_400 * 400;

export type PeriodTokenField =
  | "metered_consumed"
  | "proven_saved"
  | "estimated_saved"
  | "provider_calls"
  | "shadow_projected_usd_cents";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** ISO week key e.g. 2026-W32 (UTC). */
export function isoWeekPeriodKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${pad2(weekNo)}`;
}

/** Calendar month key e.g. 2026-08 (UTC). */
export function monthPeriodKey(date = new Date()): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}`;
}

/** Monday UTC date for an ISO week key. */
export function isoWeekStartDate(periodKey: string): string {
  const m = /^(\d{4})-W(\d{2})$/.exec(periodKey.trim());
  if (!m) return periodKey;
  const year = Number(m[1]);
  const week = Number(m[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayNum = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - dayNum + 1 + (week - 1) * 7);
  return monday.toISOString().slice(0, 10);
}

export function previousIsoWeekKeys(count: number, from = new Date()): string[] {
  const keys: string[] = [];
  const d = new Date(from);
  for (let i = 0; i < count; i++) {
    keys.push(isoWeekPeriodKey(d));
    d.setUTCDate(d.getUTCDate() - 7);
  }
  return keys;
}

export function previousMonthKeys(count: number, from = new Date()): string[] {
  const keys: string[] = [];
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  for (let i = 0; i < count; i++) {
    keys.push(monthPeriodKey(d));
    d.setUTCMonth(d.getUTCMonth() - 1);
  }
  return keys;
}

async function readCounter(key: string): Promise<number> {
  const raw = await redisGet(key);
  const n = Number(raw ?? 0);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

async function addToCounter(key: string, delta: number, ttl: number): Promise<void> {
  const d = Math.floor(delta);
  if (d <= 0) return;
  const prior = await readCounter(key);
  await redisSet(key, String(prior + d), ttl);
}

function fieldKey(tenantId: string, kind: PeriodKind, periodKey: string, field: PeriodTokenField): string {
  return msgfRedisKey("period", tenantId, kind, periodKey, field);
}

export async function incrPeriodField(
  tenantId: string,
  field: PeriodTokenField,
  delta: number,
  at = new Date()
): Promise<void> {
  const tid = tenantId.trim();
  const d = Math.floor(delta);
  if (!tid || d <= 0) return;
  const week = isoWeekPeriodKey(at);
  const month = monthPeriodKey(at);
  await Promise.all([
    addToCounter(fieldKey(tid, "weekly", week, field), d, WEEK_TTL_SEC),
    addToCounter(fieldKey(tid, "monthly", month, field), d, MONTH_TTL_SEC),
  ]);
}

export type PeriodLiveCounters = {
  period_kind: PeriodKind;
  period_key: string;
  metered_consumed: number;
  proven_saved: number;
  estimated_saved: number;
  provider_calls: number;
  shadow_projected_usd_cents: number;
};

export async function readPeriodLiveCounters(
  tenantId: string,
  kind: PeriodKind,
  periodKey: string
): Promise<PeriodLiveCounters> {
  const tid = tenantId.trim();
  const [metered_consumed, proven_saved, estimated_saved, provider_calls, shadow_projected_usd_cents] =
    await Promise.all([
      readCounter(fieldKey(tid, kind, periodKey, "metered_consumed")),
      readCounter(fieldKey(tid, kind, periodKey, "proven_saved")),
      readCounter(fieldKey(tid, kind, periodKey, "estimated_saved")),
      readCounter(fieldKey(tid, kind, periodKey, "provider_calls")),
      readCounter(fieldKey(tid, kind, periodKey, "shadow_projected_usd_cents")),
    ]);
  return {
    period_kind: kind,
    period_key: periodKey,
    metered_consumed,
    proven_saved,
    estimated_saved,
    provider_calls,
    shadow_projected_usd_cents,
  };
}
