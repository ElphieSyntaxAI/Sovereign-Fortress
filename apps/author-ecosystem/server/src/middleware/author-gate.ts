/**
 * Author BFF gate — **Supabase (`@supabase/supabase-js`) only**.
 *
 * - Guild / Apprentice tier resolution via `p4_guild_tier_counters` + `p4_projects`.
 * - Manuscript **session** scope: `p4_manuscripts` row must exist and `tenant_id` must match the caller.
 * - MSGF universal P1 HAL envelope (no local `dbConfig` / `pg` pool).
 *
 * @see packages/msgf/.msgf/P1_HAL.md
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  assertP1UniversalNonPolluted,
  type UniversalP1KeystrokeEvent,
  type UniversalP1PulseBody,
  toUniversalP1PulseBody,
} from "msgf/universal/p1-hal-standard";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";

/** Author-only metadata (never sent to MSGF universal verification). */
export type AuthorSpecificP1Wrapper = {
  bookTitle?: string | null;
  tierPriceDisplay?: string | null;
  internalNote?: string | null;
};

export type AuthorGateTierKind = "apprentice" | "guild";

export type AuthorGateTierResolution = {
  ok: true;
  kinds: AuthorGateTierKind[];
  tenantId: string;
  userId: string;
  manuscriptId: string | null;
  guildCounterPresent: boolean;
  guildVerifiedProjectCount: number;
  apprenticeSubsidized: boolean;
};

export type AuthorGateDenied = {
  ok: false;
  reason: string;
};

export type AuthorGateP1Result =
  | {
      ok: true;
      tier: AuthorGateTierResolution;
      universal: UniversalP1PulseBody;
      authorOnly: AuthorSpecificP1Wrapper;
    }
  | AuthorGateDenied;

export type BffManuscriptSessionDenied = { ok: false; reason: string };
export type BffManuscriptSessionOk = {
  ok: true;
  manuscript: { id: string; tenant_id: string };
};

/**
 * Validates BFF “session” scope: manuscript exists under the claimed tenant (JWT + client `tenant_id`).
 * Uses service-role Supabase only — no `dbConfig` pool.
 */
export async function assertBffManuscriptTenantSession(
  supabase: SupabaseClient,
  input: { manuscriptId: string; tenantId: string }
): Promise<BffManuscriptSessionOk | BffManuscriptSessionDenied> {
  const manuscriptId = input.manuscriptId.trim();
  const tenantId = input.tenantId.trim();
  if (!manuscriptId || !tenantId) {
    return { ok: false, reason: "manuscriptId and tenantId are required" };
  }

  const { data, error } = await supabase
    .from("p4_manuscripts")
    .select("id, tenant_id")
    .eq("id", manuscriptId)
    .maybeSingle();

  if (error) {
    return { ok: false, reason: `manuscript read failed: ${error.message}` };
  }
  if (!data) {
    return { ok: false, reason: "Manuscript not found" };
  }
  const tid = String((data as { tenant_id: string }).tenant_id);
  if (tid !== tenantId) {
    return { ok: false, reason: "tenant_id does not match manuscript" };
  }

  return { ok: true, manuscript: data as { id: string; tenant_id: string } };
}

/**
 * Guild + Apprentice tier resolution (MSGF billing / guild counters) — Supabase only.
 */
export async function resolveApprenticeOrGuildTier(
  supabase: SupabaseClient,
  input: { tenantId: string; userId: string; manuscriptId?: string | null }
): Promise<AuthorGateTierResolution | AuthorGateDenied> {
  const tenantId = input.tenantId.trim();
  const userId = input.userId.trim();
  const manuscriptId = input.manuscriptId?.trim() || null;

  if (!tenantId || !userId) {
    return { ok: false, reason: "tenantId and userId are required" };
  }

  const { data: guildRow, error: guildErr } = await supabase
    .from("p4_guild_tier_counters")
    .select("tenant_id, project_count")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (guildErr) {
    return { ok: false, reason: `guild tier lookup failed: ${guildErr.message}` };
  }

  const guildCounterPresent = Boolean(guildRow);
  const guildVerifiedProjectCount = Number((guildRow as { project_count?: number } | null)?.project_count ?? 0) || 0;

  let apprenticeSubsidized = false;

  if (manuscriptId) {
    const { data: proj, error: pErr } = await supabase
      .from("p4_projects")
      .select("id, billing_state, manuscript_id")
      .eq("tenant_id", tenantId)
      .eq("manuscript_id", manuscriptId)
      .maybeSingle();

    if (pErr) {
      return { ok: false, reason: `apprentice project lookup failed: ${pErr.message}` };
    }
    apprenticeSubsidized = (proj as { billing_state?: string } | null)?.billing_state === "SUBSIDIZED_APPRENTICE";
  } else {
    const { data: anyApp, error: aErr } = await supabase
      .from("p4_projects")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("billing_state", "SUBSIDIZED_APPRENTICE")
      .limit(1);

    if (aErr) {
      return { ok: false, reason: `apprentice scan failed: ${aErr.message}` };
    }
    apprenticeSubsidized = Array.isArray(anyApp) && anyApp.length > 0;
  }

  const kinds: AuthorGateTierKind[] = [];
  if (apprenticeSubsidized) kinds.push("apprentice");
  if (guildCounterPresent) kinds.push("guild");

  if (kinds.length === 0) {
    return {
      ok: false,
      reason:
        "No eligible Apprentice or Guild tier: need `p4_projects.billing_state = SUBSIDIZED_APPRENTICE` " +
        "and/or a `p4_guild_tier_counters` row for this tenant.",
    };
  }

  return {
    ok: true,
    kinds,
    tenantId,
    userId,
    manuscriptId,
    guildCounterPresent,
    guildVerifiedProjectCount,
    apprenticeSubsidized,
  };
}

/**
 * Tier + manuscript tenant session in one call (typical BFF handler prelude).
 */
export async function resolveBffAuthorGateContext(
  supabase: SupabaseClient,
  input: { userId: string; tenantId: string; manuscriptId: string }
): Promise<
  | { ok: true; tier: AuthorGateTierResolution; manuscript: { id: string; tenant_id: string } }
  | AuthorGateDenied
  | BffManuscriptSessionDenied
> {
  const session = await assertBffManuscriptTenantSession(supabase, {
    manuscriptId: input.manuscriptId,
    tenantId: input.tenantId,
  });
  if (!session.ok) return session;

  const tier = await resolveApprenticeOrGuildTier(supabase, {
    tenantId: input.tenantId,
    userId: input.userId,
    manuscriptId: input.manuscriptId,
  });
  if (!tier.ok) return tier;

  return { ok: true, tier, manuscript: session.manuscript };
}

/**
 * Builds the Author gate outcome: tier checks, **universal** MSGF body, and an **author-only** wrapper.
 */
export async function runAuthorP1HalGate(input: {
  tenantId: string;
  userId: string;
  manuscriptId?: string | null;
  keystrokes: readonly UniversalP1KeystrokeEvent[];
  humanTieBreakerResolved?: boolean;
  authorOnly?: AuthorSpecificP1Wrapper | null;
  /** Optional injected client (tests); defaults to service-role admin client. */
  supabase?: SupabaseClient;
}): Promise<AuthorGateP1Result> {
  const supabase = input.supabase ?? getSupabaseAdmin();

  const tier = await resolveApprenticeOrGuildTier(supabase, {
    tenantId: input.tenantId,
    userId: input.userId,
    manuscriptId: input.manuscriptId ?? null,
  });

  if (!tier.ok) {
    return tier;
  }

  const authorOnly: AuthorSpecificP1Wrapper = {
    bookTitle: input.authorOnly?.bookTitle ?? null,
    tierPriceDisplay: input.authorOnly?.tierPriceDisplay ?? null,
    internalNote: input.authorOnly?.internalNote ?? null,
  };

  const universal = toUniversalP1PulseBody({
    keystrokes: input.keystrokes,
    humanTieBreakerResolved: input.humanTieBreakerResolved,
  });

  assertP1UniversalNonPolluted(universal as unknown as Record<string, unknown>);

  return { ok: true, tier, universal, authorOnly };
}

/**
 * POSTs **universal P1** payload to MSGF pulse. Caller supplies session cookies or service secret
 * appropriate for the deployment (out of scope for this module).
 */
export async function submitUniversalP1ToMsgfPulse(
  universal: UniversalP1PulseBody,
  opts: { baseUrl: string; cookieHeader?: string | null }
): Promise<Response> {
  assertP1UniversalNonPolluted(universal as unknown as Record<string, unknown>);
  const url = new URL("/api/msgf/pulse", opts.baseUrl.replace(/\/?$/, "/")).toString();
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (opts.cookieHeader) {
    headers["cookie"] = opts.cookieHeader;
  }
  return fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(universal),
  });
}
