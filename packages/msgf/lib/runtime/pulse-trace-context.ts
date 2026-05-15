/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * Distribution Build ID: MSGF-7175065-20260515T200509Z-internal
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
