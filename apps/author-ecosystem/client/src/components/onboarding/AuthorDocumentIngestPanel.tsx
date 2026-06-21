import { useState } from "react";
import { Link } from "react-router-dom";

import { DocumentIngestFlow, type DocumentSlot } from "./DocumentIngestFlow";
import { getPreferredBffBearer } from "../../lib/authAccessToken";

const SLOTS: { id: DocumentSlot; label: string }[] = [
  { id: "current_draft", label: "Current draft" },
  { id: "world_bible", label: "World bible" },
  { id: "character_sheet", label: "Character sheets" },
];

/**
 * Author-facing import + verify entry on Outline (replaces read-only callout).
 */
export function AuthorDocumentIngestPanel(props: {
  manuscriptId: string;
  onCommitted?: () => void;
}) {
  const [slot, setSlot] = useState<DocumentSlot>("current_draft");

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-violet-900/40 bg-violet-950/20 p-4">
        <h3 className="text-sm font-semibold text-violet-100">Import & verify documents</h3>
        <p className="mt-2 text-xs text-violet-200/75">
          Upload or pick a Google Doc. After scan you get a <strong className="text-violet-100">review step</strong> to
          edit wiki rows and outline beats before anything is stored. Committed entries appear on{" "}
          <Link to="/wiki" className="underline hover:text-violet-100">
            Wiki
          </Link>{" "}
          and load into{" "}
          <span className="text-emerald-200">Building block outline</span> token pools below.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SLOTS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSlot(s.id)}
            className={[
              "rounded-lg border px-3 py-1.5 text-xs font-medium transition",
              slot === s.id
                ? "border-violet-500/60 bg-violet-950/50 text-violet-100"
                : "border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-600",
            ].join(" ")}
          >
            {s.label}
          </button>
        ))}
      </div>

      <DocumentIngestFlow
        key={slot}
        slot={slot}
        manuscriptId={props.manuscriptId}
        getAccessToken={() => getPreferredBffBearer()}
        onCommitted={props.onCommitted}
      />
    </div>
  );
}
