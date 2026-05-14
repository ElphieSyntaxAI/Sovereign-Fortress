import authorTermsMd from "@terms/author-terms.md?raw";
import editorHelperTermsMd from "@terms/editor-helper-terms.md?raw";
import fanChroniclerTermsMd from "@terms/fan-chronicler-terms.md?raw";
import publisherLegalTermsMd from "@terms/publisher-legal-terms.md?raw";

/**
 * Counsel-approved publication date for this bundle.  
 * **Sync with** `TERMS_LAST_UPDATED_ISO` in `server/src/controllers/legalTerms.controller.ts` when you revise any `.md` in `apps/author-ecosystem/terms/`.
 */
export const TERMS_LAST_UPDATED_ISO = "2026-05-13";

export type TermsDocumentId = "author" | "editor" | "fan" | "publisher";

export type TermsDocument = {
  id: TermsDocumentId;
  slug: string;
  title: string;
  /** Short label for nav */
  navLabel: string;
  markdown: string;
};

export const TERMS_DOCUMENTS: TermsDocument[] = [
  {
    id: "author",
    slug: "author",
    title: "Author Terms & Conditions",
    navLabel: "Author",
    markdown: authorTermsMd,
  },
  {
    id: "editor",
    slug: "editor",
    title: "Editor & Helper Terms (Collaborators)",
    navLabel: "Editor & Helper",
    markdown: editorHelperTermsMd,
  },
  {
    id: "fan",
    slug: "fan",
    title: "Fan & Chronicler Terms (Community)",
    navLabel: "Fan & Chronicler",
    markdown: fanChroniclerTermsMd,
  },
  {
    id: "publisher",
    slug: "publisher",
    title: "Publisher & Legal Entity Terms",
    navLabel: "Publisher & Legal",
    markdown: publisherLegalTermsMd,
  },
];

export function getTermsDocument(slug: string | undefined): TermsDocument | undefined {
  if (!slug) return undefined;
  const s = slug.trim().toLowerCase();
  return TERMS_DOCUMENTS.find((d) => d.slug === s);
}
