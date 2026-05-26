/** Cross-route signal after document ingest commit (wiki refresh, plot sandbox). */
export const DOCUMENT_INGEST_COMMITTED_EVENT = "elphie:document-ingest-committed";

export type DocumentIngestCommittedDetail = {
  manuscriptId: string;
  wikiCount: number;
  beatCount: number;
};

export function dispatchDocumentIngestCommitted(detail: DocumentIngestCommittedDetail): void {
  window.dispatchEvent(
    new CustomEvent<DocumentIngestCommittedDetail>(DOCUMENT_INGEST_COMMITTED_EVENT, { detail })
  );
}
