import { Link } from "react-router-dom";

/**
 * Planning workspace does not run file ingestion — authors use the extension or scratch planning.
 * Import is only via explicit upload on Manuscripts.
 */
export function ImportDocumentCallout(props: { manuscriptId?: string }) {
  const href = props.manuscriptId
    ? `/manuscripts#import-documents`
    : "/manuscripts";

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-6">
      <h3 className="text-sm font-semibold text-zinc-100">File import (not used while planning here)</h3>
      <p className="mt-2 text-sm text-zinc-400">
        If you are outlining on the site or writing from the start with the HAL extension, you do not need
        document ingestion. Ingestion runs only when you choose a new file to upload (World Bible, draft, or
        character sheets).
      </p>
      <p className="mt-3 text-sm text-zinc-500">
        Uploads are chunked into wiki building blocks, scene cards, and an interactive outline for Plot
        Sandbox and the Wiki rail.
      </p>
      <Link
        to={href}
        className="mt-4 inline-block rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
      >
        Import a document on Manuscripts
      </Link>
    </div>
  );
}
