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
 * Distribution Build ID: MSGF-570add3d-20260922T212921Z-internal
 */
/**
 * Ping Redis hot layer (Upstash REST or local TCP).
 *
 *   npm run upstash-redis-ping -w msgf
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const msgfRoot = path.join(__dirname, "..");
const repoRoot = path.join(msgfRoot, "..", "..");
const require = createRequire(import.meta.url);

for (const p of [
  path.join(repoRoot, ".env"),
  path.join(repoRoot, ".env.local"),
  path.join(msgfRoot, ".env"),
  path.join(msgfRoot, ".env.local"),
]) {
  if (fs.existsSync(p)) {
    require("dotenv").config({ path: p, override: true });
  }
}

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
const redisUrl = process.env.REDIS_URL?.trim();
const redisHost = process.env.REDIS_HOST?.trim();

if (upstashUrl && upstashToken) {
  if (upstashUrl.includes("-box-") || upstashToken.startsWith("box_")) {
    console.error(
      "Your UPSTASH_* values look like Upstash Box, not Redis.\n" +
        "In console.upstash.com create a Redis database (not Box) and copy REST URL + token.\n" +
        "For local dev, use REDIS_URL=redis://127.0.0.1:6379 instead."
    );
    process.exit(1);
  }
  const { Redis } = await import("@upstash/redis");
  const redis = new Redis({ url: upstashUrl, token: upstashToken });
  const pong = await redis.ping();
  const probeKey = "msgf:ping:probe";
  await redis.set(probeKey, "ok", { ex: 60 });
  const readBack = await redis.get(probeKey);
  await redis.del(probeKey);
  console.log("Backend: Upstash Redis REST");
  console.log("PING:", pong);
  console.log("Round-trip SET/GET:", readBack);
  process.exit(0);
}

if (redisUrl || redisHost) {
  const Redis = (await import("ioredis")).default;
  const client = redisUrl
    ? new Redis(redisUrl)
    : new Redis({
        host: redisHost,
        port: Number(process.env.REDIS_PORT || 6379),
        password: process.env.REDIS_PASSWORD?.trim() || undefined,
      });
  try {
    const pong = await client.ping();
    const probeKey = "msgf:ping:probe";
    await client.set(probeKey, "ok", "EX", 60);
    const readBack = await client.get(probeKey);
    await client.del(probeKey);
    await client.quit();
    console.log("Backend: Redis TCP (ioredis)");
    console.log("PING:", pong);
    console.log("Round-trip SET/GET:", readBack);
    process.exit(0);
  } catch (e) {
    console.error(
      "Redis TCP configured but not reachable. Start local Redis or fix REDIS_URL:",
      e instanceof Error ? e.message : e
    );
    process.exit(1);
  }
}

console.error(
  "No Redis configured in packages/msgf/.env.local.\n" +
    "  Upstash: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN\n" +
    "  Local:   REDIS_URL=redis://127.0.0.1:6379"
);
process.exit(1);
