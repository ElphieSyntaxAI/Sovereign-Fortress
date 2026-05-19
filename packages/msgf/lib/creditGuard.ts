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
 * Distribution Build ID: MSGF-6d594fa-20260519T162432Z-internal
 */
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

import { isTenantApiKeyConfigured, resolveTenantIdFromApiKey } from "@/lib/api-key-tenant";

async function sha256HexPrefix(input: string, maxLen = 24): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex.slice(0, maxLen);
}

/** Cumulative token ceiling per `usage_monitor.user_id` before 429. */
export const MSGF_TOKEN_HARD_CAP = 1_000_000;

/** Default billing soft cap (USD) when `MSGF_BILLING_SOFT_CAP_USD` is unset. */
export const MSGF_DEFAULT_BILLING_SOFT_CAP_USD = 50;

/** Beta / default Gemini when `DEEP_AUDIT` is not active (middleware sets request header). */
export const MSGF_BETA_GEMINI_MODEL = "gemini-1.5-flash";

export const CREDIT_GUARD_HEADER_MODEL = "x-msgf-credit-guard-model";
const DEEP_AUDIT_HEADER = "x-msgf-deep-audit";

export function isDeepAuditRequest(request: NextRequest): boolean {
  const h = request.headers.get(DEEP_AUDIT_HEADER)?.trim().toLowerCase();
  if (h === "1" || h === "true" || h === "yes") return true;
  const q = request.nextUrl.searchParams.get("deep_audit")?.trim().toLowerCase();
  return q === "1" || q === "true" || q === "yes";
}

export function pickForcedGeminiModelForMsgf(request: NextRequest): string {
  return isDeepAuditRequest(request)
    ? process.env.MSGF_VERTEX_MODEL?.trim() || "gemini-2.5-flash"
    : MSGF_BETA_GEMINI_MODEL;
}

export function resolveCreditGuardGeminiModelId(request: NextRequest): string {
  const fromMiddleware = request.headers.get(CREDIT_GUARD_HEADER_MODEL)?.trim();
  if (fromMiddleware) return fromMiddleware;
  return pickForcedGeminiModelForMsgf(request);
}

export function applyMsgfCreditModelHeader(request: NextRequest): NextRequest {
  const headers = new Headers(request.headers);
  headers.set(CREDIT_GUARD_HEADER_MODEL, pickForcedGeminiModelForMsgf(request));
  return new NextRequest(request, { headers });
}

export async function estimateIncomingRequestTokens(request: NextRequest, maxEstimate = 100_000): Promise<number> {
  const urlPart = Math.ceil(request.nextUrl.toString().length / 4);
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") {
    return Math.min(maxEstimate, urlPart + 64);
  }
  try {
    const clone = request.clone();
    const text = await clone.text();
    return Math.min(maxEstimate, Math.ceil(text.length / 4) + urlPart);
  } catch {
    return Math.min(maxEstimate, 4_096);
  }
}

function billingSoftCapUsd(): number {
  const raw = process.env.MSGF_BILLING_SOFT_CAP_USD?.trim();
  const n = raw ? Number(raw) : MSGF_DEFAULT_BILLING_SOFT_CAP_USD;
  return Number.isFinite(n) && n > 0 ? n : MSGF_DEFAULT_BILLING_SOFT_CAP_USD;
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    throw new Error("MSGF credit guard: missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or ANON).");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function librarianRestingResponse(): NextResponse {
  return NextResponse.json(
    { error: "Librarian is resting", code: "CREDIT_GUARD_429" },
    { status: 429 }
  );
}

async function resolveCreditActorKey(request: NextRequest): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (supabaseUrl && supabaseKey) {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          /* read-only for id resolution */
        },
      },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) return user.id;
  }

  if (isTenantApiKeyConfigured()) {
    const apiKey =
      request.headers.get("x-msgf-api-key")?.trim() ||
      (request.headers.get("authorization")?.toLowerCase().startsWith("bearer ")
        ? request.headers.get("authorization")!.slice(7).trim()
        : null);
    const tenant = resolveTenantIdFromApiKey(apiKey);
    if (tenant) return `tenant:${tenant}`;
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "0.0.0.0";
  const ua = request.headers.get("user-agent")?.slice(0, 120) || "";
  const digest = await sha256HexPrefix(`${ip}|${ua}`);
  return `anon:${digest}`;
}

async function fetchUsageTokens(userKey: string): Promise<bigint> {
  const admin = supabaseAdmin();
  const { data, error } = await admin.from("usage_monitor").select("tokens_cumulative").eq("user_id", userKey).maybeSingle();
  if (error) {
    console.warn("[creditGuard] usage_monitor read failed:", error.message);
    return BigInt(0);
  }
  const n = (data as { tokens_cumulative?: string | number } | null)?.tokens_cumulative ?? 0;
  try {
    return BigInt(typeof n === "string" ? n : Math.floor(Number(n)));
  } catch {
    return BigInt(0);
  }
}

async function fetchProjectSpendUsd(): Promise<number> {
  const env = process.env.MSGF_PROJECT_SPEND_USD?.trim();
  if (env && Number.isFinite(Number(env))) return Number(env);

  const admin = supabaseAdmin();
  const { data, error } = await admin.from("msgf_project_billing").select("spend_usd").eq("id", 1).maybeSingle();
  if (error) {
    console.warn("[creditGuard] msgf_project_billing read failed:", error.message);
    return 0;
  }
  const raw = (data as { spend_usd?: string | number } | null)?.spend_usd;
  const n = typeof raw === "string" ? Number(raw) : Number(raw ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function assertMsgfCreditsOr429(request: NextRequest): Promise<NextResponse | null> {
  if (process.env.MSGF_CREDIT_GUARD_DISABLED === "true") {
    return null;
  }

  try {
    const userKey = await resolveCreditActorKey(request);
    const [used, spendUsd, incoming] = await Promise.all([
      fetchUsageTokens(userKey),
      fetchProjectSpendUsd(),
      estimateIncomingRequestTokens(request),
    ]);

    const incomingN = BigInt(incoming);
    if (used + incomingN > BigInt(MSGF_TOKEN_HARD_CAP)) {
      return librarianRestingResponse();
    }

    if (spendUsd >= billingSoftCapUsd()) {
      return librarianRestingResponse();
    }

    return null;
  } catch (e) {
    console.error("[creditGuard]", e);
    return null;
  }
}

