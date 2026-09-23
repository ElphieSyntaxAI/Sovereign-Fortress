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
 * Distribution Build ID: MSGF-08289e1a-20260923T172846Z-internal
 */
/**
 * Zero-latency Shadow Proxy fast path — pass-through to upstream with stream tee for usage.
 */

import { sanitizeUpstreamHeaders } from "@/lib/gateway/header-sanitizer";
import type { CapturedProviderUsage, MsgfGatewayProvider } from "@/lib/gateway/types";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

export function upstreamBaseUrl(provider: MsgfGatewayProvider): string {
  if (provider === "anthropic") {
    return (
      process.env.MSGF_ANTHROPIC_UPSTREAM_BASE?.trim() || "https://api.anthropic.com"
    ).replace(/\/$/, "");
  }
  return (
    process.env.MSGF_OPENAI_UPSTREAM_BASE?.trim() || "https://api.openai.com"
  ).replace(/\/$/, "");
}

/** @deprecated Prefer sanitizeUpstreamHeaders — kept as thin wrapper for callers. */
export function buildUpstreamHeaders(
  req: Request,
  provider: MsgfGatewayProvider,
  upstreamApiKey: string
): Headers {
  return sanitizeUpstreamHeaders(req.headers, provider, upstreamApiKey);
}

export function extractPromptTextFromBody(
  provider: MsgfGatewayProvider,
  body: unknown
): string {
  if (!body || typeof body !== "object") return "";
  const o = body as Record<string, unknown>;

  if (provider === "anthropic") {
    const parts: string[] = [];
    if (typeof o.system === "string") parts.push(o.system);
    if (Array.isArray(o.messages)) {
      for (const m of o.messages) {
        if (!m || typeof m !== "object") continue;
        const content = (m as { content?: unknown }).content;
        if (typeof content === "string") parts.push(content);
        else if (Array.isArray(content)) {
          for (const block of content) {
            if (
              block &&
              typeof block === "object" &&
              typeof (block as { text?: string }).text === "string"
            ) {
              parts.push((block as { text: string }).text);
            }
          }
        }
      }
    }
    return parts.join("\n");
  }

  // OpenAI chat completions
  const parts: string[] = [];
  if (Array.isArray(o.messages)) {
    for (const m of o.messages) {
      if (!m || typeof m !== "object") continue;
      const content = (m as { content?: unknown }).content;
      if (typeof content === "string") parts.push(content);
      else if (Array.isArray(content)) {
        for (const block of content) {
          if (
            block &&
            typeof block === "object" &&
            typeof (block as { text?: string }).text === "string"
          ) {
            parts.push((block as { text: string }).text);
          }
        }
      }
    }
  }
  return parts.join("\n");
}

export function extractModelFromBody(body: unknown): string {
  if (!body || typeof body !== "object") return "unknown";
  const m = (body as { model?: unknown }).model;
  return typeof m === "string" && m.trim() ? m.trim() : "unknown";
}

export function isStreamingBody(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  return Boolean((body as { stream?: unknown }).stream);
}

function parseOpenAiUsage(json: unknown, model: string): CapturedProviderUsage | null {
  if (!json || typeof json !== "object") return null;
  const usage = (json as { usage?: Record<string, unknown> }).usage;
  if (!usage) return null;
  const input = Math.floor(Number(usage.prompt_tokens ?? usage.input_tokens ?? 0));
  const output = Math.floor(Number(usage.completion_tokens ?? usage.output_tokens ?? 0));
  const total =
    Math.floor(Number(usage.total_tokens ?? 0)) ||
    (input > 0 || output > 0 ? input + output : 0);
  if (total <= 0) return null;
  return {
    input_tokens: Math.max(0, input),
    output_tokens: Math.max(0, output),
    total_tokens: total,
    usage_source: "provider",
    model:
      typeof (json as { model?: string }).model === "string"
        ? (json as { model: string }).model
        : model,
  };
}

function parseAnthropicUsage(json: unknown, model: string): CapturedProviderUsage | null {
  if (!json || typeof json !== "object") return null;
  const usage = (json as { usage?: Record<string, unknown> }).usage;
  if (!usage) return null;
  const input = Math.floor(Number(usage.input_tokens ?? 0));
  const output = Math.floor(Number(usage.output_tokens ?? 0));
  const total = input + output;
  if (total <= 0) return null;
  return {
    input_tokens: Math.max(0, input),
    output_tokens: Math.max(0, output),
    total_tokens: total,
    usage_source: "provider",
    model:
      typeof (json as { model?: string }).model === "string"
        ? (json as { model: string }).model
        : model,
  };
}

function estimateFromPrompt(promptText: string, model: string): CapturedProviderUsage {
  const input = Math.max(1, Math.floor(promptText.length / 4));
  const output = Math.max(16, Math.floor(input * 0.25));
  return {
    input_tokens: input,
    output_tokens: output,
    total_tokens: input + output,
    usage_source: "estimated",
    model,
  };
}

function mergeUsageFromSseChunk(
  provider: MsgfGatewayProvider,
  chunk: string,
  model: string,
  acc: CapturedProviderUsage | null
): CapturedProviderUsage | null {
  const lines = chunk.split("\n");
  let current = acc;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const data = trimmed.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    try {
      const json = JSON.parse(data) as Record<string, unknown>;
      if (provider === "openai") {
        const u = parseOpenAiUsage(json, model);
        if (u) current = u;
        // Some streams put usage on the final chunk only.
        if (json.usage && typeof json.usage === "object") {
          const u2 = parseOpenAiUsage(json, model);
          if (u2) current = u2;
        }
      } else {
        if (json.type === "message_delta" || json.type === "message_start") {
          const usage = (json.usage ??
            (json.message as { usage?: unknown } | undefined)?.usage) as
            | Record<string, unknown>
            | undefined;
          if (usage) {
            const u = parseAnthropicUsage({ usage, model }, model);
            if (u) {
              current = current
                ? {
                    ...current,
                    input_tokens: Math.max(current.input_tokens, u.input_tokens),
                    output_tokens: Math.max(current.output_tokens, u.output_tokens),
                    total_tokens: Math.max(current.total_tokens, u.total_tokens),
                    usage_source: "provider",
                  }
                : u;
            }
          }
        }
        if (json.type === "message_stop" && json.usage) {
          const u = parseAnthropicUsage(json, model);
          if (u) current = u;
        }
      }
    } catch {
      /* ignore partial SSE */
    }
  }
  return current;
}

export type ShadowFastPathResult = {
  response: Response;
  /** Resolves after the client-facing stream fully drains (or non-stream body is read). */
  usagePromise: Promise<CapturedProviderUsage>;
  /** Active orchestrator: skip duplicate shadow eval when already handled. */
  skipShadowEval?: boolean;
  /** Active orchestrator: skip background meter when already recorded. */
  skipBackgroundMeter?: boolean;
  promptHash?: string;
  routing?: string;
  tokensSaved?: number;
};

/**
 * Proxy to upstream. Streams bytes to client; tees for usage capture.
 */
export async function runShadowFastPath(params: {
  req: Request;
  provider: MsgfGatewayProvider;
  upstreamPath: string;
  upstreamApiKey: string;
  rawBody: string;
  parsedBody: unknown;
  promptText: string;
  model: string;
}): Promise<ShadowFastPathResult> {
  const stream = isStreamingBody(params.parsedBody);
  const url = `${upstreamBaseUrl(params.provider)}${params.upstreamPath}`;
  const headers = sanitizeUpstreamHeaders(
    params.req.headers,
    params.provider,
    params.upstreamApiKey
  );
  headers.set("content-type", "application/json");

  const upstream = await fetch(url, {
    method: "POST",
    headers,
    body: params.rawBody,
  });

  if (!stream || !upstream.body) {
    const text = await upstream.text();
    let usage: CapturedProviderUsage | null = null;
    try {
      const json = JSON.parse(text) as unknown;
      usage =
        params.provider === "openai"
          ? parseOpenAiUsage(json, params.model)
          : parseAnthropicUsage(json, params.model);
    } catch {
      usage = null;
    }
    const finalUsage = usage ?? estimateFromPrompt(params.promptText, params.model);
    const response = new Response(text, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: filterResponseHeaders(upstream.headers),
    });
    return { response, usagePromise: Promise.resolve(finalUsage) };
  }

  let resolveUsage!: (u: CapturedProviderUsage) => void;
  const usagePromise = new Promise<CapturedProviderUsage>((resolve) => {
    resolveUsage = resolve;
  });

  let captured: CapturedProviderUsage | null = null;
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let carry = "";

  const tee = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body!.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            controller.enqueue(value);
            carry += decoder.decode(value, { stream: true });
            // Process complete SSE events opportunistically.
            const parts = carry.split("\n\n");
            carry = parts.pop() ?? "";
            for (const part of parts) {
              captured = mergeUsageFromSseChunk(
                params.provider,
                part,
                params.model,
                captured
              );
            }
          }
        }
        if (carry.trim()) {
          captured = mergeUsageFromSseChunk(
            params.provider,
            carry,
            params.model,
            captured
          );
        }
        resolveUsage(captured ?? estimateFromPrompt(params.promptText, params.model));
        controller.close();
      } catch (e) {
        resolveUsage(captured ?? estimateFromPrompt(params.promptText, params.model));
        controller.error(e);
      }
    },
  });

  // Keep unused encoder reference quiet for bundlers that tree-shake oddly.
  void encoder;

  const response = new Response(tee, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: filterResponseHeaders(upstream.headers),
  });

  return { response, usagePromise };
}

function filterResponseHeaders(src: Headers): Headers {
  const out = new Headers();
  src.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower)) return;
    if (lower === "content-encoding") return;
    out.set(key, value);
  });
  return out;
}

/**
 * Active mode Phase 1: pass-through + return usage for sync metering (no optimization yet).
 */
export async function runActivePassThrough(params: {
  req: Request;
  provider: MsgfGatewayProvider;
  upstreamPath: string;
  upstreamApiKey: string;
  rawBody: string;
  parsedBody: unknown;
  promptText: string;
  model: string;
}): Promise<ShadowFastPathResult> {
  return runShadowFastPath(params);
}
