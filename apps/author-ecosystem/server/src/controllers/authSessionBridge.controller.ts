import { Router, type Request, type Response } from "express";
import {
  PLATFORM_COMING_SOON,
  parsePlatformLoginBody,
  personaToProfileRole,
  resolvePostLoginRedirect,
} from "msgf/lib/platform-persona-auth";

import { BFF_AUTH_COOKIE_NAME, bffCookieBaseOptions } from "../lib/bffAuthCookies.js";
import { createBffSupabaseServerClient } from "../lib/bffSupabaseSsr.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { readBearerUser, normalizeRole } from "../lib/readBearerJwtUser.js";
import { syncPlatformPersonaSession } from "../lib/syncPlatformPersonaSession.js";
import { VAULT_PACT_ATTESTATION_PHRASE } from "../lib/vaultPactAttestation.js";

/**
 * Auth routes on the author BFF: Supabase session via `@supabase/ssr` cookie storage (same pattern as
 * `packages/msgf/utils/supabase/server.ts`) so MSGF Next and the Vite client can share cookies when
 * `MSGF_AUTH_COOKIE_DOMAIN` / CORS origins align. Optionally mirrors the access token into
 * `author_bff_jwt` for existing `readBearerUser` + `SUPABASE_JWT_SECRET` verification on API routes.
 */
export const authSessionBridgeController = Router();

function mapSupabaseUserToMe(user: { id: string; user_metadata?: Record<string, unknown> | null }) {
  const meta = user.user_metadata ?? {};
  const legacyRaw = meta["legacy_user_id"];
  const id =
    typeof legacyRaw === "string" && legacyRaw.trim()
      ? legacyRaw.trim()
      : typeof legacyRaw === "number"
        ? String(legacyRaw)
        : user.id;
  const role = normalizeRole(meta["terms_role"] ?? meta["user_role"] ?? meta["role"]);
  return { id, role };
}

function mirrorAccessTokenCookie(res: Response, accessToken: string | undefined): void {
  const t = accessToken?.trim();
  if (!t) return;
  res.cookie(BFF_AUTH_COOKIE_NAME, t, bffCookieBaseOptions());
}

const REGISTER_TERMS_ROLES = new Set(["author", "editor", "fan", "publisher"]);

authSessionBridgeController.post("/login", (req: Request, res: Response) => {
  void (async () => {
    try {
      const body = req.body as Record<string, unknown>;
      const parsed = parsePlatformLoginBody(body);
      if (!parsed) {
        res.status(400).json({
          message: "Email, password, platform, and persona are required.",
        });
        return;
      }

      if (PLATFORM_COMING_SOON[parsed.platform]) {
        res.status(403).json({ message: "This platform is coming soon." });
        return;
      }

      const { email, password, platform, persona } = parsed;

      const supabase = createBffSupabaseServerClient(req, res);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.session) {
        res.status(401).json({ message: error?.message ?? "Invalid credentials" });
        return;
      }

      mirrorAccessTokenCookie(res, data.session.access_token);
      await syncPlatformPersonaSession(res, data.user, { platform, persona });

      const u = mapSupabaseUserToMe(data.user);
      res.status(200).json({
        message: "Login successful",
        user: {
          id: u.id,
          email: data.user.email,
          username: data.user.user_metadata?.username,
          platform,
          persona,
          role: personaToProfileRole(platform, persona),
        },
        redirectUrl: resolvePostLoginRedirect(platform),
      });
    } catch (e) {
      console.error("[bff/auth/login]", e);
      res.status(500).json({
        message: "Login failed",
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  })();
});

authSessionBridgeController.post("/register", (req: Request, res: Response) => {
  void (async () => {
    try {
      const body = req.body as Record<string, unknown>;
      const termsRole = String(body.terms_role ?? "").trim().toLowerCase();
      const vaultPactSignature = String(body.vault_pact_signature ?? "").trim();

      if (!REGISTER_TERMS_ROLES.has(termsRole)) {
        res.status(400).json({
          message: "Select a valid account role (author, editor, fan, or publisher).",
        });
        return;
      }
      if (vaultPactSignature !== VAULT_PACT_ATTESTATION_PHRASE) {
        res.status(400).json({
          message: `Sign the Vault Pact by typing the exact attestation: ${VAULT_PACT_ATTESTATION_PHRASE}`,
        });
        return;
      }

      const username = String(body.username ?? "").trim();
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      if (!username || !email || !password) {
        res.status(400).json({ message: "Username, email, and password are required." });
        return;
      }

      const admin = getSupabaseAdmin();

      const { data: tierRow } = await admin
        .from("msgf_legacy_tiers")
        .select("tier_id")
        .eq("name", "Tier 1: Fan Access")
        .maybeSingle();
      const tierId = typeof tierRow?.tier_id === "number" ? tierRow.tier_id : 1;

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          username,
          terms_role: termsRole,
          user_role: termsRole,
          preferred_theme: "Pleasure",
        },
      });

      if (createErr || !created.user?.id) {
        const msg = createErr?.message ?? "Could not create user";
        if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("registered")) {
          res.status(409).json({ message: "Email already registered." });
          return;
        }
        res.status(500).json({ message: msg });
        return;
      }

      const authUserId = created.user.id;

      const supabase = createBffSupabaseServerClient(req, res);
      const { data: sessionData, error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInErr || !sessionData.session) {
        await admin.auth.admin.deleteUser(authUserId);
        res.status(500).json({
          message: signInErr?.message ?? "Could not establish session after registration.",
        });
        return;
      }

      mirrorAccessTokenCookie(res, sessionData.session.access_token);

      const { error: profileErr } = await admin.from("p4_profiles").upsert(
        {
          user_id: authUserId,
          legacy_user_id: null,
          username,
          tier_id: tierId,
          user_role: termsRole,
          preferred_theme: "Pleasure",
        },
        { onConflict: "user_id" }
      );

      if (profileErr) {
        console.error("[bff/auth/register] p4_profiles upsert:", profileErr.message);
      }

      const u = mapSupabaseUserToMe(sessionData.user);
      res.status(201).json({
        message: "User registered successfully",
        user: { id: u.id, username, email, tierId, theme: "Pleasure" },
      });
    } catch (e) {
      console.error("[bff/auth/register]", e);
      res.status(500).json({
        message: "Registration failed",
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  })();
});

/**
 * GET /api/auth/me — Supabase session (SSR cookies) first, then legacy `author_bff_jwt` / Bearer.
 */
authSessionBridgeController.get("/me", (req: Request, res: Response) => {
  void (async () => {
    try {
      const supabase = createBffSupabaseServerClient(req, res);
      const { data: userData, error } = await supabase.auth.getUser();
      if (!error && userData.user) {
        const u = mapSupabaseUserToMe(userData.user);
        res.status(200).json({ authenticated: true, user: { id: u.id, role: u.role } });
        return;
      }
    } catch (e) {
      console.error("[bff/auth/me] supabase", e);
    }

    const user = readBearerUser(req, res);
    if (!user) return;
    res.status(200).json({ authenticated: true, user: { id: user.userId, role: user.role } });
  })();
});

authSessionBridgeController.post("/logout", (req: Request, res: Response) => {
  void (async () => {
    try {
      const supabase = createBffSupabaseServerClient(req, res);
      await supabase.auth.signOut();
    } catch (e) {
      console.error("[bff/auth/logout]", e);
    }
    const opts = bffCookieBaseOptions();
    res.clearCookie(BFF_AUTH_COOKIE_NAME, {
      path: opts.path,
      httpOnly: true,
      sameSite: opts.sameSite,
      secure: opts.secure,
    });
    res.status(204).end();
  })();
});
