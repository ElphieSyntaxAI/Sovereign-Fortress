import { type NextRequest, NextResponse } from "next/server";

const DEFAULT_PULSE_ORIGINS = [
  "https://elphiesyntax.com",
  "https://www.elphiesyntax.com",
  "https://elphiesgatedai.elphiesyntax.com",
  "https://syntaxeducates.elphiesyntax.com",
];

function configuredOrigins(): string[] {
  const raw = process.env.MSGF_CORS_ALLOWED_ORIGINS?.trim();
  if (raw) {
    return raw.split(",").map((o) => o.trim()).filter(Boolean);
  }
  return DEFAULT_PULSE_ORIGINS;
}

export function isPulseAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (configuredOrigins().includes(origin)) return true;
  if (process.env.NODE_ENV !== "production") {
    try {
      const u = new URL(origin);
      if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
        return true;
      }
    } catch {
      /* ignore */
    }
  }
  return false;
}

/** Attach CORS headers for credentialed cross-subdomain Pulse calls. */
export function applyPulseCorsHeaders(
  req: NextRequest,
  res: NextResponse
): NextResponse {
  const origin = req.headers.get("origin");
  if (origin && isPulseAllowedOrigin(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Credentials", "true");
    res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.headers.set(
      "Access-Control-Allow-Headers",
      [
        "Content-Type",
        "Authorization",
        "Cookie",
        "x-msgf-test-force-mismatch",
      ].join(", ")
    );
    res.headers.set("Vary", "Origin");
  }
  return res;
}

export function pulseCorsPreflightResponse(req: NextRequest): NextResponse {
  const res = new NextResponse(null, { status: 204 });
  return applyPulseCorsHeaders(req, res);
}

/** CORS for cross-origin incident reports (JSON POST, no cookies). */
export function applyIncidentReportCorsHeaders(
  req: NextRequest,
  res: NextResponse
): NextResponse {
  const origin = req.headers.get("origin");
  if (origin && isPulseAllowedOrigin(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Content-Type");
    res.headers.set("Vary", "Origin");
  }
  return res;
}

export function incidentReportCorsPreflightResponse(
  req: NextRequest
): NextResponse {
  const res = new NextResponse(null, { status: 204 });
  return applyIncidentReportCorsHeaders(req, res);
}
