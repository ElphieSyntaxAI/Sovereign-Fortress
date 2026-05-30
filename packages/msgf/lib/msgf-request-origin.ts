import type { NextRequest } from "next/server";

import { resolveMsgfAppOrigin } from "@elphie-syntax/core/platform-admin-auth";

import { requestHostFromRequest } from "@/utils/supabase/server";

/**
 * Public browser origin for redirects. Cloud Run sets HOSTNAME=0.0.0.0 so
 * `req.nextUrl.origin` becomes https://0.0.0.0:8080 (502 in the browser).
 */
export function resolveMsgfRequestOrigin(req: NextRequest): string {
  const fromEnv = resolveMsgfAppOrigin({
    env: process.env,
    hostname: requestHostFromRequest(req),
  });
  if (fromEnv && !fromEnv.includes("0.0.0.0")) return fromEnv;

  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  const host = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (host && !host.includes("0.0.0.0")) {
    return `${proto}://${host}`;
  }

  try {
    const { origin, hostname } = new URL(req.url);
    if (hostname && hostname !== "0.0.0.0" && !hostname.startsWith("localhost")) {
      return origin;
    }
  } catch {
    /* fall through */
  }

  return fromEnv || "https://elphiesgatedai.elphiesyntax.com";
}
