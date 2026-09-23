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
import type { RealtimeClientOptions } from "@supabase/realtime-js";
import type { SupabaseClientOptions } from "@supabase/supabase-js";
import ws from "ws";

type SupabaseNodeOptions = SupabaseClientOptions<any>;
type RealtimeTransport = NonNullable<RealtimeClientOptions["transport"]>;

const nodeRealtimeTransport = ws as unknown as RealtimeTransport;

/** Node.js before 22 — supply WebSocket transport for Supabase Realtime on the server. */
export function supabaseNodeClientOptions(
  overrides?: SupabaseNodeOptions
): SupabaseNodeOptions {
  return {
    ...overrides,
    realtime: {
      ...overrides?.realtime,
      transport: nodeRealtimeTransport,
    },
  };
}
