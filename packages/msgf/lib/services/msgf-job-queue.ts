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
 * Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
 */
import { getRedisClient, isRedisConfigured, msgfRedisKey } from "@/lib/redis";

export type MsgfJobQueueName = "signing-webhooks" | "dropbox-archive" | "invite-email";

export type DropboxArchiveJob = {
  type: "dropbox-archive";
  invite_id: string;
  company_id: string;
  envelope_id?: string | null;
  provider: string;
  enqueued_at: string;
};

export type MsgfQueueJob = DropboxArchiveJob;

function queueKey(name: MsgfJobQueueName): string {
  return msgfRedisKey("queue", name);
}

/** In-memory fallback for local/tests when Redis is down (single process). */
const memoryQueues = new Map<string, string[]>();

export function enqueueJobSyncMemory(name: MsgfJobQueueName, job: MsgfQueueJob): void {
  const key = queueKey(name);
  const list = memoryQueues.get(key) ?? [];
  list.push(JSON.stringify(job));
  memoryQueues.set(key, list);
}

export function __resetMsgfJobQueueMemoryForTests(): void {
  memoryQueues.clear();
}

/**
 * Enqueue JSON job. Returns true when Redis accepted, false when fail-open needed.
 * Always mirrors into memory when Redis fails so local workers can still drain in-process.
 */
export async function enqueueMsgfJob(
  name: MsgfJobQueueName,
  job: MsgfQueueJob
): Promise<{ queued: boolean; backend: "redis" | "memory" | "none" }> {
  const payload = JSON.stringify(job);
  const key = queueKey(name);

  if (!isRedisConfigured()) {
    enqueueJobSyncMemory(name, job);
    return { queued: false, backend: "memory" };
  }

  const redis = getRedisClient();
  if (!redis) {
    enqueueJobSyncMemory(name, job);
    return { queued: false, backend: "memory" };
  }

  try {
    await redis.lpush(key, payload);
    return { queued: true, backend: "redis" };
  } catch (e) {
    console.warn("[msgf-job-queue] lpush failed:", e instanceof Error ? e.message : e);
    enqueueJobSyncMemory(name, job);
    return { queued: false, backend: "memory" };
  }
}

export async function dequeueMsgfJob(
  name: MsgfJobQueueName
): Promise<MsgfQueueJob | null> {
  const key = queueKey(name);
  const redis = getRedisClient();
  if (redis) {
    try {
      const raw = await redis.rpop(key);
      if (raw) {
        return JSON.parse(raw) as MsgfQueueJob;
      }
    } catch (e) {
      console.warn("[msgf-job-queue] rpop failed:", e instanceof Error ? e.message : e);
    }
  }

  const mem = memoryQueues.get(key);
  if (mem && mem.length) {
    const raw = mem.shift()!;
    memoryQueues.set(key, mem);
    try {
      return JSON.parse(raw) as MsgfQueueJob;
    } catch {
      return null;
    }
  }
  return null;
}

export async function enqueueDropboxArchiveJob(job: Omit<DropboxArchiveJob, "type" | "enqueued_at">): Promise<{
  queued: boolean;
  backend: "redis" | "memory" | "none";
}> {
  return enqueueMsgfJob("dropbox-archive", {
    type: "dropbox-archive",
    ...job,
    enqueued_at: new Date().toISOString(),
  });
}
