import { drive } from "@googleapis/drive";
import { Router, type Request, type Response } from "express";

import {
  createGoogleOAuthClient,
  decodeOAuthState,
  encodeOAuthState,
  googleOAuthConfigured,
  GOOGLE_OAUTH_SCOPES,
} from "../lib/googleOAuth.js";
import { getGoogleOAuthClientForTenant, upsertGoogleCredentials } from "../lib/googleOAuthTokens.js";
import { readBearerUser } from "../lib/readBearerJwtUser.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";

export const googleOAuthController = Router();

/**
 * GET /api/google/oauth/status
 */
googleOAuthController.get("/api/google/oauth/status", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  if (!googleOAuthConfigured()) {
    return res.status(200).json({ configured: false, connected: false });
  }

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("p4_author_google_credentials")
    .select("google_email, updated_at")
    .eq("tenant_id", user.userId)
    .maybeSingle();

  return res.status(200).json({
    configured: true,
    connected: Boolean(data),
    google_email: (data as { google_email?: string } | null)?.google_email ?? null,
  });
});

/**
 * GET /api/google/oauth/start?return_to=&manuscript_id=
 */
googleOAuthController.get("/api/google/oauth/start", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
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

  const url = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_OAUTH_SCOPES,
    state,
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
    const client = createGoogleOAuthClient();
    const { tokens } = await client.getToken(code);
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
    const clientOrigin =
      process.env.AUTHOR_CLIENT_ORIGIN?.trim() ||
      process.env.VITE_AUTHOR_CLIENT_ORIGIN?.trim() ||
      "http://localhost:5173";
    return res.redirect(`${clientOrigin.replace(/\/$/, "")}${returnTo}${q}`);
  } catch (e) {
    console.error("[google/oauth/callback]", e);
    return res.status(500).send(e instanceof Error ? e.message : "OAuth failed");
  }
});

/**
 * GET /api/google/drive/recent-docs
 * Lists recent Google Docs the connected account can read (for link-session fallback).
 */
googleOAuthController.get("/api/google/drive/recent-docs", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  const supabase = getSupabaseAdmin();
  try {
    const { client } = await getGoogleOAuthClientForTenant(supabase, user.userId);
    const d = drive({ version: "v3", auth: client });
    const { data } = await d.files.list({
      pageSize: 15,
      orderBy: "modifiedTime desc",
      q: "mimeType='application/vnd.google-apps.document' and trashed=false",
      fields: "files(id, name, modifiedTime, webViewLink)",
    });
    return res.status(200).json({ files: data.files ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(400).json({ error: msg });
  }
});
