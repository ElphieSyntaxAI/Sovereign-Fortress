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
 * Skip SWEEP re-ingest and optional Gemini audit when file content hash unchanged.
 */

import { createHash } from "node:crypto";

import { msgfRedisKey, redisGet, redisSet } from "@/lib/redis";

const HASH_TTL_SEC = Number(process.env.MSGF_INGEST_HASH_TTL_SEC?.trim()) || 86_400;

export type IngestFileLike = { path: string; content: string };

export function contentSha256Hex(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function hashRedisKey(tenantId: string, relPath: string): string {
  return msgfRedisKey("ingest", "hash", tenantId, relPath.replace(/\\/g, "/"));
}

export function isIngestHashSkipEnabled(): boolean {
  const v = process.env.MSGF_INGEST_HASH_SKIP?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no") return false;
  return true;
}

export function isIngestAuditSkipOnHashHit(): boolean {
  const v = process.env.MSGF_INGEST_SKIP_AUDIT_ON_HASH_HIT?.trim().toLowerCase();
  if (v === "0" || v === "false") return false;
  return true;
}

export async function getCachedIngestContentHash(
  tenantId: string,
  relPath: string
): Promise<string | null> {
  if (!isIngestHashSkipEnabled()) return null;
  return redisGet(hashRedisKey(tenantId, relPath));
}

export async function rememberIngestContentHash(
  tenantId: string,
  relPath: string,
  hash: string
): Promise<void> {
  if (!isIngestHashSkipEnabled()) return;
  await redisSet(hashRedisKey(tenantId, relPath), hash, HASH_TTL_SEC);
}

export type IngestHashPartitionResult = {
  changed: IngestFileLike[];
  unchanged: IngestFileLike[];
  skipped_paths: string[];
};

/**
 * Partition files into changed vs unchanged (by Redis content hash).
 */
export async function partitionIngestFilesByContentHash(
  tenantId: string,
  files: readonly IngestFileLike[]
): Promise<IngestHashPartitionResult> {
  const changed: IngestFileLike[] = [];
  const unchanged: IngestFileLike[] = [];
  const skipped_paths: string[] = [];

  for (const file of files) {
    const hash = contentSha256Hex(file.content);
    const cached = await getCachedIngestContentHash(tenantId, file.path);
    if (cached && cached === hash) {
      unchanged.push(file);
      skipped_paths.push(file.path);
    } else {
      changed.push(file);
    }
  }

  return { changed, unchanged, skipped_paths };
}

export async function updateIngestHashesAfterSweep(
  tenantId: string,
  files: readonly IngestFileLike[]
): Promise<void> {
  for (const file of files) {
    await rememberIngestContentHash(tenantId, file.path, contentSha256Hex(file.content));
  }
}
