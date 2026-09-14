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
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */
/**
 * Cost-runaway protections: bounded AI recursion depth and strict LLM request timeouts.
 */

import { AsyncLocalStorage } from "node:async_hooks";

/** Nested AI-chain waves beyond this depth throw {@link MaxRecursionDepthError}. */
export const MAX_RECURSION_DEPTH = 3;

/** Hard cap on wall-clock wait for outbound LLM networking (AbortSignal-backed paths abort earlier when wired). */
export const LLM_REQUEST_TIMEOUT_MS = 30_000;

const aiDepth = new AsyncLocalStorage<number>();

export class MaxRecursionDepthError extends Error {
  override readonly name = "MaxRecursionDepthError";
  constructor(
    public readonly depth: number,
    public readonly operation: string
  ) {
    super(
      `Max AI recursion depth ${MAX_RECURSION_DEPTH} exceeded (${operation}); attempted_depth=${depth}`
    );
  }
}

export class LlmTimeoutError extends Error {
  override readonly name = "LlmTimeoutError";
  constructor(
    public readonly operation: string,
    public readonly timeoutMs: number
  ) {
    super(`LLM request aborted after ${timeoutMs}ms (${operation})`);
  }
}

export function getAiRecursionDepth(): number {
  return aiDepth.getStore() ?? 0;
}

/**
 * Increments ALS recursion depth for one nested AI chain step (sequential waves).
 * Parallel LLM siblings inside the same wave should use {@link runWithLlmTimeoutSimple} only.
 */
export async function withAiRecursionDepth<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  const parent = getAiRecursionDepth();
  const next = parent + 1;
  if (next > MAX_RECURSION_DEPTH) {
    throw new MaxRecursionDepthError(next, operation);
  }
  return aiDepth.run(next, fn);
}

/** Alias: one sequential “wave” of AI work (may fan out inside with timeouts-only helpers). */
export async function executeAiWave<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  return withAiRecursionDepth(operation, fn);
}

export async function runWithLlmTimeoutSimple<T>(
  operation: string,
  fn: () => Promise<T>,
  timeoutMs = LLM_REQUEST_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, rej) => {
    timer = setTimeout(() => {
      controller.abort();
      rej(new LlmTimeoutError(operation, timeoutMs));
    }, timeoutMs);
  });
  try {
    return await Promise.race([fn(), timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

/** Prefer when the SDK accepts `AbortSignal` so the provider tears down the outbound request. */
export async function runWithLlmTimeout<T>(
  operation: string,
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs = LLM_REQUEST_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, rej) => {
    timer = setTimeout(() => {
      controller.abort();
      rej(new LlmTimeoutError(operation, timeoutMs));
    }, timeoutMs);
  });
  try {
    return await Promise.race([fn(controller.signal), timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

export async function executeGuardedLlm<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  return withAiRecursionDepth(operation, () => runWithLlmTimeoutSimple(operation, fn));
}

export async function executeGuardedLlmWithSignal<T>(
  operation: string,
  fn: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  return withAiRecursionDepth(operation, () => runWithLlmTimeout(operation, fn));
}

export function isCostRunawayError(e: unknown): boolean {
  if (e instanceof MaxRecursionDepthError || e instanceof LlmTimeoutError) return true;
  if (e instanceof Error && e.name === "AbortError") return true;
  const msg =
    e && typeof e === "object" && "message" in e && typeof (e as Error).message === "string"
      ? (e as Error).message
      : "";
  if (/aborted|AbortError/i.test(msg)) return true;
  return false;
}
