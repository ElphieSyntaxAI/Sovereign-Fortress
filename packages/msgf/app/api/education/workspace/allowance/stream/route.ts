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
 * Distribution Build ID: MSGF-3ea5d0e-20260529T033030Z-internal
 */
/**
 * GET /api/education/workspace/allowance/stream?assignmentId=
 *
 * Server-Sent Events stream for Layer B updates (Layer A toolbox unchanged).
 */
import { NextRequest } from "next/server";

import type { LayerBAllowanceEvent } from "@elphie-syntax/core";

import { allowancePubSubChannel } from "@/lib/education/workspace/allowance-broadcast";
import { readCachedAssignmentAllowance } from "@/lib/education/workspace/allowance-broadcast";
import { getRedisClient, isRedisConfigured } from "@/lib/redis-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sseEncode(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(req: NextRequest) {
  const assignmentId = req.nextUrl.searchParams.get("assignmentId")?.trim();
  if (!assignmentId) {
    return new Response("assignmentId required", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const push = (event: string, payload: unknown) => {
        controller.enqueue(encoder.encode(sseEncode(event, payload)));
      };

      const cached = await readCachedAssignmentAllowance(assignmentId);
      if (cached) {
        push("layer_b_allowance_updated", cached);
      }

      push("connected", {
        assignmentId,
        layerAUnchanged: true,
        at: new Date().toISOString(),
      });

      if (!isRedisConfigured()) {
        const interval = setInterval(async () => {
          const latest = await readCachedAssignmentAllowance(assignmentId);
          if (latest) push("layer_b_allowance_updated", latest);
        }, 5000);

        req.signal.addEventListener("abort", () => {
          clearInterval(interval);
          controller.close();
        });
        return;
      }

      const redis = getRedisClient();
      if (!redis) {
        controller.close();
        return;
      }

      const sub = redis.duplicate();
      const channel = allowancePubSubChannel(assignmentId);

      await sub.subscribe(channel);
      sub.on("message", (_ch, message) => {
        try {
          const parsed = JSON.parse(message) as LayerBAllowanceEvent;
          push("layer_b_allowance_updated", parsed);
        } catch {
          push("error", { message: "Invalid allowance payload" });
        }
      });

      const heartbeat = setInterval(() => {
        push("heartbeat", { at: new Date().toISOString() });
      }, 25000);

      req.signal.addEventListener("abort", async () => {
        clearInterval(heartbeat);
        try {
          await sub.unsubscribe(channel);
          sub.disconnect();
        } catch {
          /* ignore */
        }
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
