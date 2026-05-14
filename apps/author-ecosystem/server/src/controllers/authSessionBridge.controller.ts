import { Router, type Request, type Response } from "express";

import { BFF_AUTH_COOKIE_NAME, bffCookieBaseOptions } from "../lib/bffAuthCookies.js";
import { legacyInternalFetch } from "../lib/legacyInternalFetch.js";
import { readBearerUser } from "../lib/readBearerJwtUser.js";
import { VAULT_PACT_ATTESTATION_PHRASE } from "../lib/vaultPactAttestation.js";

export const authSessionBridgeController = Router();

function stripTokenFromAuthJson(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const o = { ...(body as Record<string, unknown>) };
  delete o.token;
  return o;
}

const REGISTER_TERMS_ROLES = new Set(["author", "editor", "fan", "publisher"]);

async function forwardAuthJson(res: Response, path: "login" | "register", jsonBody: unknown): Promise<void> {
  try {
    const { status, json } = await legacyInternalFetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(jsonBody ?? {}),
    });

    const token =
      json && typeof json === "object" && !Array.isArray(json) && typeof (json as { token?: unknown }).token === "string"
        ? String((json as { token: string }).token).trim()
        : "";

    if (token && status >= 200 && status < 300) {
      res.cookie(BFF_AUTH_COOKIE_NAME, token, bffCookieBaseOptions());
    }

    const safeBody = stripTokenFromAuthJson(json);
    res.status(status).json(safeBody);
  } catch (e) {
    console.error(`[bff/auth/${path}]`, e);
    res.status(502).json({
      message: "Auth bridge could not reach legacy service",
      detail: e instanceof Error ? e.message : String(e),
    });
  }
}

async function forwardAuthAndSetCookie(req: Request, res: Response, path: "login" | "register"): Promise<void> {
  await forwardAuthJson(res, path, req.body ?? {});
}

/**
 * GET /api/auth/me — session check for browsers/extensions using `credentials: "include"`
 * (httpOnly `author_bff_jwt`) and/or `Authorization: Bearer`.
 */
authSessionBridgeController.get("/me", (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;
  res.status(200).json({ authenticated: true, user: { id: user.userId, role: user.role } });
});

/**
 * Proxied auth: forwards to legacy `POST /api/auth/login`, then drops `token` from JSON and sets httpOnly cookie.
 */
authSessionBridgeController.post("/login", (req: Request, res: Response) => {
  void forwardAuthAndSetCookie(req, res, "login");
});

/**
 * Proxied registration: requires **Vault Pact** electronic attestation (exact phrase) and a valid
 * `terms_role` schedule lane before forwarding to legacy `POST /api/auth/register` with **only**
 * `username`, `email`, `password`.
 */
authSessionBridgeController.post("/register", (req: Request, res: Response) => {
  void (async () => {
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
    const email = String(body.email ?? "").trim();
    const password = String(body.password ?? "");
    if (!username || !email || !password) {
      res.status(400).json({ message: "Username, email, and password are required." });
      return;
    }

    await forwardAuthJson(res, "register", { username, email, password });
  })();
});

/** Clears the BFF auth cookie (client should still call legacy logout if added later). */
authSessionBridgeController.post("/logout", (_req: Request, res: Response) => {
  const opts = bffCookieBaseOptions();
  res.clearCookie(BFF_AUTH_COOKIE_NAME, { path: opts.path, httpOnly: true, sameSite: opts.sameSite, secure: opts.secure });
  res.status(204).end();
});
