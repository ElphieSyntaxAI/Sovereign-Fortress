import type { SupabaseClientOptions } from "@supabase/supabase-js";
import ws from "ws";

/** Node.js before 22 — supply WebSocket transport for Supabase Realtime on the server. */
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
