import { useState } from "react";

import { displayTitle, type HubManuscript } from "../lib/manuscriptTypes";

export function FinishRevisionsDialog(props: {
  open: boolean;
  target: HubManuscript | null;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [ack, setAck] = useState(false);

  if (!props.open || !props.target) return null;

  const title = displayTitle(props.target);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="finish-revisions-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-amber-700/50 bg-zinc-950 p-6 shadow-2xl">
        <h2 id="finish-revisions-title" className="text-lg font-semibold text-amber-50">
          Finished revisions
        </h2>
        <p className="mt-2 text-sm text-zinc-300">
          You are about to mark <span className="font-medium text-zinc-100">{title}</span> as{" "}
          <span className="text-amber-200">Finished</span> and lock wiki lore at this revision point.
        </p>
        <div className="mt-4 space-y-2 rounded-lg border border-amber-900/40 bg-amber-950/20 p-3 text-sm text-amber-100/90">
          <p>
            If you confirm, this information is locked into your wiki. You will{" "}
            <strong>not</strong> be able to roll the wiki back to this point without contacting support.
          </p>
          <p>
            You must email us to verify you are the account admin and provide a reason for any retroactive wiki
            edit. We will process unlock requests manually.
          </p>
        </div>
        <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
            className="mt-0.5"
          />
          I understand the wiki will be locked at this revision and future edits require admin verification.
        </label>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            disabled={props.busy}
            onClick={() => {
              setAck(false);
              props.onCancel();
            }}
            className="rounded-full border border-zinc-700 px-4 py-2 text-xs text-zinc-300"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!ack || props.busy}
            onClick={props.onConfirm}
            className="rounded-full border border-amber-500/60 bg-amber-600 px-4 py-2 text-xs font-semibold text-amber-950 disabled:opacity-40"
          >
            {props.busy ? "Locking…" : "Confirm & lock wiki"}
          </button>
        </div>
      </div>
    </div>
  );
}
