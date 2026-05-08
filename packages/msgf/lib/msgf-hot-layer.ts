import { createClient, type RedisClientType } from "redis";
import type { StateBeatRow } from "@/lib/P4";

const ACTIVE_SLICE_TTL_SECONDS = Number(process.env.MSGF_ACTIVE_SLICE_TTL_SEC || 180);

type ActiveSlicePayload = {
  authorId: string;
  beatsContext: string;
  previousRetryCount: number;
  previousBeats: StateBeatRow[];
  cachedAt: string;
};

let redisClient: RedisClientType | null = null;
let redisConnectPromise: Promise<void> | null = null;

function getRedisKey(authorId: string): string {
  return `msgf:p4:active-slice:${authorId}`;
}

async function getRedis(): Promise<RedisClientType | null> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  if (!redisClient) {
    redisClient = createClient({ url: redisUrl });
    redisClient.on("error", () => {
      // Fail open: hot layer is an accelerator, not a hard dependency.
    });
  }

  if (!redisClient.isOpen) {
    if (!redisConnectPromise) {
      redisConnectPromise = redisClient
        .connect()
        .then(() => undefined)
        .finally(() => {
          redisConnectPromise = null;
        });
    }
    await redisConnectPromise;
  }

  return redisClient;
}

export async function getActiveSlice(authorId: string): Promise<ActiveSlicePayload | null> {
  const redis = await getRedis();
  if (!redis) return null;

  const raw = await redis.get(getRedisKey(authorId));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as ActiveSlicePayload;
  } catch {
    return null;
  }
}

export async function setActiveSlice(params: {
  authorId: string;
  previousBeats: StateBeatRow[];
  previousRetryCount: number;
}): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;

  const beatsContext = params.previousBeats.length
    ? params.previousBeats
        .map((b) => `[${b.sequence_index}] ${b.beat_text}`)
        .join("\n")
    : "(no prior beats)";

  const payload: ActiveSlicePayload = {
    authorId: params.authorId,
    beatsContext,
    previousRetryCount: params.previousRetryCount,
    previousBeats: params.previousBeats,
    cachedAt: new Date().toISOString(),
  };

  await redis.set(getRedisKey(params.authorId), JSON.stringify(payload), {
    EX: ACTIVE_SLICE_TTL_SECONDS,
  });
}

export const HOT_LAYER_ACTIVE_SLICE_TTL_SECONDS = ACTIVE_SLICE_TTL_SECONDS;

