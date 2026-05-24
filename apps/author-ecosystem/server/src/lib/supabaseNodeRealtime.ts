import type { SupabaseClientOptions } from "@supabase/supabase-js";
import ws from "ws";

/**
 * Node.js 20 has no global WebSocket — @supabase/realtime-js requires a transport on the BFF.
 * @see https://supabase.com/docs/guides/realtime/postgres-changes
 */
export function supabaseNodeClientOptions(
  overrides?: SupabaseClientOptions
): SupabaseClientOptions {
  return {
    ...overrides,
    realtime: {
      ...overrides?.realtime,
      transport: ws,
    },
  };
}
