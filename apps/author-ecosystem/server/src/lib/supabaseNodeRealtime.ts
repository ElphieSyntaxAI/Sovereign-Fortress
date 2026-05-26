import type { RealtimeClientOptions } from "@supabase/realtime-js";
import type { SupabaseClientOptions } from "@supabase/supabase-js";
import ws from "ws";

/** BFF uses schema-agnostic Supabase client options (realtime transport only). */
type SupabaseNodeOptions = SupabaseClientOptions<any>;
type RealtimeTransport = NonNullable<RealtimeClientOptions["transport"]>;

/** Node `ws` satisfies runtime; Supabase types expect WebSocketLikeConstructor. */
const nodeRealtimeTransport = ws as unknown as RealtimeTransport;

/**
 * Node.js 20 has no global WebSocket — @supabase/realtime-js requires a transport on the BFF.
 * @see https://supabase.com/docs/guides/realtime/postgres-changes
 */
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
