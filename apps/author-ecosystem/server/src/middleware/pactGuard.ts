import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import type { NextFunction, Request, RequestHandler, Response } from "express";

import { getMonorepoRootDir, loadMonorepoRootEnv } from "../lib/database/loadRootEnv.js";
import { readBearerUser } from "../lib/readBearerJwtUser.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";

const DEFAULT_DOC_SLUG = "vault-pact-bilateral";

let vaultHashCache: { mtimeMs: number; hash: string } | null = null;

function sha256HexUtf8(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function vaultPactMarkdownPath(): string {
  return join(getMonorepoRootDir(), "apps", "author-ecosystem", "nda", "vault-pact-bilateral.md");
}

/**
 * SHA-256 (64 hex, lowercase) of the on-disk Vault Pact markdown. Cached by `mtimeMs` so edits
 * are picked up without redeploy.
 */
export async function getCurrentVaultPactSha256(): Promise<string> {
  loadMonorepoRootEnv();
  const path = vaultPactMarkdownPath();
  const st = await stat(path);
  const mtimeMs = Number(st.mtimeMs);
  if (vaultHashCache && vaultHashCache.mtimeMs === mtimeMs) {
    return vaultHashCache.hash;
  }
  const markdown = await readFile(path, "utf8");
  const hash = sha256HexUtf8(markdown).toLowerCase();
  vaultHashCache = { mtimeMs, hash };
  return hash;
}

/** Alias for policy wording / env overrides (see `PACT_GUARD_DOC_SLUG`). */
export const CURRENT_VAULT_DOC_SLUG = DEFAULT_DOC_SLUG;

export function isPactGuardedPath(pathname: string): boolean {
  return (
    pathname === "/api/vault" ||
    pathname.startsWith("/api/vault/") ||
    pathname === "/api/write" ||
    pathname.startsWith("/api/write/")
  );
}

export type PactGuardOptions = {
  /**
   * Legal doc slug stored in `legal_attestations.doc_slug`.
   * Defaults to `process.env.PACT_GUARD_DOC_SLUG` or `vault-pact-bilateral`.
   */
  docSlug?: string;
  /** Override hash source (tests). If omitted, hashes `vault-pact-bilateral.md` on disk. */
  getCurrentVaultHash?: () => Promise<string>;
};

/**
 * Blocks `/api/vault/*` and `/api/write/*` unless the JWT user has a matching row in
 * `public.legal_attestations` for the configured `doc_slug` and the attested `content_hash`
 * matches the current Vault Pact bytes on the server.
 */
export function createPactGuard(options: PactGuardOptions = {}): RequestHandler {
  const docSlug =
    options.docSlug?.trim() ||
    process.env.PACT_GUARD_DOC_SLUG?.trim() ||
    DEFAULT_DOC_SLUG;
  const resolveHash = options.getCurrentVaultHash ?? getCurrentVaultPactSha256;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.method === "OPTIONS") {
      next();
      return;
    }
    if (!isPactGuardedPath(req.path)) {
      next();
      return;
    }

    const user = readBearerUser(req, res);
    if (!user) {
      return;
    }

    loadMonorepoRootEnv();
    const admin = getSupabaseAdmin();

    const { data: rows, error } = await admin
      .from("legal_attestations")
      .select("id, content_hash, created_at")
      .eq("user_id", user.userId)
      .eq("doc_slug", docSlug)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      res.status(500).json({ code: "PACT_GUARD_QUERY_FAILED", message: error.message });
      return;
    }

    const row = rows?.[0] as { content_hash?: string } | undefined;
    if (!row?.content_hash) {
      res.status(403).json({
        code: "PACT_NOT_SIGNED",
        message: "Access denied. Vault Pact signature required.",
      });
      return;
    }

    let currentHash: string;
    try {
      currentHash = (await resolveHash()).toLowerCase();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ code: "PACT_GUARD_HASH_FAILED", message: msg });
      return;
    }

    const attested = String(row.content_hash).toLowerCase();
    if (attested !== currentHash) {
      res.status(403).json({
        code: "PACT_UPDATE_REQUIRED",
        message: "Vault Pact has changed since your attestation. Re-sign the current pact to continue.",
      });
      return;
    }

    next();
  };
}

/** Default middleware instance (env-driven `PACT_GUARD_DOC_SLUG`, on-disk Vault Pact hash). */
export const pactGuard = createPactGuard();
