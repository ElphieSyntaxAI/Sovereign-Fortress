import { getOutlineLoreKindConfig } from "../lib/outlineLoreKinds";
import { useWikiDrafts } from "../context/WikiDraftContext";
import type { OutlineLoreKind } from "../lib/outlineLoreKinds";

export function WikiUnsavedDraftsList(props: {
  onOpenDraft: (kind: OutlineLoreKind, draftId: string) => void;
}) {
  const { drafts } = useWikiDrafts();
  if (drafts.length === 0) return null;

  return (
    <section className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-4">
      <h3 className="text-sm font-semibold text-amber-100">Unsaved sheets (active memory)</h3>
      <p className="mt-1 text-xs text-amber-200/70">
        Stored in this browser only until you commit to wiki or clear all unsaved.
      </p>
      <ul className="mt-3 space-y-2">
        {drafts.map((d) => {
          const cfg = getOutlineLoreKindConfig(d.kind);
          return (
            <li
              key={d.draftId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-900/30 bg-zinc-950/50 px-3 py-2"
            >
              <span className="text-xs text-zinc-200">
                {cfg.label}: <span className="font-medium">{d.title || "(untitled)"}</span>
              </span>
              <button
                type="button"
                onClick={() => props.onOpenDraft(d.kind, d.draftId)}
                className="rounded-full border border-amber-600/50 px-2 py-1 text-[10px] text-amber-100"
              >
                Resume sheet
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
