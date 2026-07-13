import { Router, type Request, type Response } from "express";
import { defaultAuthorDashboardReturnTo } from "@elphie-syntax/core/author-handoff-origins";
import { buildAuthorHandoffClientSessionHtml } from "@elphie-syntax/core/author-handoff-client-session";
import {
  resolveMsgfAuthorHandoffEntryUrl,
  sanitizeAuthorReturnToUrl,
} from "@elphie-syntax/core/operator-handoff-url";
import { verifyOperatorHandoffToken } from "@elphie-syntax/core/operator-handoff-token";
import {
  PLATFORM_COMING_SOON,
  isPersonaValidForPlatform,
  parsePlatformLoginBody,
  resolvePostLoginRedirect,
} from "msgf/lib/platform-persona-auth";

import { BFF_AUTH_COOKIE_NAME, bffCookieBaseOptions, getJwtFromRequest } from "../lib/bffAuthCookies.js";
import { withBffSupabaseCookieOptions } from "../lib/bffSupabaseCookieOptions.js";
import { createBffSupabaseHandoffClient, createBffSupabaseServerClient } from "../lib/bffSupabaseSsr.js";
import { loadMonorepoRootEnv } from "../lib/database/loadRootEnv.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { readBearerUser, normalizeRole } from "../lib/readBearerJwtUser.js";
import { resolvePlatformOperatorAccess } from "../lib/isPlatformOperator.js";
import { getPublishableAuthClient } from "../lib/resolveBffAuthUser.js";
import { syncPlatformPersonaSession, setPlatformContextCookies } from "../lib/syncPlatformPersonaSession.js";
import { VAULT_PACT_ATTESTATION_PHRASE } from "../lib/vaultPactAttestation.js";

/**
 * Auth routes on the author BFF: Supabase session via `@supabase/ssr` cookie storage (same pattern as
 * `packages/msgf/utils/supabase/server.ts`) so MSGF Next and the Vite client can share cookies when
 * `MSGF_AUTH_COOKIE_DOMAIN` / CORS origins align. Optionally mirrors the access token into
 * `author_bff_jwt` for existing `readBearerUser` + `SUPABASE_JWT_SECRET` verification on API routes.
 */
export const authSessionBridgeController = Router();

function errorDetail(e: unknown): string {
  if (e instanceof Error) {
    const cause = e.cause instanceof Error ? e.cause.message : undefined;
    return cause ? `${e.message} (${cause})` : e.message;
  }
  return String(e);
}

function readActivatedPersonas(meta: Record<string, unknown>, fallbackPersona: string): string[] {
  const raw = meta["activated_personas"];
  if (Array.isArray(raw)) {
    const list = raw
      .map((p) => String(p).trim().toLowerCase())
      .filter((p) => isPersonaValidForPlatform("author", p));
    if (list.length) return [...new Set(list)];
  }
  const seed = fallbackPersona.trim().toLowerCase();
  return isPersonaValidForPlatform("author", seed) ? [seed] : ["author"];
}

async function mapSupabaseUserToMe(
  user: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown> | null;
  },
  admin = getSupabaseAdmin()
) {
  const meta = user.user_metadata ?? {};
  const legacyRaw = meta["legacy_user_id"];
  const id =
    typeof legacyRaw === "string" && legacyRaw.trim()
      ? legacyRaw.trim()
      : typeof legacyRaw === "number"
        ? String(legacyRaw)
        : user.id;
  const persona = String(meta.persona ?? meta.terms_role ?? meta.user_role ?? meta.role ?? "author")
    .trim()
    .toLowerCase();
  const role = normalizeRole(meta["terms_role"] ?? meta["user_role"] ?? meta["role"] ?? persona);
  const is_platform_operator = await resolvePlatformOperatorAccess(admin, {
    email: user.email,
    userId: user.id,
  });
  return {
    id,
    email: user.email ?? null,
    role,
    persona: isPersonaValidForPlatform("author", persona) ? persona : "author",
    activated_personas: readActivatedPersonas(meta, persona),
    is_platform_operator,
  };
}

function mergeActivatedPersona(meta: Record<string, unknown>, persona: string): string[] {
  const next = new Set(readActivatedPersonas(meta, persona));
  next.add(persona.trim().toLowerCase());
  return [...next];
}

function mirrorAccessTokenCookie(req: Request, res: Response, accessToken: string | undefined): void {
  const t = accessToken?.trim();
  if (!t) return;
  res.cookie(BFF_AUTH_COOKIE_NAME, t, bffCookieBaseOptions(req));
}

function operatorHandoffSecret(): string {
  return (
    process.env.MSGF_OPERATOR_HANDOFF_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    ""
  );
}

function readHandoffToken(req: Request): string {
  const fromQuery = String(req.query.handoff ?? "").trim();
  if (fromQuery) return fromQuery;
  const body = req.body as Record<string, unknown> | undefined;
  return String(body?.handoff ?? "").trim();
}

function readHandoffReturnTo(req: Request): string {
  const fromQuery =
    typeof req.query.return_to === "string" ? req.query.return_to : undefined;
  const body = req.body as Record<string, unknown> | undefined;
  const fromBody = typeof body?.return_to === "string" ? body.return_to : undefined;
  return sanitizeAuthorReturnToUrl(fromBody ?? fromQuery, defaultAuthorDashboardReturnTo());
}

function redirectToMsgfHandoffEntry(req: Request, res: Response, handoffError?: string): void {
  const entry = resolveMsgfAuthorHandoffEntryUrl(readHandoffReturnTo(req));
  if (handoffError) {
    const u = new URL(entry);
    u.searchParams.set("handoff_error", handoffError.slice(0, 200));
    res.redirect(302, u.href);
    return;
  }
  res.redirect(302, entry);
}

function requestHostFromReq(req: Request): string | undefined {
  const xf = req.headers["x-forwarded-host"];
  const forwarded = Array.isArray(xf) ? xf[0] : xf;
  const host = forwarded || req.headers.host;
  return typeof host === "string" ? host.split(",")[0]?.trim().split(":")[0] : undefined;
}

function handoffRequestOrigin(req: Request): string {
  const protoHeader = req.headers["x-forwarded-proto"];
  const proto =
    (typeof protoHeader === "string" ? protoHeader.split(",")[0]?.trim() : undefined) ||
    req.protocol ||
    "https";
  const host = requestHostFromReq(req) ?? req.headers.host ?? "localhost";
  return `${proto}://${host}`;
}

function handoffSupabasePublicConfig(): { url: string; key: string } {
  loadMonorepoRootEnv();
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim() || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || "";
  if (!url || !key) {
    throw new Error("Supabase public config missing for MSGF handoff.");
  }
  return { url, key };
}

async function completeMsgfOperatorHandoff(req: Request, res: Response): Promise<void> {
  const returnTo = readHandoffReturnTo(req);
  const token = readHandoffToken(req);
  if (!token) {
    if (req.method === "GET") {
      redirectToMsgfHandoffEntry(req, res);
      return;
    }
    res.status(400).send("Missing handoff token. Start from MSGF admin portal → Open Author.");
    return;
  }
  const payload = verifyOperatorHandoffToken(token, operatorHandoffSecret());
  const { url, key } = handoffSupabasePublicConfig();
  const cookieOpts = withBffSupabaseCookieOptions({ path: "/" }, requestHostFromReq(req));
  const origin = handoffRequestOrigin(req);

  // Browser setSession — avoids nginx "upstream sent too big header" on 302 + Set-Cookie.
  res
    .status(200)
    .type("html")
    .send(
      buildAuthorHandoffClientSessionHtml({
        supabaseUrl: url,
        supabasePublishableKey: key,
        accessToken: payload.access_token,
        refreshToken: payload.refresh_token,
        returnTo,
        finishUrl: `${origin}/api/auth/msgf-handoff/finish`,
        cookieDomain: cookieOpts.domain,
        cookieSecure: cookieOpts.secure,
      })
    );
}

function handleMsgfHandoff(req: Request, res: Response): void {
  void completeMsgfOperatorHandoff(req, res).catch((e) => {
    console.error("[bff/auth/msgf-handoff]", e);
    if (res.headersSent) return;
    const msg = e instanceof Error ? e.message : "Handoff failed.";
    if (req.method === "GET") {
      redirectToMsgfHandoffEntry(req, res, msg);
      return;
    }
    res.status(400).send(msg);
  });
}

/**
 * POST /api/auth/msgf-handoff/finish — after browser setSession, set small platform context cookies.
 */
authSessionBridgeController.post("/msgf-handoff/finish", (req: Request, res: Response) => {
  void (async () => {
    try {
      const body = req.body as Record<string, unknown> | undefined;
      const accessFromBody = String(body?.access_token ?? "").trim();
      const refreshFromBody = String(body?.refresh_token ?? "").trim();
      const accessFromHeader = getJwtFromRequest(req)?.trim() ?? "";
      const accessToken = accessFromBody || accessFromHeader;
      const refreshToken = refreshFromBody;

      let user: { user_metadata?: Record<string, unknown> | null } | null = null;

      // Preferred: browser posts tokens after client setSession — BFF writes httpOnly Supabase cookies.
      if (accessToken && refreshToken) {
        const supabase = createBffSupabaseHandoffClient(req, res);
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error || !data.session) {
          res.status(401).send(error?.message ?? "Could not establish Author session.");
          return;
        }
        mirrorAccessTokenCookie(req, res, data.session.access_token);
        user = data.user;
      } else {
        const supabase = createBffSupabaseServerClient(req, res);
        const { data: cookieUser, error: cookieErr } = await supabase.auth.getUser();
        if (!cookieErr && cookieUser.user) {
          user = cookieUser.user;
        }

        if (!user) {
          const token = accessToken || getJwtFromRequest(req);
          const client = getPublishableAuthClient();
          if (token && client) {
            const { data: bearerUser, error: bearerErr } = await client.auth.getUser(token);
            if (!bearerErr && bearerUser.user) user = bearerUser.user;
          }
        }
      }

      if (!user) {
        res.status(401).send("No Author session yet.");
        return;
      }

      const meta = user.user_metadata ?? {};
      let persona = String(meta.persona ?? meta.terms_role ?? "author").trim().toLowerCase();
      if (!isPersonaValidForPlatform("author", persona)) persona = "author";

      setPlatformContextCookies(res, "author", persona);
      res.status(204).end();
    } catch (e) {
      console.error("[bff/auth/msgf-handoff/finish]", e);
      res.status(500).send(e instanceof Error ? e.message : "Finish failed.");
    }
  })();
});

/**
 * GET /api/auth/msgf-handoff — legacy query-string handoff (large URLs).
 * POST — preferred (MSGF admin auto-submit form).
 */
authSessionBridgeController.get("/msgf-handoff", handleMsgfHandoff);
authSessionBridgeController.post("/msgf-handoff", handleMsgfHandoff);

/**
 * Canonical author personas (`author` / `editor` / `helper` / `publisher`).
 * Sourced from {@link isPersonaValidForPlatform} so it never drifts from
 * `PERSONAS_BY_PLATFORM.author` in `msgf/lib/platform-persona-auth`.
 */
function isRegisterAuthorPersona(persona: string): boolean {
  return isPersonaValidForPlatform("author", persona);
}

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

      mirrorAccessTokenCookie(req, res, data.session.access_token);
      const entitlement = await syncPlatformPersonaSession(res, data.user, { platform, persona });
      const admin = getSupabaseAdmin();
      const meta = { ...(data.user.user_metadata ?? {}) };
      const activated = mergeActivatedPersona(meta, persona);
      await admin.auth.admin.updateUserById(data.user.id, {
        user_metadata: { ...meta, activated_personas: activated },
      });

      const u = await mapSupabaseUserToMe({
        ...data.user,
        user_metadata: { ...meta, persona, activated_personas: activated },
      });
      res.status(200).json({
        message: "Login successful",
        user: {
          id: u.id,
          email: data.user.email,
          username: data.user.user_metadata?.username,
          platform,
          persona: u.persona,
          role: entitlement.userRole,
          tenant_id: entitlement.tenantId,
          msgf_license_provisioned: entitlement.provisionedLicense,
          activated_personas: u.activated_personas,
        },
        redirectUrl: resolvePostLoginRedirect(platform, persona),
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
      const platformRaw = String(body.platform ?? "author").trim().toLowerCase();
      const persona = String(body.persona ?? body.terms_role ?? "author").trim().toLowerCase();
      const termsRole = persona;
      const vaultPactSignature = String(body.vault_pact_signature ?? "").trim();

      if (platformRaw !== "author") {
        res.status(400).json({
          message: "Registration is available on Author Ecosystem only. Use sign-in for other platforms.",
        });
        return;
      }

      if (!isRegisterAuthorPersona(termsRole)) {
        res.status(400).json({
          message: "Select a valid author persona (author, editor, helper, or publisher).",
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

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          username,
          platform: "author",
          persona: termsRole,
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

      mirrorAccessTokenCookie(req, res, sessionData.session.access_token);

      const entitlement = await syncPlatformPersonaSession(res, sessionData.user, {
        platform: "author",
        persona: termsRole,
      });

      const activated = mergeActivatedPersona(sessionData.user.user_metadata ?? {}, termsRole);
      await admin.auth.admin.updateUserById(authUserId, {
        user_metadata: {
          ...(sessionData.user.user_metadata ?? {}),
          activated_personas: activated,
        },
      });

      const u = await mapSupabaseUserToMe({
        ...sessionData.user,
        user_metadata: {
          ...(sessionData.user.user_metadata ?? {}),
          persona: termsRole,
          activated_personas: activated,
        },
      });
      res.status(201).json({
        message: "User registered successfully",
        user: {
          id: u.id,
          username,
          email,
          platform: "author",
          persona: u.persona,
          role: entitlement.userRole,
          tenant_id: entitlement.tenantId,
          msgf_license_provisioned: entitlement.provisionedLicense,
          activated_personas: u.activated_personas,
          theme: "Pleasure",
        },
        redirectUrl: resolvePostLoginRedirect("author"),
      });
    } catch (e) {
      console.error("[bff/auth/register]", e);
      const detail = errorDetail(e);
      const hint =
        /fetch failed|ENOTFOUND|ECONNREFUSED/i.test(detail)
          ? " Check packages/msgf/.env.local Supabase URL/keys and network; run npm run verify:bff-env --prefix apps/author-ecosystem/server."
          : "";
      res.status(500).json({
        message: detail.includes("fetch failed") ? detail : "Registration failed",
        detail: detail + hint,
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
        const u = await mapSupabaseUserToMe(userData.user);
        res.status(200).json({ authenticated: true, user: u });
        return;
      }
    } catch (e) {
      console.error("[bff/auth/me] supabase", e);
    }

    const user = readBearerUser(req, res);
    if (!user) return;
    res.status(200).json({
      authenticated: true,
      user: {
        id: user.userId,
        role: user.role,
        persona: user.role,
        activated_personas: [user.role],
      },
    });
  })();
});

authSessionBridgeController.post("/switch-persona", (req: Request, res: Response) => {
  void (async () => {
    try {
      const persona = String((req.body as Record<string, unknown>)?.persona ?? "")
        .trim()
        .toLowerCase();
      if (!isPersonaValidForPlatform("author", persona)) {
        res.status(400).json({ message: "Invalid author persona." });
        return;
      }

      const supabase = createBffSupabaseServerClient(req, res);
      const { data: userData, error } = await supabase.auth.getUser();
      if (error || !userData.user) {
        res.status(401).json({ message: "Not authenticated." });
        return;
      }

      const meta = { ...(userData.user.user_metadata ?? {}) };
      const activated = readActivatedPersonas(meta, persona);
      if (!activated.includes(persona)) {
        res.status(403).json({
          message: "Activate this role in Settings before switching.",
        });
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      mirrorAccessTokenCookie(req, res, sessionData.session?.access_token);

      const entitlement = await syncPlatformPersonaSession(res, userData.user, {
        platform: "author",
        persona,
      });

      const merged = mergeActivatedPersona(meta, persona);
      const admin = getSupabaseAdmin();
      await admin.auth.admin.updateUserById(userData.user.id, {
        user_metadata: { ...meta, activated_personas: merged },
      });

      const u = await mapSupabaseUserToMe({
        ...userData.user,
        user_metadata: { ...meta, persona, activated_personas: merged },
      });

      res.status(200).json({
        message: "Role switched",
        user: {
          ...u,
          role: entitlement.userRole,
          tenant_id: entitlement.tenantId,
        },
      });
    } catch (e) {
      console.error("[bff/auth/switch-persona]", e);
      res.status(500).json({ message: e instanceof Error ? e.message : "Switch failed." });
    }
  })();
});

authSessionBridgeController.post("/activate-persona", (req: Request, res: Response) => {
  void (async () => {
    try {
      const persona = String((req.body as Record<string, unknown>)?.persona ?? "")
        .trim()
        .toLowerCase();
      if (!isPersonaValidForPlatform("author", persona)) {
        res.status(400).json({ message: "Invalid author persona." });
        return;
      }

      const supabase = createBffSupabaseServerClient(req, res);
      const { data: userData, error } = await supabase.auth.getUser();
      if (error || !userData.user) {
        res.status(401).json({ message: "Not authenticated." });
        return;
      }

      const meta = { ...(userData.user.user_metadata ?? {}) };
      const activated = mergeActivatedPersona(meta, persona);
      const admin = getSupabaseAdmin();
      await admin.auth.admin.updateUserById(userData.user.id, {
        user_metadata: { ...meta, activated_personas: activated },
      });

      res.status(200).json({
        message: "Persona activated",
        activated_personas: activated,
      });
    } catch (e) {
      console.error("[bff/auth/activate-persona]", e);
      res.status(500).json({ message: e instanceof Error ? e.message : "Activation failed." });
    }
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
    const opts = bffCookieBaseOptions(req);
    res.clearCookie(BFF_AUTH_COOKIE_NAME, {
      path: opts.path,
      httpOnly: true,
      sameSite: opts.sameSite,
      secure: opts.secure,
    });
    res.status(204).end();
  })();
});
