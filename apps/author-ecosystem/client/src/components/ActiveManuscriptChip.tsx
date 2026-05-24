import { Link } from "react-router-dom";

import { useNarrative } from "../context/NarrativeContext";

export function ActiveManuscriptChip() {
  const { selection } = useNarrative();

  if (!selection) {
    return (
      <Link
        to="/manuscripts"
        className="hidden max-w-[14rem] truncate rounded-full border border-amber-700/40 bg-amber-950/30 px-2.5 py-1 text-[10px] text-amber-200/90 sm:inline-block"
      >
        No active project
      </Link>
    );
  }

  const label = selection.title?.trim() || selection.manuscriptId.slice(0, 8);

  return (
    <Link
      to="/manuscripts"
      title={selection.manuscriptId}
      className="hidden max-w-[14rem] truncate rounded-full border border-zinc-700 bg-zinc-900/80 px-2.5 py-1 text-[10px] text-zinc-300 hover:border-zinc-500 sm:inline-block"
    >
      <span className="text-zinc-500">MS:</span> {label}
    </Link>
  );
}
