import { useCallback, useEffect, useId, useRef, useState } from "react";

import type { WikiEnvironmentTraitLink } from "../../lib/wikiEntityCard";

type Props = {
  trait: WikiEnvironmentTraitLink;
  onOpenArticle: (chunkId: string) => void;
};

export function WikiEnvironmentTraitLink({ trait, onOpenArticle }: Props) {
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

  return (
    <span ref={rootRef} className="relative inline">
      <button
        type="button"
        className="wiki-env-trait-link rounded px-0.5 text-left text-sm font-medium text-teal-800 underline decoration-teal-500/40 underline-offset-2 hover:text-teal-600 dark:text-teal-300 dark:hover:text-teal-200"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={() => {
          setPinned(true);
          setOpen(true);
          onOpenArticle(trait.chunkId);
        }}
      >
        {trait.label}
      </button>

      {open ? (
        <div
          id={popoverId}
          role="dialog"
          aria-label={`${trait.label} environment details`}
          className="absolute left-0 top-full z-50 mt-2 w-[min(100vw-2rem,300px)] rounded-lg border border-teal-200/60 bg-white p-4 shadow-xl dark:border-teal-900/50 dark:bg-zinc-900"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={hide}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
            Environment · {trait.chunkTitle}
          </p>
          <p className="mt-0.5 font-semibold text-zinc-900 dark:text-zinc-50">{trait.label}</p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{trait.description}</p>

          {trait.details.length > 0 ? (
            <dl className="mt-3 space-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
              {trait.details.map((d) => (
                <div key={d.id}>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{d.label}</dt>
                  <dd className="mt-0.5 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                    {d.value.length > 200 ? `${d.value.slice(0, 197)}…` : d.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          <button
            type="button"
            onClick={() => onOpenArticle(trait.chunkId)}
            className="mt-3 w-full rounded-md bg-teal-100 px-3 py-1.5 text-xs font-semibold text-teal-950 hover:bg-teal-200 dark:bg-teal-950/50 dark:text-teal-100"
          >
            Open environment article →
          </button>
        </div>
      ) : null}
    </span>
  );
}
