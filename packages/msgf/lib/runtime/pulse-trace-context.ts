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
 * Distribution Build ID: MSGF-e3b90d5-20260522T030006Z-internal
 */
/**
 * Async request context for Pulse → Brain → Hall traceability (Node server only).
 */
import { AsyncLocalStorage } from "node:async_hooks";

export type PulseTraceStore = {
  /** Application correlation id (every Pulse gets one; returned to IDE). */
  traceId: string;
  /** Raw `X-Cloud-Trace-Context` header when present (for cross-linking with Cloud Trace). */
  gcpTraceHeader?: string;
};

const storage = new AsyncLocalStorage<PulseTraceStore>();

export function getPulseTraceContext(): PulseTraceStore | undefined {
  return storage.getStore();
}

export function runWithPulseTrace<T>(store: PulseTraceStore, fn: () => Promise<T>): Promise<T> {
  return storage.run(store, fn);
}
