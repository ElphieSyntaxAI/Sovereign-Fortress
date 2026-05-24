import { useAuthorWorkspaceLens } from "../context/AuthorWorkspaceLensContext";
import type { AuthorWorkspaceLens } from "../lib/authorWorkspaceLens";

const OPTIONS: { id: AuthorWorkspaceLens; label: string }[] = [
  { id: "creative", label: "Creative" },
  { id: "business", label: "Business" },
];

/**
 * Segmented Creative / Business lens control — drives `data-author-lens` theming on the app shell.
 */
export function BusinessCreativeToggle() {
  const { lens, setLens } = useAuthorWorkspaceLens();

  return (
    <div
      className="inline-flex rounded-full border border-zinc-700/80 bg-zinc-900/80 p-0.5"
      role="group"
      aria-label="Workspace lens"
    >
      {OPTIONS.map((opt) => {
        const active = lens === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={active}
            onClick={() => setLens(opt.id)}
            className={[
              "rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition",
              active && opt.id === "creative"
                ? "bg-violet-600/90 text-violet-50 shadow-[0_0_12px_-2px_rgba(139,92,246,0.55)]"
                : "",
              active && opt.id === "business"
                ? "bg-amber-600/90 text-amber-50 shadow-[0_0_12px_-2px_rgba(245,158,11,0.5)]"
                : "",
              !active ? "text-zinc-500 hover:text-zinc-300" : "",
            ].join(" ")}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
