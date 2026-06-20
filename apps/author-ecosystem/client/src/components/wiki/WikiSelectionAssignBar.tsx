import { useEffect, useState } from "react";

import type { OutlineLoreKind } from "../../lib/outlineLoreKinds";
import {
  normalizeWikiExcerpt,
  WIKI_EXCERPT_MIME,
} from "../../lib/wikiSelectionAssign";

const ASSIGN_KINDS: { kind: OutlineLoreKind; label: string }[] = [
  { kind: "character", label: "Character" },
  { kind: "setting", label: "Setting" },
  { kind: "environment", label: "Environment" },
];

type WikiSelectionAssignBarProps = {
  enabled: boolean;
  onAssign: (kind: OutlineLoreKind, excerpt: string) => void;
};

export function WikiSelectionAssignBar({ enabled, onAssign }: WikiSelectionAssignBarProps) {
  const [excerpt, setExcerpt] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!enabled) {
      setExcerpt("");
      setPos(null);
      return;
    }

    const onSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setExcerpt("");
        setPos(null);
        return;
      }
      const text = normalizeWikiExcerpt(sel.toString());
      if (text.length < 12) {
        setExcerpt("");
        setPos(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setExcerpt(text);
      setPos({
        top: Math.max(8, rect.top + window.scrollY - 48),
        left: Math.min(window.innerWidth - 280, Math.max(8, rect.left + window.scrollX)),
      });
    };

    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [enabled]);

  if (!enabled || !excerpt || !pos) return null;

  return (
    <div
      className="wiki-selection-assign-bar fixed z-[60] flex max-w-[min(100vw-1rem,340px)] flex-col gap-2 rounded-lg border border-violet-500/50 bg-zinc-950/95 p-2 shadow-xl backdrop-blur-sm"
      style={{ top: pos.top, left: pos.left }}
      role="toolbar"
      aria-label="Assign selected text to lore"
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-300">
        Selected excerpt
      </p>
      <p
        className="line-clamp-2 cursor-grab text-xs text-zinc-300 active:cursor-grabbing"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(WIKI_EXCERPT_MIME, excerpt);
          e.dataTransfer.setData("text/plain", excerpt);
          e.dataTransfer.effectAllowed = "copy";
        }}
        title="Drag onto Character, Setting, or Environment on the wiki rail"
      >
        {excerpt}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {ASSIGN_KINDS.map(({ kind, label }) => (
          <button
            key={kind}
            type="button"
            onClick={() => {
              onAssign(kind, excerpt);
              window.getSelection()?.removeAllRanges();
              setExcerpt("");
              setPos(null);
            }}
            className="rounded-full border border-violet-600/50 bg-violet-900/60 px-2.5 py-1 text-[11px] font-medium text-violet-100 hover:bg-violet-800/80"
          >
            → {label}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-zinc-500">Or drag the excerpt to the wiki rail →</p>
    </div>
  );
}
