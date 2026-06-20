import { useCallback, useEffect, useId, useRef, useState } from "react";

import type { WikiEntityCardData } from "../../lib/wikiEntityCard";

type WikiEntityLinkProps = {
  label: string;
  card: WikiEntityCardData;
  onOpenArticle: (chunkId: string) => void;
  /** Shorter label for environment sub-traits */
  sublabel?: string;
};

export function WikiEntityLink({ label, card, onOpenArticle, sublabel }: WikiEntityLinkProps) {
  const popoverId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setOpen(true), 180);
  }, []);

  const hide = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (!pinned) setOpen(false);
  }, [pinned]);

  useEffect(() => {
    if (!pinned) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setPinned(false);
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [pinned]);

  useEffect(() => {
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    };
  }, []);

  const handleClick = () => {
    setPinned(true);
    setOpen(true);
    onOpenArticle(card.chunkId);
  };

  return (
    <span ref={rootRef} className="relative inline">
      <button
        type="button"
        className="wiki-entity-link rounded px-0.5 text-left font-medium text-amber-800 underline decoration-amber-500/50 underline-offset-2 transition hover:text-amber-600 hover:decoration-amber-500 dark:text-amber-300 dark:hover:text-amber-200"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={handleClick}
      >
        {label}
        {sublabel ? (
          <span className="ml-1 text-xs font-normal text-zinc-500 dark:text-zinc-400">({sublabel})</span>
        ) : null}
      </button>

      {open ? (
        <div
          id={popoverId}
          role="dialog"
          aria-label={`${card.title} details`}
          className="wiki-entity-popover absolute left-0 top-full z-50 mt-2 w-[min(100vw-2rem,320px)] rounded-lg border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={hide}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            {card.kindLabel}
          </p>
          <p className="mt-0.5 font-[Georgia,serif] text-base font-bold text-zinc-900 dark:text-zinc-50">
            {card.title}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{card.summary}</p>

          {card.traits.length > 0 ? (
            <dl className="mt-3 space-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
              {card.traits.slice(0, 3).map((t) => (
                <div key={t.id}>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{t.label}</dt>
                  <dd className="mt-0.5 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                    {t.value.length > 160 ? `${t.value.slice(0, 157)}…` : t.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          {card.abilities.length > 0 ? (
            <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Abilities & traits</p>
              <ul className="mt-1.5 space-y-1 text-xs text-zinc-700 dark:text-zinc-300">
                {card.abilities.slice(0, 3).map((a) => (
                  <li key={a.id}>
                    <span className="font-medium text-zinc-800 dark:text-zinc-200">{a.label}:</span>{" "}
                    {a.value.length > 100 ? `${a.value.slice(0, 97)}…` : a.value}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => onOpenArticle(card.chunkId)}
            className="mt-3 w-full rounded-md bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-200 dark:bg-amber-950/60 dark:text-amber-100 dark:hover:bg-amber-950"
          >
            Open full article →
          </button>
        </div>
      ) : null}
    </span>
  );
}
