import fs from "node:fs/promises";
import path from "node:path";
import { Router, type Request, type Response } from "express";

import { NDA_ROOT } from "../lib/ndaRoot.js";
import { readBearerUser } from "../lib/readBearerJwtUser.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { VAULT_PACT_ATTESTATION_PHRASE } from "../lib/vaultPactAttestation.js";
import { getCurrentVaultPactSha256 } from "../middleware/pactGuard.js";

export const legalNdaController = Router();

const VAULT_PACT_FILE = "vault-pact-bilateral.md";
const VAULT_PACT_DOC_SLUG = "vault-pact-bilateral";

/** Keep in sync with `client/src/legal/vaultPactRegistry.ts`. */
const VAULT_PACT_LAST_UPDATED_ISO = "2026-05-13";

/** Keep in sync with `client/src/legal/ndaRegistry.ts` when publishing a counsel-approved revision. */
const NDA_LAST_UPDATED_ISO = "2026-05-13";

/**
 * GET /api/legal/vault-pact — bilateral Vault Pact + attestation phrase (for clients that fetch at runtime).
 * Registered before `/api/legal/nda/:slug` so paths do not collide.
 */
legalNdaController.get("/api/legal/vault-pact", async (_req: Request, res: Response) => {
  try {
    const markdown = await fs.readFile(path.join(NDA_ROOT, VAULT_PACT_FILE), "utf8");
    res.status(200).json({
      lastUpdated: VAULT_PACT_LAST_UPDATED_ISO,
      markdown,
      attestationPhrase: VAULT_PACT_ATTESTATION_PHRASE,
    });
  } catch (e) {
    console.error("[legal/vault-pact] read", e);
    res.status(500).json({ error: "Could not load Vault Pact", detail: e instanceof Error ? e.message : String(e) });
  }
});

/**
 * GET /api/legal/vault-attestation-status — latest Vault Pact attestation vs server file hash (BFF JWT).
 */
legalNdaController.get("/api/legal/vault-attestation-status", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  try {
    const admin = getSupabaseAdmin();
    const currentHash = (await getCurrentVaultPactSha256()).toLowerCase();

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("id")
      .eq("id", user.userId)
      .maybeSingle();

    if (profileErr) {
      res.status(500).json({ error: profileErr.message });
      return;
    }
    if (!profile) {
      res.status(200).json({ status: "unsigned", doc_slug: VAULT_PACT_DOC_SLUG, reason: "no_profile" });
      return;
    }

    const { data: rows, error } = await admin
      .from("legal_attestations")
      .select("content_hash")
      .eq("user_id", user.userId)
      .eq("doc_slug", VAULT_PACT_DOC_SLUG)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const row = rows?.[0] as { content_hash?: string } | undefined;
    const attested = row?.content_hash ? String(row.content_hash).toLowerCase() : null;
    if (!attested) {
      res.status(200).json({ status: "unsigned", doc_slug: VAULT_PACT_DOC_SLUG });
      return;
    }
    if (attested !== currentHash) {
      res.status(200).json({ status: "outdated", doc_slug: VAULT_PACT_DOC_SLUG });
      return;
    }

    res.status(200).json({ status: "signed", doc_slug: VAULT_PACT_DOC_SLUG });
  } catch (e) {
    console.error("[legal/vault-attestation-status]", e);
    res.status(500).json({ error: "vault_attestation_status_failed", detail: e instanceof Error ? e.message : String(e) });
  }
});

/**
 * POST /api/legal/vault-pact-attest — record a new Vault Pact attestation for the signed-in user.
 */
legalNdaController.post("/api/legal/vault-pact-attest", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  const body = req.body as Record<string, unknown>;
  const signature = String(body.vault_pact_signature ?? "").trim();
  if (signature !== VAULT_PACT_ATTESTATION_PHRASE) {
    res.status(400).json({
      error: "invalid_attestation",
      message: `Type exactly: ${VAULT_PACT_ATTESTATION_PHRASE}`,
    });
    return;
  }

  try {
    const admin = getSupabaseAdmin();
    const contentHash = (await getCurrentVaultPactSha256()).toLowerCase();

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("id")
      .eq("id", user.userId)
      .maybeSingle();

    if (profileErr) {
      res.status(500).json({ error: profileErr.message });
      return;
    }
    if (!profile) {
      res.status(409).json({
        error: "no_profile",
        message: "Your account has no Supabase profile row yet; complete onboarding before attesting.",
      });
      return;
    }

    const { error: insertErr } = await admin.from("legal_attestations").insert({
      user_id: user.userId,
      doc_slug: VAULT_PACT_DOC_SLUG,
      content_hash: contentHash,
      signature_text: VAULT_PACT_ATTESTATION_PHRASE,
      metadata: { source: "vault_protector" },
    });

    if (insertErr) {
      console.error("[legal/vault-pact-attest] insert", insertErr);
      res.status(500).json({ error: insertErr.message });
      return;
    }

    res.status(201).json({ ok: true, status: "signed", doc_slug: VAULT_PACT_DOC_SLUG });
  } catch (e) {
    console.error("[legal/vault-pact-attest]", e);
    res.status(500).json({ error: "vault_pact_attest_failed", detail: e instanceof Error ? e.message : String(e) });
  }
});

const NDA_FILES = [
  { slug: "author", title: "Author Schedule (Supplement to Vault Seal)", file: "author-nda.md" },
  { slug: "editor", title: "Collaborator NDA (Editors & Helpers)", file: "editor-helper-nda.md" },
  { slug: "fan", title: "Fan & Chronicler Agreement (Lore-Gate)", file: "fan-chronicler-nda.md" },
  { slug: "publisher", title: "Publisher & Legal Entity Non-Disclosure Agreement", file: "publisher-legal-nda.md" },
] as const;

/**
 * GET /api/legal/nda — JSON bundle (same markdown as web `?raw` imports).
 */
legalNdaController.get("/api/legal/nda", async (_req: Request, res: Response) => {
  try {
    const documents = await Promise.all(
      NDA_FILES.map(async (d) => {
        const markdown = await fs.readFile(path.join(NDA_ROOT, d.file), "utf8");
        return { slug: d.slug, title: d.title, markdown };
      })
    );
    res.status(200).json({ lastUpdated: NDA_LAST_UPDATED_ISO, documents });
  } catch (e) {
    console.error("[legal/nda] bundle read", e);
    res.status(500).json({ error: "Could not load NDA files", detail: e instanceof Error ? e.message : String(e) });
  }
});

/** GET /api/legal/nda/:slug — single markdown document (utf-8). */
legalNdaController.get("/api/legal/nda/:slug", async (req: Request, res: Response) => {
  const slug = String(req.params.slug ?? "").trim().toLowerCase();
  const meta = NDA_FILES.find((d) => d.slug === slug);
  if (!meta) {
    res.status(404).json({ error: "Unknown NDA slug", slugs: NDA_FILES.map((d) => d.slug) });
    return;
  }
  try {
    const markdown = await fs.readFile(path.join(NDA_ROOT, meta.file), "utf8");
    res.status(200).type("text/markdown; charset=utf-8").send(markdown);
  } catch (e) {
    console.error("[legal/nda] single read", slug, e);
    res.status(500).json({ error: "Could not load NDA file", detail: e instanceof Error ? e.message : String(e) });
  }
});
