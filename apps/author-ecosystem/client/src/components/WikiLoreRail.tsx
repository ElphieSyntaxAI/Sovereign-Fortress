import {
  OUTLINE_LORE_KINDS,
  type OutlineLoreKind,
  type OutlineLoreKindConfig,
} from "../lib/outlineLoreKinds";
import { useWikiDrafts } from "../context/WikiDraftContext";

const RAIL_BUTTON_CLASS =
  "rounded-lg border px-2 py-2 text-[10px] font-semibold leading-tight transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500";

function railButtonClass(active: boolean): string {
  return [
    RAIL_BUTTON_CLASS,
    active
      ? "border-violet-500/70 bg-violet-950/60 text-violet-100"
      : "border-zinc-700/80 bg-zinc-900/90 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100",
  ].join(" ");
}

function WikiLoreRailButton(props: {
  item: OutlineLoreKindConfig;
  active: boolean;
  hasDraft: boolean;
  showSideTooltip: boolean;
  onClick: () => void;
}) {
  const { item, active, hasDraft, showSideTooltip, onClick } = props;
  return (
    <button
      type="button"
      title={item.railHoverTip}
      aria-label={`Add ${item.label.toLowerCase()}: ${item.railHoverTip}`}
      onClick={onClick}
      className={[railButtonClass(active), showSideTooltip ? "group relative" : ""].join(" ")}
    >
      {item.railLabel}
      {hasDraft ? <span className="mt-0.5 block text-[8px] text-amber-300/90">draft</span> : null}
      {showSideTooltip ? (
        <span
          role="tooltip"
          className="pointer-events-none absolute right-full top-1/2 z-50 mr-2 hidden w-48 -translate-y-1/2 rounded-lg border border-zinc-600 bg-zinc-900 px-2.5 py-2 text-left text-[11px] font-normal leading-snug text-zinc-100 opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 lg:block"
        >
          {item.railHoverTip}
        </span>
      ) : null}
    </button>
  );
}

export function WikiLoreRail(props: {
  openKind: OutlineLoreKind | null;
  onOpenKind: (kind: OutlineLoreKind) => void;
}) {
  const { drafts } = useWikiDrafts();

  return (
    <>
      <nav
        className="pointer-events-none fixed right-3 top-1/2 z-40 hidden -translate-y-1/2 lg:block"
        aria-label="Add wiki lore"
      >
        <div className="pointer-events-auto flex flex-col gap-1.5 rounded-xl border border-zinc-800/90 bg-zinc-950/95 p-2 shadow-xl backdrop-blur-sm">
          <p className="px-1 pb-1 text-center text-[9px] font-semibold uppercase tracking-wider text-violet-300/80">
            Wiki edit
          </p>
          {OUTLINE_LORE_KINDS.map((item) => (
            <WikiLoreRailButton
              key={item.kind}
              item={item}
              active={props.openKind === item.kind}
              hasDraft={drafts.some((d) => d.kind === item.kind)}
              showSideTooltip
              onClick={() => props.onOpenKind(item.kind)}
            />
          ))}
        </div>
      </nav>

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-violet-900/40 bg-zinc-950/95 px-2 py-2 backdrop-blur-sm lg:hidden"
        aria-label="Add wiki lore"
      >
        <p className="mb-1 text-center text-[9px] font-semibold uppercase tracking-wider text-violet-300/80">
          Wiki edit · long-press a button for a hint
        </p>
        <div className="flex gap-1.5 overflow-x-auto pb-[env(safe-area-inset-bottom)]">
          {OUTLINE_LORE_KINDS.map((item) => (
            <WikiLoreRailButton
              key={item.kind}
              item={item}
              active={props.openKind === item.kind}
              hasDraft={false}
              showSideTooltip={false}
              onClick={() => props.onOpenKind(item.kind)}
            />
          ))}
        </div>
      </nav>
    </>
  );
}
