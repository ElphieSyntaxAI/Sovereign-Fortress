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
import { Buffer } from "node:buffer";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  AuthorSovereigntyService,
  CooldownLockError,
  MarketplaceOrchestrator,
  calculateCraftGrowth,
  exportHumanAuthorshipCertificatePdf,
  verifyHumanAuthorshipCertificate,
  type CraftGrowthSession,
  type HumanAuthorshipCertificate,
  type LibrarianLanguage,
  type MarketplaceInteractionType,
  type P4ManuscriptRow,
  type PublishingIntent,
} from "@msgf/lib/EcosystemBridge";
import { createServiceRoleClient } from "@msgf/lib/supabase/service-role";
import { createClient } from "@/utils/supabase/server";

type Domain = "sovereignty" | "marketplace";

function parseDomain(v: unknown): Domain | null {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (s === "sovereignty" || s === "marketplace") return s;
  return null;
}

function parsePublishingIntent(v: unknown): PublishingIntent | null {
  const s = typeof v === "string" ? v.trim().toUpperCase() : "";
  if (s === "TRADITIONAL" || s === "SELF" || s === "UNDECIDED") return s;
  return null;
}

function parseMarketplaceInteraction(v: unknown): MarketplaceInteractionType | null {
  const s = typeof v === "string" ? v.trim().toUpperCase() : "";
  if (s === "LIKE" || s === "TRACK") return s;
  return null;
}

function parseLibrarianLanguage(v: unknown): LibrarianLanguage | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim().toLowerCase();
  if (s === "en" || s === "es" || s === "ja") return s;
  return undefined;
}

function parseCraftGrowthSession(v: unknown): CraftGrowthSession | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const ttr = Number(o["ttr"]);
  const sentenceComplexity = Number(o["sentenceComplexity"]);
  if (!Number.isFinite(ttr) || !Number.isFinite(sentenceComplexity)) return null;
  return { ttr, sentenceComplexity };
}

async function assertManuscriptInTenant(
  sr: ReturnType<typeof createServiceRoleClient>,
  manuscriptId: string,
  tenantId: string
): Promise<P4ManuscriptRow | null> {
  const { data, error } = await sr.from("p4_manuscripts").select("*").eq("id", manuscriptId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as Record<string, unknown>;
  if (String(row["tenant_id"] ?? "") !== tenantId) return null;
  return data as P4ManuscriptRow;
}

/**
 * POST /api/ecosystem/bridge
 *
 * Body: `{ domain: "sovereignty" | "marketplace", action: string, ... }`
 *
 * Authenticated Supabase user; `user_metadata.tenant_id` must match manuscript rows for marketplace
 * and sovereignty actions that reference a manuscript.
 */
export async function POST(req: Request) {
  const cookieStore = await cookies();
  const authClient = createClient(cookieStore);
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = String(user.user_metadata?.tenant_id ?? "").trim();
  if (!tenantId) {
    return NextResponse.json({ error: "tenant_id missing from session" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const domain = parseDomain(o["domain"]);
  const action = typeof o["action"] === "string" ? o["action"].trim() : "";

  if (!domain || !action) {
    return NextResponse.json({ error: "domain and action are required" }, { status: 400 });
  }

  try {
    const sr = createServiceRoleClient();

    if (domain === "sovereignty") {
      const sovereignty = new AuthorSovereigntyService(sr);

      if (action === "build_authorship_certificate") {
        const limit = typeof o["limit"] === "number" && Number.isFinite(o["limit"]) ? Math.floor(o["limit"]) : undefined;
        const cert = await sovereignty.buildCertificateForTenant(tenantId, { limit });
        const format = typeof o["format"] === "string" ? o["format"].trim().toLowerCase() : "json";
        if (format === "pdf_base64") {
          const pdf = await exportHumanAuthorshipCertificatePdf(cert);
          return NextResponse.json({
            certificate: cert,
            certificate_pdf_base64: Buffer.from(pdf).toString("base64"),
          });
        }
        return NextResponse.json({ certificate: cert });
      }

      if (action === "verify_authorship_certificate") {
        const cert = o["certificate"];
        if (!cert || typeof cert !== "object") {
          return NextResponse.json({ error: "certificate object is required" }, { status: 400 });
        }
        const result = verifyHumanAuthorshipCertificate(cert as HumanAuthorshipCertificate);
        return NextResponse.json(result);
      }

      if (action === "fetch_hal_ledger_certificate_rows") {
        const limit = typeof o["limit"] === "number" && Number.isFinite(o["limit"]) ? Math.floor(o["limit"]) : undefined;
        const rows = await sovereignty.fetchHalLedgerForCertificate(tenantId, { limit });
        return NextResponse.json({ rows });
      }

      if (action === "begin_cooldown_lock") {
        const manuscript_id = typeof o["manuscript_id"] === "string" ? o["manuscript_id"].trim() : "";
        const locked_text = typeof o["locked_text"] === "string" ? o["locked_text"] : "";
        if (!manuscript_id || !locked_text) {
          return NextResponse.json({ error: "manuscript_id and locked_text are required" }, { status: 400 });
        }
        const ms = await assertManuscriptInTenant(sr, manuscript_id, tenantId);
        if (!ms) {
          return NextResponse.json({ error: "Manuscript not found for this tenant" }, { status: 404 });
        }
        const cooldownMs =
          typeof o["cooldown_ms"] === "number" && Number.isFinite(o["cooldown_ms"]) ? Math.floor(o["cooldown_ms"]) : undefined;
        const librarianLanguage = parseLibrarianLanguage(o["librarian_language"]);
        const result = await sovereignty.beginRevisionCooldownLock({
          tenantId,
          manuscriptId: manuscript_id,
          lockedText: locked_text,
          cooldownMs,
          librarianLanguage,
        });
        return NextResponse.json(result);
      }

      if (action === "cooldown_lock_status") {
        const manuscript_id = typeof o["manuscript_id"] === "string" ? o["manuscript_id"].trim() : "";
        if (!manuscript_id) {
          return NextResponse.json({ error: "manuscript_id is required" }, { status: 400 });
        }
        const ms = await assertManuscriptInTenant(sr, manuscript_id, tenantId);
        if (!ms) {
          return NextResponse.json({ error: "Manuscript not found for this tenant" }, { status: 404 });
        }
        const lock = sovereignty.getCooldownLock(tenantId, manuscript_id);
        const ms_remaining = sovereignty.msUntilCooldownUnlock(tenantId, manuscript_id);
        return NextResponse.json({ lock, ms_remaining });
      }

      if (action === "assert_edits_allowed") {
        const manuscript_id = typeof o["manuscript_id"] === "string" ? o["manuscript_id"].trim() : "";
        if (!manuscript_id) {
          return NextResponse.json({ error: "manuscript_id is required" }, { status: 400 });
        }
        const ms = await assertManuscriptInTenant(sr, manuscript_id, tenantId);
        if (!ms) {
          return NextResponse.json({ error: "Manuscript not found for this tenant" }, { status: 404 });
        }
        try {
          sovereignty.assertEditsAllowed(tenantId, manuscript_id);
        } catch (e) {
          if (e instanceof CooldownLockError) {
            return NextResponse.json(
              {
                error: e.message,
                code: e.code,
                lock_expiry_iso: e.lockExpiryIso,
                tenant_id: e.tenantId,
                manuscript_id: e.manuscriptId,
              },
              { status: 423 }
            );
          }
          throw e;
        }
        return new NextResponse(null, { status: 204 });
      }

      if (action === "calculate_craft_growth") {
        const prev = parseCraftGrowthSession(o["previous_session"]);
        const cur = parseCraftGrowthSession(o["current_session"]);
        if (!prev || !cur) {
          return NextResponse.json(
            { error: "previous_session and current_session must be { ttr, sentenceComplexity }" },
            { status: 400 }
          );
        }
        const result = calculateCraftGrowth(prev, cur);
        return NextResponse.json({ craft_growth: result });
      }

      return NextResponse.json({ error: `Unknown sovereignty action: ${action}` }, { status: 400 });
    }

    if (domain === "marketplace") {
      const marketplace = new MarketplaceOrchestrator(sr);

      if (action === "hub_visibility") {
        const manuscript_id = typeof o["manuscript_id"] === "string" ? o["manuscript_id"].trim() : "";
        if (!manuscript_id) {
          return NextResponse.json({ error: "manuscript_id is required" }, { status: 400 });
        }
        const ms = await assertManuscriptInTenant(sr, manuscript_id, tenantId);
        if (!ms) {
          return NextResponse.json({ error: "Manuscript not found for this tenant" }, { status: 404 });
        }
        const visibility = MarketplaceOrchestrator.hubVisibilityFromManuscript(ms);
        return NextResponse.json({ visibility });
      }

      if (action === "interest_metrics") {
        const manuscript_id = typeof o["manuscript_id"] === "string" ? o["manuscript_id"].trim() : "";
        if (!manuscript_id) {
          return NextResponse.json({ error: "manuscript_id is required" }, { status: 400 });
        }
        const ms = await assertManuscriptInTenant(sr, manuscript_id, tenantId);
        if (!ms) {
          return NextResponse.json({ error: "Manuscript not found for this tenant" }, { status: 404 });
        }
        const metrics = await marketplace.getInterestMetrics(manuscript_id);
        return NextResponse.json({ metrics });
      }

      if (action === "record_interaction") {
        const manuscript_id = typeof o["manuscript_id"] === "string" ? o["manuscript_id"].trim() : "";
        const interaction_type = parseMarketplaceInteraction(o["interaction_type"]);
        const actor_id =
          typeof o["actor_id"] === "string" && o["actor_id"].trim()
            ? o["actor_id"].trim()
            : typeof user.id === "string" && user.id
              ? user.id
              : "";
        if (!manuscript_id || !interaction_type || !actor_id) {
          return NextResponse.json(
            { error: "manuscript_id, interaction_type (LIKE|TRACK), and actor_id or valid user id required" },
            { status: 400 }
          );
        }
        const ms = await assertManuscriptInTenant(sr, manuscript_id, tenantId);
        if (!ms) {
          return NextResponse.json({ error: "Manuscript not found for this tenant" }, { status: 404 });
        }
        await marketplace.recordInteraction({
          actorId: actor_id,
          manuscriptId: manuscript_id,
          interactionType: interaction_type,
        });
        return new NextResponse(null, { status: 204 });
      }

      if (action === "set_publishing_intent") {
        const manuscript_id = typeof o["manuscript_id"] === "string" ? o["manuscript_id"].trim() : "";
        const intent = parsePublishingIntent(o["publishing_intent"]);
        if (!manuscript_id || !intent) {
          return NextResponse.json(
            { error: "manuscript_id and publishing_intent (TRADITIONAL|SELF|UNDECIDED) are required" },
            { status: 400 }
          );
        }
        const ms = await assertManuscriptInTenant(sr, manuscript_id, tenantId);
        if (!ms) {
          return NextResponse.json({ error: "Manuscript not found for this tenant" }, { status: 404 });
        }
        const is_seeking_agent =
          typeof o["is_seeking_agent"] === "boolean" ? o["is_seeking_agent"] : undefined;
        await marketplace.setPublishingIntent(manuscript_id, intent, is_seeking_agent);
        return new NextResponse(null, { status: 204 });
      }

      return NextResponse.json({ error: `Unknown marketplace action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
