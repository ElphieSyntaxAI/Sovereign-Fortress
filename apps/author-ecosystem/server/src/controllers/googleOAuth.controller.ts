import { Router, type Request, type Response } from "express";

import {
  createGoogleOAuthClient,
  decodeOAuthState,
  encodeOAuthState,
  googleOAuthConfigured,
  GOOGLE_OAUTH_SCOPES,
  resolveGoogleOAuthRedirectUri,
} from "../lib/googleOAuth.js";
import { googleOAuthCallbackInvalidGrantMessage } from "../lib/googleOAuthErrors.js";
import {
  docUrlFromMeta,
  fetchGoogleDocMetaOAuth,
  fetchGoogleDocPlainTextOAuth,
  listRecentGoogleDocsOAuth,
} from "../lib/googleDocOAuth.js";
import { extractGoogleDocId, normalizeGoogleDocUrl } from "../lib/googleDocUrl.js";
import { expandBffTenantIdAliases } from "../lib/authorTenantId.js";
import { getGoogleCredentialSummary, getGoogleOAuthClientForTenant, upsertGoogleCredentials } from "../lib/googleOAuthTokens.js";
import { resolveAuthorClientOrigin } from "@elphie-syntax/core/author-handoff-origins";
import { readBearerUser } from "../lib/readBearerJwtUser.js";
import { resolveBffUser } from "../lib/resolveBffUser.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";

export const googleOAuthController = Router();

/**
 * GET /api/google/oauth/status
 */
googleOAuthController.get("/api/google/oauth/status", async (req: Request, res: Response) => {
  const user = await resolveBffUser(req, res);
  if (!user) return;

  if (!googleOAuthConfigured()) {
    return res.status(200).json({ configured: false, connected: false });
  }

  const supabase = getSupabaseAdmin();
  const summary = await getGoogleCredentialSummary(supabase, user.userId);

  return res.status(200).json({
    configured: true,
    connected: Boolean(summary),
    google_email: summary?.google_email ?? null,
    redirect_uri: resolveGoogleOAuthRedirectUri(),
  });
});

/**
 * GET /api/google/oauth/start?return_to=&manuscript_id=
 */
googleOAuthController.get("/api/google/oauth/start", async (req: Request, res: Response) => {
  const user = await resolveBffUser(req, res);
  if (!user) return;

  if (!googleOAuthConfigured()) {
    return res.status(503).json({ error: "Google OAuth is not configured on this server" });
  }

  const client = createGoogleOAuthClient();
  const returnTo = typeof req.query.return_to === "string" ? req.query.return_to : "/manuscripts";
  const manuscriptId =
    typeof req.query.manuscript_id === "string" ? req.query.manuscript_id.trim() : undefined;

  const state = encodeOAuthState({
    tenantId: user.userId,
    returnTo,
    manuscriptId,
  });

  const redirectUri = resolveGoogleOAuthRedirectUri();
  const url = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_OAUTH_SCOPES,
    state,
    redirect_uri: redirectUri,
  });

  return res.redirect(url);
});

/**
 * GET /api/google/oauth/callback?code=&state=
 */
googleOAuthController.get("/api/google/oauth/callback", async (req: Request, res: Response) => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const stateRaw = typeof req.query.state === "string" ? req.query.state : "";
  const state = decodeOAuthState(stateRaw);

  if (!code || !state?.tenantId) {
    return res.status(400).send("Invalid OAuth callback");
  }

  try {
    const redirectUri = resolveGoogleOAuthRedirectUri();
    const client = createGoogleOAuthClient();
    const { tokens } = await client.getToken({ code, redirect_uri: redirectUri });
    client.setCredentials(tokens);

    let googleEmail: string | null = null;
    if (tokens.access_token) {
      try {
        const meRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (meRes.ok) {
          const me = (await meRes.json()) as { email?: string };
          googleEmail = me.email ?? null;
        }
      } catch {
        /* optional */
      }
    }

    const supabase = getSupabaseAdmin();
    await upsertGoogleCredentials(supabase, state.tenantId, tokens, googleEmail);

    const returnTo = state.returnTo?.startsWith("/") ? state.returnTo : "/manuscripts";
    const q = state.manuscriptId ? `?google=connected&manuscript_id=${encodeURIComponent(state.manuscriptId)}` : "?google=connected";
    const clientOrigin = resolveAuthorClientOrigin();
    return res.redirect(`${clientOrigin.replace(/\/$/, "")}${returnTo}${q}`);
  } catch (e) {
    console.error("[google/oauth/callback]", e);
    const msg = e instanceof Error ? e.message : "OAuth failed";
    if (/invalid_grant/i.test(msg)) {
      return res.status(400).send(googleOAuthCallbackInvalidGrantMessage());
    }
    return res.status(500).send(msg);
  }
});

/**
 * POST /api/google/oauth/disconnect
 * Clears stored Google credentials so the author can reconnect after invalid_grant.
 */
googleOAuthController.post("/api/google/oauth/disconnect", async (req: Request, res: Response) => {
  const user = await resolveBffUser(req, res);
  if (!user) return;

  const supabase = getSupabaseAdmin();
  const aliases = await expandBffTenantIdAliases(supabase, user.userId);
  const { error } = await supabase
    .from("p4_author_google_credentials")
    .delete()
    .in("tenant_id", aliases.length ? aliases : [user.userId]);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ disconnected: true });
});

/**
 * GET /api/google/drive/recent-docs
 * Lists recent Google Docs the connected account can read (for link-session fallback).
 */
googleOAuthController.get("/api/google/drive/recent-docs", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  const q = typeof req.query.q === "string" ? req.query.q : "";
  const supabase = getSupabaseAdmin();
  try {
    const { client } = await getGoogleOAuthClientForTenant(supabase, user.userId);
    const files = await listRecentGoogleDocsOAuth(client, { query: q, pageSize: 25 });
    return res.status(200).json({ files });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(400).json({ error: msg });
  }
});

const MANUSCRIPT_OUTLINE_SELECT =
  "id, tenant_id, title, outline, google_doc_url, google_doc_id, hal_extension_enabled, linked_at, project_phase";

/**
 * POST /api/manuscripts/:manuscriptId/google-doc/connect
 * Body: { google_doc_id, google_doc_url?, import_outline?: boolean, link_hal?: boolean }
 * Pick a completed Google Doc from Drive (OAuth) and import outline text and/or link for HAL.
 */
googleOAuthController.post(
  "/api/manuscripts/:manuscriptId/google-doc/connect",
  async (req: Request, res: Response) => {
    const user = readBearerUser(req, res);
    if (!user) return;

    const manuscriptId = String(req.params.manuscriptId ?? "").trim();
    const body = (req.body ?? {}) as {
      google_doc_id?: string;
      google_doc_url?: string;
      import_outline?: boolean;
      link_hal?: boolean;
    };

    const docId =
      String(body.google_doc_id ?? "").trim() ||
      (body.google_doc_url ? extractGoogleDocId(String(body.google_doc_url)) : null);
    if (!manuscriptId || !docId) {
      return res.status(400).json({ error: "google_doc_id or google_doc_url is required" });
    }

    const importOutline =
      body.import_outline !== false && String(body.import_outline).toLowerCase() !== "false";
    const linkHal = body.link_hal !== false && String(body.link_hal).toLowerCase() !== "false";

    const supabase = getSupabaseAdmin();
    const { data: ms } = await supabase
      .from("p4_manuscripts")
      .select("id")
      .eq("id", manuscriptId)
      .eq("tenant_id", user.userId)
      .maybeSingle();
    if (!ms) return res.status(404).json({ error: "Manuscript not found" });

    try {
      const { client } = await getGoogleOAuthClientForTenant(supabase, user.userId);
      const meta = await fetchGoogleDocMetaOAuth(client, docId);
      const docUrl = body.google_doc_url?.trim()
        ? normalizeGoogleDocUrl(String(body.google_doc_url))
        : docUrlFromMeta(meta);

      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      let outline_chars = 0;

      if (importOutline) {
        const text = await fetchGoogleDocPlainTextOAuth(client, docId);
        patch.outline = text;
        outline_chars = text.length;
      }

      if (linkHal) {
        const now = new Date().toISOString();
        patch.google_doc_id = meta.id;
        patch.google_doc_url = docUrl;
        patch.hal_extension_enabled = true;
        patch.linked_at = now;
        patch.project_phase = "working";
      }

      const { data, error } = await supabase
        .from("p4_manuscripts")
        .update(patch)
        .eq("id", manuscriptId)
        .eq("tenant_id", user.userId)
        .select(MANUSCRIPT_OUTLINE_SELECT)
        .single();

      if (error) return res.status(500).json({ error: error.message });

      return res.status(200).json({
        manuscript: data,
        doc: meta,
        outline_chars,
        message: [
          importOutline ? "Outline text imported from Google Doc." : null,
          linkHal ? "Google Doc linked for HAL extension." : null,
        ]
          .filter(Boolean)
          .join(" "),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return res.status(400).json({ error: msg });
    }
  }
);
