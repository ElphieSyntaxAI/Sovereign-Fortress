/** Cross-route signal after document ingest commit (wiki refresh, plot engine). */
export const DOCUMENT_INGEST_COMMITTED_EVENT = "elphie:document-ingest-committed";

export type IngestWikiRow = {
  title?: string;
  excerpt?: string;
  chunk_type?: string;
  wiki_metadata?: { outline_entity_kind?: string };
};

export type IngestBeatRow = {
  synopsis?: string;
  order?: number;
  title?: string;
};

export type DocumentIngestCommittedDetail = {
  manuscriptId: string;
  wikiCount: number;
  beatCount: number;
  proposedWiki?: IngestWikiRow[];
  outlineBeats?: IngestBeatRow[];
};

export function dispatchDocumentIngestCommitted(detail: DocumentIngestCommittedDetail): void {
  window.dispatchEvent(
    new CustomEvent<DocumentIngestCommittedDetail>(DOCUMENT_INGEST_COMMITTED_EVENT, { detail })
  );
}
