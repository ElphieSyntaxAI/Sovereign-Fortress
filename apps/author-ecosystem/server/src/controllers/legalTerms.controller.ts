import fs from "node:fs/promises";
import path from "node:path";
import { Router, type Request, type Response } from "express";

import { TERMS_ROOT } from "../lib/termsRoot.js";

export const legalTermsController = Router();

/** Keep in sync with `client/src/legal/termsRegistry.ts` when publishing a counsel-approved revision. */
const TERMS_LAST_UPDATED_ISO = "2026-05-13";

const TERMS_FILES = [
  { slug: "author", title: "Author Terms & Conditions", file: "author-terms.md" },
  { slug: "editor", title: "Editor & Helper Terms (Collaborators)", file: "editor-helper-terms.md" },
  { slug: "fan", title: "Fan & Chronicler Terms (Community)", file: "fan-chronicler-terms.md" },
  { slug: "publisher", title: "Publisher & Legal Entity Terms", file: "publisher-legal-terms.md" },
] as const;

/**
 * GET /api/legal/terms — JSON bundle (same markdown as web `?raw` imports).
 * For extensions, mobile shells, or other surfaces that cannot bundle Vite raw modules.
 */
legalTermsController.get("/api/legal/terms", async (_req: Request, res: Response) => {
  try {
    const documents = await Promise.all(
      TERMS_FILES.map(async (d) => {
        const markdown = await fs.readFile(path.join(TERMS_ROOT, d.file), "utf8");
        return { slug: d.slug, title: d.title, markdown };
      })
    );
    res.status(200).json({ lastUpdated: TERMS_LAST_UPDATED_ISO, documents });
  } catch (e) {
    console.error("[legal/terms] bundle read", e);
    res.status(500).json({ error: "Could not load terms files", detail: e instanceof Error ? e.message : String(e) });
  }
});

/** GET /api/legal/terms/:slug — single markdown document (utf-8). */
legalTermsController.get("/api/legal/terms/:slug", async (req: Request, res: Response) => {
  const slug = String(req.params.slug ?? "").trim().toLowerCase();
  const meta = TERMS_FILES.find((d) => d.slug === slug);
  if (!meta) {
    res.status(404).json({ error: "Unknown terms slug", slugs: TERMS_FILES.map((d) => d.slug) });
    return;
  }
  try {
    const markdown = await fs.readFile(path.join(TERMS_ROOT, meta.file), "utf8");
    res.status(200).type("text/markdown; charset=utf-8").send(markdown);
  } catch (e) {
    console.error("[legal/terms] single read", slug, e);
    res.status(500).json({ error: "Could not load terms file", detail: e instanceof Error ? e.message : String(e) });
  }
});
