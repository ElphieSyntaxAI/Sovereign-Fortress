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
 * PromptIR — normalized OpenAI / Anthropic chat payloads for Active Governance.
 */

import { createHash } from "crypto";

import type { MsgfGatewayProvider } from "@/lib/gateway/types";

export type PromptIRMessage = {
  role: string;
  content: string;
};

export type PromptIR = {
  provider: MsgfGatewayProvider;
  model: string;
  system: string[];
  messages: PromptIRMessage[];
  tools?: unknown[];
  stream: boolean;
  project_origin?: string;
  promptHash: string;
  rawBody: unknown;
  maxTokens?: number;
};

function flattenContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const text = (block as { text?: unknown }).text;
    if (typeof text === "string") parts.push(text);
  }
  return parts.join("\n");
}

export function computePromptHash(parts: {
  system: string[];
  messages: PromptIRMessage[];
  model: string;
}): string {
  const normalized = JSON.stringify({
    model: parts.model,
    system: parts.system,
    messages: parts.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

export function parsePromptIR(
  provider: MsgfGatewayProvider,
  body: unknown,
  projectOrigin?: string | null
): PromptIR {
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const model =
    typeof o.model === "string" && o.model.trim() ? o.model.trim() : "unknown";
  const stream = Boolean(o.stream);
  const tools = Array.isArray(o.tools) ? o.tools : undefined;
  const maxTokens =
    typeof o.max_tokens === "number"
      ? o.max_tokens
      : typeof o.max_completion_tokens === "number"
        ? o.max_completion_tokens
        : undefined;

  const system: string[] = [];
  const messages: PromptIRMessage[] = [];

  if (provider === "anthropic") {
    if (typeof o.system === "string" && o.system.trim()) {
      system.push(o.system.trim());
    } else if (Array.isArray(o.system)) {
      for (const block of o.system) {
        const t = flattenContent(block);
        if (t.trim()) system.push(t.trim());
      }
    }
    if (Array.isArray(o.messages)) {
      for (const m of o.messages) {
        if (!m || typeof m !== "object") continue;
        const role = String((m as { role?: unknown }).role ?? "user");
        const content = flattenContent((m as { content?: unknown }).content);
        messages.push({ role, content });
      }
    }
  } else {
    if (Array.isArray(o.messages)) {
      for (const m of o.messages) {
        if (!m || typeof m !== "object") continue;
        const role = String((m as { role?: unknown }).role ?? "user");
        const content = flattenContent((m as { content?: unknown }).content);
        if (role === "system") {
          if (content.trim()) system.push(content.trim());
        } else {
          messages.push({ role, content });
        }
      }
    }
  }

  const promptHash = computePromptHash({ system, messages, model });

  return {
    provider,
    model,
    system,
    messages,
    tools,
    stream,
    project_origin: projectOrigin?.trim() || undefined,
    promptHash,
    rawBody: body,
    maxTokens,
  };
}

/**
 * Rebuild a provider JSON body from PromptIR (after state-gating prune).
 */
export function rebuildProviderBody(ir: PromptIR): unknown {
  const base =
    ir.rawBody && typeof ir.rawBody === "object"
      ? { ...(ir.rawBody as Record<string, unknown>) }
      : {};

  if (ir.provider === "anthropic") {
    return {
      ...base,
      model: ir.model,
      stream: ir.stream,
      system: ir.system.length === 1 ? ir.system[0] : ir.system.join("\n\n"),
      messages: ir.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      ...(ir.tools ? { tools: ir.tools } : {}),
      ...(ir.maxTokens != null ? { max_tokens: ir.maxTokens } : {}),
    };
  }

  const openaiMessages = [
    ...ir.system.map((s) => ({ role: "system", content: s })),
    ...ir.messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  return {
    ...base,
    model: ir.model,
    stream: ir.stream,
    messages: openaiMessages,
    ...(ir.tools ? { tools: ir.tools } : {}),
  };
}

export type PromptIRCompletion = {
  text: string;
  model: string;
  finishReason?: string;
};

/**
 * Shape a non-stream JSON completion in OpenAI or Anthropic wire format.
 */
export function formatJsonCompletion(
  ir: PromptIR,
  completion: PromptIRCompletion
): unknown {
  const id = `msgf-${ir.promptHash.slice(0, 12)}`;
  if (ir.provider === "anthropic") {
    return {
      id,
      type: "message",
      role: "assistant",
      model: completion.model || ir.model,
      content: [{ type: "text", text: completion.text }],
      stop_reason: completion.finishReason || "end_turn",
      usage: {
        input_tokens: 0,
        output_tokens: Math.max(1, Math.floor(completion.text.length / 4)),
      },
    };
  }

  return {
    id: `chatcmpl-${ir.promptHash.slice(0, 12)}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: completion.model || ir.model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: completion.text },
        finish_reason: completion.finishReason || "stop",
      },
    ],
    usage: {
      prompt_tokens: 0,
      completion_tokens: Math.max(1, Math.floor(completion.text.length / 4)),
      total_tokens: Math.max(1, Math.floor(completion.text.length / 4)),
    },
  };
}

/**
 * Minimal SSE stream for OpenAI or Anthropic clients from a cached text reply.
 */
export function formatSseCompletionStream(
  ir: PromptIR,
  completion: PromptIRCompletion
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const text = completion.text;

  if (ir.provider === "anthropic") {
    const events = [
      {
        type: "message_start",
        message: {
          id: `msgf-${ir.promptHash.slice(0, 12)}`,
          type: "message",
          role: "assistant",
          model: completion.model || ir.model,
          content: [],
          usage: { input_tokens: 0, output_tokens: 0 },
        },
      },
      {
        type: "content_block_start",
        index: 0,
        content_block: { type: "text", text: "" },
      },
      {
        type: "content_block_delta",
        index: 0,
        delta: { type: "text_delta", text },
      },
      { type: "content_block_stop", index: 0 },
      {
        type: "message_delta",
        delta: { stop_reason: "end_turn" },
        usage: {
          output_tokens: Math.max(1, Math.floor(text.length / 4)),
        },
      },
      { type: "message_stop" },
    ];
    return new ReadableStream({
      start(controller) {
        for (const ev of events) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
        }
        controller.close();
      },
    });
  }

  const chunk = {
    id: `chatcmpl-${ir.promptHash.slice(0, 12)}`,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: completion.model || ir.model,
    choices: [
      {
        index: 0,
        delta: { role: "assistant", content: text },
        finish_reason: null,
      },
    ],
  };
  const done = {
    ...chunk,
    choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
  };

  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(done)}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

export function formatResponseFromPromptIR(
  ir: PromptIR,
  completion: PromptIRCompletion,
  auditHeaders?: Record<string, string>
): Response {
  const headers = new Headers({
    "content-type": ir.stream ? "text/event-stream" : "application/json",
    "cache-control": "no-store",
  });
  if (auditHeaders) {
    for (const [k, v] of Object.entries(auditHeaders)) {
      headers.set(k, v);
    }
  }

  if (ir.stream) {
    return new Response(formatSseCompletionStream(ir, completion), {
      status: 200,
      headers,
    });
  }

  return new Response(JSON.stringify(formatJsonCompletion(ir, completion)), {
    status: 200,
    headers,
  });
}

/**
 * State-gate heuristic: drop oldest oversized user/assistant turns, keep system + last N.
 */
export function applyStateGatingToPromptIR(
  ir: PromptIR,
  options?: { maxMessageChars?: number; keepLastMessages?: number }
): { ir: PromptIR; tokensBefore: number; tokensAfter: number; applied: boolean } {
  const maxChars = options?.maxMessageChars ?? 24_000;
  const keepLast = options?.keepLastMessages ?? 6;

  const tokensBefore = Math.ceil(
    (ir.system.join("").length +
      ir.messages.reduce((n, m) => n + m.content.length, 0)) /
      4
  );

  let messages = [...ir.messages];
  let applied = false;

  if (messages.length > keepLast) {
    messages = messages.slice(-keepLast);
    applied = true;
  }

  messages = messages.map((m) => {
    if (m.content.length <= maxChars) return m;
    applied = true;
    const suffix = "\n…[state-gated truncated]";
    return {
      ...m,
      content: `${m.content.slice(0, Math.max(0, maxChars - suffix.length))}${suffix}`,
    };
  });

  const system = ir.system.map((s) => {
    if (s.length <= maxChars) return s;
    applied = true;
    const suffix = "\n…[state-gated truncated]";
    return `${s.slice(0, Math.max(0, maxChars - suffix.length))}${suffix}`;
  });

  const next: PromptIR = {
    ...ir,
    system,
    messages,
    promptHash: computePromptHash({ system, messages, model: ir.model }),
  };

  const tokensAfter = Math.ceil(
    (next.system.join("").length +
      next.messages.reduce((n, m) => n + m.content.length, 0)) /
      4
  );

  return { ir: next, tokensBefore, tokensAfter, applied };
}

/** Lightweight drift heuristic when full vault/HAL context is unavailable. */
export function assessGatewayDrift(ir: PromptIR): {
  score: number;
  escalate: boolean;
} {
  const chars =
    ir.system.join("").length +
    ir.messages.reduce((n, m) => n + m.content.length, 0);
  const hasConflict =
    /\b(contradict|override|ignore previous|jailbreak|bypass)\b/i.test(
      ir.messages.map((m) => m.content).join("\n")
    );
  let score = Math.min(1, chars / 80_000);
  if (hasConflict) score = Math.min(1, score + 0.35);
  if (ir.tools && ir.tools.length > 0) score = Math.min(1, score + 0.1);
  return { score, escalate: score >= 0.55 };
}
