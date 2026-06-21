import { useState } from "react";

import { bulkScrapFileImportJunk } from "../lib/wikiEntryClient";

export function WikiFileImportCleanup(props: {
  manuscriptId: string;
  count: number;
  onStatus?: (msg: string) => void;
  onReloadWiki: () => void;
}) {
  const [busy, setBusy] = useState(false);

  if (props.count <= 0) return null;

  const runCleanup = async () => {
    const label =
      props.count === 1
        ? "1 file-import outline row"
        : `${props.count} file-import outline rows`;
    if (
      !window.confirm(
        `Remove ${label} from the lore wiki?\n\nThese are chapter/scene outline beats that were duplicated as empty plot points during import. They move to Scrapped ideas — you can restore individual rows later if needed.`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await bulkScrapFileImportJunk(props.manuscriptId, { dry_run: false });
      props.onStatus?.(`Removed ${res.scrapped_count ?? 0} import duplicate(s) from the lore wiki.`);
      props.onReloadWiki();
    } catch (e) {
      props.onStatus?.(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-50/80 px-3 py-2 text-sm dark:border-amber-600/40 dark:bg-amber-950/30">
      <p className="text-amber-900 dark:text-amber-100">
        <strong>Import cleanup:</strong> {props.count} outline beat{props.count === 1 ? "" : "s"} from a
        document import {props.count === 1 ? "is" : "are"} still stored as lore wiki rows (often empty plot
        points). New imports no longer create these duplicates.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void runCleanup()}
        className="mt-2 rounded-md bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
      >
        {busy ? "Removing…" : `Remove ${props.count} import duplicate${props.count === 1 ? "" : "s"}`}
      </button>
    </div>
  );
}
