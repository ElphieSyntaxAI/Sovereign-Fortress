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
 * Distribution Build ID: MSGF-e98bd4c-20260522T053721Z-internal
 */
/**
 * Publisher share links: hashed tokens, verify flow, author notifications via `p4_author_signal`.
 *
 * Uses `DashboardOrchestratorService` from the author-ecosystem server tree (`experimental.externalDir` + webpack `.js`→`.ts` alias).
 */

import { createHash, randomBytes } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { PublisherPublicMetadata } from "../../../../apps/author-ecosystem/server/src/lib/DashboardOrchestratorService";
import { DashboardOrchestratorService } from "../../../../apps/author-ecosystem/server/src/lib/DashboardOrchestratorService";

export type GrantLevel = 1 | 2 | 3 | 4;

export type AccessGrantRow = {
  id: string;
  tenant_id: string;
  manuscript_id: string;
  token: string;
  level: GrantLevel;
  expires_at: string;
  created_at: string;
  first_access_at: string | null;
  last_access_at: string | null;
};

function sha256Hex(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

function normalizeBaseUrl(): string {
  const u = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL;
  if (u?.trim()) {
    const s = u.trim();
    return s.startsWith("http") ? s.replace(/\/$/, "") : `https://${s.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}

export class PublisherGrantService {
  constructor(private readonly supabase: SupabaseClient) {}

  static hashToken(rawToken: string): string {
    return sha256Hex(rawToken);
  }

  /**
   * Persists a grant and returns the absolute verify URL (opaque raw token, never stored verbatim).
   */
  async generateShareableLink(
    manuscriptId: string,
    level: GrantLevel,
    options?: { expiresInDays?: number }
  ): Promise<{ url: string; grantId: string; expiresAt: string }> {
    if (level < 1 || level > 4) throw new Error("level must be 1–4");

    const { data: ms, error: mErr } = await this.supabase
      .from("p4_manuscripts")
      .select("id, tenant_id")
      .eq("id", manuscriptId)
      .maybeSingle();

    if (mErr) throw new Error(`generateShareableLink: ${mErr.message}`);
    if (!ms) throw new Error("Manuscript not found");

    const tenant_id = String((ms as { tenant_id: string }).tenant_id);
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = PublisherGrantService.hashToken(rawToken);

    const days = Math.min(365, Math.max(1, options?.expiresInDays ?? 30));
    const expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();

    const { data: inserted, error: iErr } = await this.supabase
      .from("p4_access_grants")
      .insert({
        tenant_id,
        manuscript_id: manuscriptId,
        token: tokenHash,
        level,
        expires_at: expiresAt,
      })
      .select("id, expires_at")
      .single();

    if (iErr) throw new Error(`generateShareableLink insert: ${iErr.message}`);

    const base = normalizeBaseUrl();
    const pathToken = encodeURIComponent(rawToken);
    const url = `${base}/verify/${pathToken}`;

    return {
      url,
      grantId: String((inserted as { id: string }).id),
      expiresAt: String((inserted as { expires_at: string }).expires_at),
    };
  }

  /**
   * Validates token, loads orchestrator metadata, optional manuscript body for level 4,
   * bumps access timestamps, and notifies the author on first successful open.
   */
  async resolveVerifySession(rawToken: string): Promise<
    | { ok: false; reason: string }
    | {
        ok: true;
        level: GrantLevel;
        metadata: PublisherPublicMetadata;
        manuscript_body: string | null;
        grantId: string;
      }
  > {
    const trimmed = rawToken.trim();
    if (!trimmed) return { ok: false, reason: "missing_token" };

    let decoded = trimmed;
    try {
      decoded = decodeURIComponent(trimmed);
    } catch {
      decoded = trimmed;
    }
    const tokenHash = PublisherGrantService.hashToken(decoded);
    const now = new Date().toISOString();

    const { data: grant, error } = await this.supabase
      .from("p4_access_grants")
      .select("id, tenant_id, manuscript_id, token, level, expires_at, first_access_at, last_access_at")
      .eq("token", tokenHash)
      .gt("expires_at", now)
      .maybeSingle();

    if (error) return { ok: false, reason: "lookup_failed" };
    if (!grant) return { ok: false, reason: "invalid_or_expired" };

    const row = grant as Record<string, unknown>;
    const grantId = String(row["id"]);
    const manuscriptId = String(row["manuscript_id"]);
    const level = Math.min(4, Math.max(1, Number(row["level"]))) as GrantLevel;
    const wasFirstAccess = row["first_access_at"] == null;

    const orchestrator = new DashboardOrchestratorService(this.supabase);
    const metadata = await orchestrator.getPublisherPublicMetadata(manuscriptId);

    let manuscript_body: string | null = null;
    if (level === 4) {
      const { data: bodyRow, error: bErr } = await this.supabase
        .from("p4_manuscripts")
        .select("body_text")
        .eq("id", manuscriptId)
        .maybeSingle();
      if (!bErr && bodyRow && typeof (bodyRow as { body_text?: string | null }).body_text === "string") {
        manuscript_body = (bodyRow as { body_text: string }).body_text;
      }
    }

    const ts = new Date().toISOString();
    await this.supabase
      .from("p4_access_grants")
      .update({
        last_access_at: ts,
        ...(wasFirstAccess ? { first_access_at: ts } : {}),
      })
      .eq("id", grantId);

    if (wasFirstAccess) {
      await this.notifyAuthorPublisherAccess({
        tenantId: String(row["tenant_id"]),
        manuscriptId,
        level,
        grantId,
      });
    }

    return { ok: true, level, metadata, manuscript_body, grantId };
  }

  private async notifyAuthorPublisherAccess(input: {
    tenantId: string;
    manuscriptId: string;
    level: GrantLevel;
    grantId: string;
  }): Promise<void> {
    const body = `A Publisher has accessed your Level ${input.level} Audit via your shared link.`;
    const { error } = await this.supabase.from("p4_author_signal").insert({
      tenant_id: input.tenantId,
      manuscript_id: input.manuscriptId,
      kind: "PUBLISHER_GRANT_ACCESS",
      title: "Publisher link opened",
      body,
      payload: {
        grant_id: input.grantId,
        level: input.level,
        source: "p4_access_grants",
      },
    });
    if (error) {
      console.error("PublisherGrantService: p4_author_signal insert failed", error.message);
    }
  }
}
