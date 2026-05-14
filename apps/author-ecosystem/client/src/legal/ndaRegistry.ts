import authorNdaMd from "@nda/author-nda.md?raw";
import editorHelperNdaMd from "@nda/editor-helper-nda.md?raw";
import fanChroniclerNdaMd from "@nda/fan-chronicler-nda.md?raw";
import publisherLegalNdaMd from "@nda/publisher-legal-nda.md?raw";

/**
 * Counsel-approved publication date for this NDA bundle.  
 * **Sync with** `NDA_LAST_UPDATED_ISO` in `server/src/controllers/legalNda.controller.ts` when you revise any `.md` in `apps/author-ecosystem/nda/`.
 */
export const NDA_LAST_UPDATED_ISO = "2026-05-13";

export type NdaDocumentId = "author" | "editor" | "fan" | "publisher";

export type NdaDocument = {
  id: NdaDocumentId;
  slug: string;
  title: string;
  navLabel: string;
  markdown: string;
};

export const NDA_DOCUMENTS: NdaDocument[] = [
  {
    id: "author",
    slug: "author",
    title: "Author Schedule (Supplement to Vault Seal)",
    navLabel: "Author",
    markdown: authorNdaMd,
  },
  {
    id: "editor",
    slug: "editor",
    title: "Collaborator NDA (Editors & Helpers)",
    navLabel: "Editor & Helper",
    markdown: editorHelperNdaMd,
  },
  {
    id: "fan",
    slug: "fan",
    title: "Fan & Chronicler Agreement (Lore-Gate)",
    navLabel: "Fan & Chronicler",
    markdown: fanChroniclerNdaMd,
  },
  {
    id: "publisher",
    slug: "publisher",
    title: "Publisher & Legal Entity Non-Disclosure Agreement",
    navLabel: "Publisher & Legal",
    markdown: publisherLegalNdaMd,
  },
];

export function getNdaDocument(slug: string | undefined): NdaDocument | undefined {
  if (!slug) return undefined;
  const s = slug.trim().toLowerCase();
  return NDA_DOCUMENTS.find((d) => d.slug === s);
}
