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
 * Distribution Build ID: MSGF-e356216-20260522T181226Z-internal
 */
import { type NextRequest, NextResponse } from "next/server";

const DEFAULT_PULSE_ORIGINS = [
  "https://elphiesyntax.com",
  "https://www.elphiesyntax.com",
  "https://authorecosystem.elphiesyntax.com",
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
        "x-msgf-act-as-user",
        "x-msgf-admin-tiebreak",
        "x-msgf-license-key",
        "x-msgf-brain-sensitivity",
        "x-msgf-drift-threshold",
        "x-msgf-tenant-id",
        "x-msgf-entity-id",
        "x-msgf-ide-pulse",
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

const ADMIN_CORS_HEADERS = [
  "Content-Type",
  "Authorization",
  "x-msgf-act-as-user",
  "x-msgf-admin-tiebreak",
  "x-msgf-license-key",
  "x-msgf-brain-sensitivity",
  "x-msgf-drift-threshold",
  "x-msgf-tenant-id",
  "x-msgf-entity-id",
  "x-msgf-ide-pulse",
].join(", ");

/** CORS for M4 ops dashboard → admin + tie-break Pulse (Bearer auth, no cookies). */
export function applyAdminCorsHeaders(
  req: NextRequest,
  res: NextResponse
): NextResponse {
  const origin = req.headers.get("origin");
  if (origin && isPulseAllowedOrigin(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Methods", "GET, PATCH, POST, OPTIONS");
    res.headers.set("Access-Control-Allow-Credentials", "true");
    res.headers.set("Access-Control-Allow-Headers", ADMIN_CORS_HEADERS);
    res.headers.set("Vary", "Origin");
  }
  return res;
}

export function adminCorsPreflightResponse(req: NextRequest): NextResponse {
  const res = new NextResponse(null, { status: 204 });
  return applyAdminCorsHeaders(req, res);
}

export function incidentReportCorsPreflightResponse(
  req: NextRequest
): NextResponse {
  const res = new NextResponse(null, { status: 204 });
  return applyIncidentReportCorsHeaders(req, res);
}
