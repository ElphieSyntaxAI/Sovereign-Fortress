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
 * Distribution Build ID: MSGF-191e80fa-20260921T055901Z-internal
 */
/**
 * M3 — commercial entitlement gate for MSGF Brain (`POST /api/msgf/pulse`).
 *
 * Reads `p4_profiles.tier_id`, `current_credits`, `stripe_subscription_status`, and
 * `billing_license_type`.
 *
 * Mock vs live:
 * - `MSGF_ENTITLEMENT_MOCK_STRIPE_ACTIVE=1` → monthly users pass without DB `active`.
 * - `MSGF_ENTITLEMENT_MOCK_STRIPE_ACTIVE=0` → enforce real `stripe_subscription_status`
 *   (and lifetime credits). Prefer flipping with `MSGF_STRIPE_WEBHOOK_LIVE=1`.
 */

import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

import { isProductionDeploy } from "@/lib/deploy-env";
import {
  evaluateManagedCloudWindow,
  isIndividualTrial3dLicenseType,
  managedCloudWindowMsForLicenseType,
} from "@/lib/services/individual-perpetual-license";

export const ERR_CREDIT_GUARD_EXHAUSTED = "ERR_CREDIT_GUARD_EXHAUSTED" as const;

export type BillingLicenseType = "free" | "monthly" | "lifetime";

export type P4ProfileEntitlementRow = {
  user_id: string;
  tier_id: number | null;
  current_credits: number;
  stripe_subscription_status: string | null;
  billing_license_type: BillingLicenseType;
  license_type?: string | null;
  license_purchase_date?: string | null;
};

export type EntitlementEvaluation = {
  allowed: boolean;
  reason?: string;
  profile?: P4ProfileEntitlementRow;
};

const PULSE_PATH = "/api/msgf/pulse";

function entitlementDisabled(): boolean {
  const v = process.env.MSGF_ENTITLEMENT_GUARD_DISABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** When true, monthly users pass without `stripe_subscription_status = active` in DB. */
export function mockStripeSubscriptionActive(): boolean {
  if (isProductionDeploy()) return false;
  const v = process.env.MSGF_ENTITLEMENT_MOCK_STRIPE_ACTIVE?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no") return false;
  if (v === "1" || v === "true" || v === "yes") return true;
  // Default mock ON until Stripe webhook is explicitly marked live (local/staging only).
  const live = process.env.MSGF_STRIPE_WEBHOOK_LIVE?.trim().toLowerCase();
  return live !== "true" && live !== "1" && live !== "yes";
}

export function isPulseEntitlementPath(pathname: string): boolean {
  return pathname === PULSE_PATH || pathname.endsWith(PULSE_PATH);
}

export function entitlementExhaustedResponse(detail?: string): NextResponse {
  return NextResponse.json(
    {
      error: detail ?? "MSGF entitlement exhausted.",
      code: ERR_CREDIT_GUARD_EXHAUSTED,
    },
    { status: 429 }
  );
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      "MSGF entitlement guard: missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function resolveAuthUserId(request: NextRequest): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (supabaseUrl && supabaseKey) {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          /* read-only */
        },
      },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) return user.id;
  }

  return null;
}

async function fetchProfileEntitlements(
  admin: ReturnType<typeof supabaseAdmin>,
  userId: string
): Promise<P4ProfileEntitlementRow | null> {
  const { data, error } = await admin
    .from("p4_profiles")
    .select(
      "user_id, tier_id, current_credits, stripe_subscription_status, billing_license_type, license_type, license_purchase_date"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[entitlementGuard] p4_profiles read failed:", error.message);
    return null;
  }
  if (!data) return null;

  const license = String(data.billing_license_type ?? "monthly").toLowerCase();
  const billing_license_type: BillingLicenseType =
    license === "lifetime" || license === "free" ? license : "monthly";

  return {
    user_id: data.user_id as string,
    tier_id: data.tier_id != null ? Number(data.tier_id) : null,
    current_credits: Number(data.current_credits ?? 0),
    stripe_subscription_status: data.stripe_subscription_status
      ? String(data.stripe_subscription_status)
      : null,
    billing_license_type,
    license_type:
      typeof data.license_type === "string" ? data.license_type : null,
    license_purchase_date:
      typeof data.license_purchase_date === "string"
        ? data.license_purchase_date
        : null,
  };
}

function isStripeSubscriptionActive(status: string | null, mock: boolean): boolean {
  if (status?.trim().toLowerCase() === "active") return true;
  // Mock ON: treat missing/unknown as active for soft launch.
  // Mock OFF: only explicit `active` passes — past_due / canceled / null block Pulse.
  return mock;
}

/**
 * P3 hybrid license rules (see `.cursorrules`):
 * - **monthly** — active Stripe subscription (mocked when webhook pending).
 * - **lifetime** — `current_credits > 0`.
 * - **free** — Brain (`/api/msgf/pulse`) blocked unless promotional credits > 0.
 */
export function evaluatePulseEntitlement(
  profile: P4ProfileEntitlementRow,
  opts?: { mockStripeActive?: boolean; now?: Date }
): EntitlementEvaluation {
  const mock = opts?.mockStripeActive ?? mockStripeSubscriptionActive();
  const credits = Number.isFinite(profile.current_credits) ? profile.current_credits : 0;
  const now = opts?.now ?? new Date();

  if (isIndividualTrial3dLicenseType(profile.license_type)) {
    const purchase = profile.license_purchase_date
      ? new Date(profile.license_purchase_date)
      : null;
    const window = evaluateManagedCloudWindow(
      purchase && !Number.isNaN(purchase.getTime()) ? purchase : null,
      now,
      managedCloudWindowMsForLicenseType(profile.license_type)
    );
    if (window.managedCloudExpired) {
      return {
        allowed: false,
        reason: "3-day Individual Pro trial has ended.",
        profile,
      };
    }
    if (credits <= 0) {
      return {
        allowed: false,
        reason: "Lifetime license has no update credits remaining.",
        profile,
      };
    }
    return { allowed: true, profile };
  }

  if (profile.billing_license_type === "lifetime") {
    if (credits <= 0) {
      return {
        allowed: false,
        reason: "Lifetime license has no update credits remaining.",
        profile,
      };
    }
    return { allowed: true, profile };
  }

  if (profile.billing_license_type === "monthly") {
    if (!isStripeSubscriptionActive(profile.stripe_subscription_status, mock)) {
      return {
        allowed: false,
        reason: mock
          ? "Monthly subscription is not active (Stripe status missing or inactive)."
          : "Monthly subscription is not active.",
        profile,
      };
    }
    return { allowed: true, profile };
  }

  // free tier — gate Brain; allow only if explicit promotional credits exist.
  if (credits <= 0) {
    return {
      allowed: false,
      reason: "Free tier cannot access MSGF Pulse without credits or a paid license.",
      profile,
    };
  }
  return { allowed: true, profile };
}

/**
 * Blocks `POST /api/msgf/pulse` when entitlement checks fail.
 * Returns `null` when the request may proceed (or guard is disabled / path skipped).
 */
export async function assertPulseEntitlementOr429(
  request: NextRequest
): Promise<NextResponse | null> {
  if (entitlementDisabled()) return null;
  if (!isPulseEntitlementPath(request.nextUrl.pathname)) return null;
  if (request.method !== "POST") return null;

  // Do not import `@/lib/msgf` here — middleware runs on the Edge runtime and cannot bundle
  // Node-only deps (Redis, full Msgf graph). `Msgf.init` entitlement hooks apply in Node routes only.

  const userId = await resolveAuthUserId(request);
  if (!userId) {
    return null;
  }

  let admin;
  try {
    admin = supabaseAdmin();
  } catch (e) {
    console.error("[entitlementGuard]", e);
    return null;
  }

  const profile = await fetchProfileEntitlements(admin, userId);
  if (!profile) {
    return entitlementExhaustedResponse("No p4_profiles row for this account.");
  }

  const evaluation = evaluatePulseEntitlement(profile);
  if (!evaluation.allowed) {
    return entitlementExhaustedResponse(evaluation.reason);
  }

  return null;
}
