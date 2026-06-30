import { CivilizationStack } from "./CivilizationStack";
import { FOCUS_CULTURAL_LAYERS } from "../../lib/worldBuildTypes";
import type { CivilizationStackLayer, LocationNode, StackEntry } from "../../lib/worldBuildTypes";

export function EntityFocusPanel(props: {
  location: LocationNode;
  breadcrumb: string;
  entries: StackEntry[];
  selectedId: string | null;
  manuscriptId: string;
  busy: boolean;
  onClose: () => void;
  onAddEntry: (layer: CivilizationStackLayer) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onPatch: (id: string, patch: Partial<StackEntry>) => void;
  onFieldChange: (id: string, key: string, value: string) => void;
  onModeChange: (id: string, mode: "freestyle" | "outline") => void;
  onSaveToWiki: () => void;
  onAddToPlotPool: () => void;
}) {
  const selectedEntry = props.entries.find((e) => e.id === props.selectedId) ?? null;

  return (
    <>
      {/* Mobile slide-over backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        aria-hidden
        onClick={props.onClose}
      />
      <aside
        className={[
          "z-50 flex flex-col border-zinc-800 bg-[#0a0612]",
          "fixed inset-y-0 right-0 w-[min(100%,24rem)] shadow-2xl lg:static lg:z-auto lg:w-auto lg:shadow-none",
          "border-l lg:min-h-[24rem] lg:flex-1 lg:max-w-[42%]",
        ].join(" ")}
      >
        <header className="flex items-start justify-between gap-2 border-b border-zinc-800 p-3">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-400/80">
              Focus context
            </p>
            <h2 className="truncate text-sm font-semibold text-emerald-100">{props.location.title}</h2>
            {props.breadcrumb ? (
              <p className="mt-0.5 text-[10px] text-zinc-500">{props.breadcrumb}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="shrink-0 rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400 hover:text-zinc-200"
          >
            Close
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-3">
          <CivilizationStack
            locationTitle={props.location.title}
            entries={props.entries}
            selectedId={props.selectedId}
            manuscriptId={props.manuscriptId}
            layers={FOCUS_CULTURAL_LAYERS}
            heading="Cultural & society stack"
            hint="History, government, science, religion, culture, and food for this place. Hierarchy path is stamped into tags on create."
            onAddEntry={props.onAddEntry}
            onSelect={props.onSelect}
            onDelete={props.onDelete}
            onPatch={props.onPatch}
            onFieldChange={props.onFieldChange}
            onModeChange={props.onModeChange}
          />
        </div>

        <footer className="flex flex-wrap gap-2 border-t border-zinc-800 p-3">
          <button
            type="button"
            disabled={props.busy || !selectedEntry}
            onClick={props.onSaveToWiki}
            className="rounded border border-emerald-600/50 bg-emerald-950/40 px-3 py-1 text-xs text-emerald-100 disabled:opacity-40"
          >
            Save selected to wiki
          </button>
          <button
            type="button"
            disabled={!selectedEntry}
            onClick={props.onAddToPlotPool}
            className="rounded border border-violet-600/50 px-3 py-1 text-xs text-violet-200 disabled:opacity-40"
          >
            Add selected to plot pools
          </button>
        </footer>
      </aside>
    </>
  );
}
