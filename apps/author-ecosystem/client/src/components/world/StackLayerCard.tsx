import {
  BlockInputModeToggle,
  FreestyleBlockForm,
  OutlineRagPanel,
} from "../planningBlockUi";
import {
  CIVILIZATION_STACK_LAYER_META,
  getStackLayerSchema,
} from "../../lib/civilizationStackSchema";
import type { RagOutlinePanelSchema } from "../../lib/plotEngineRagOutlineSchema";
import { buildStackEntryRagLine } from "../../lib/worldStackRag";
import type { CivilizationStackLayer, StackEntry } from "../../lib/worldBuildTypes";

export function StackLayerCard(props: {
  layer: CivilizationStackLayer;
  entries: StackEntry[];
  selectedId: string | null;
  parentTitle: string;
  manuscriptId: string;
  schemaOverride?: RagOutlinePanelSchema;
  onAdd: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onPatch: (id: string, patch: Partial<StackEntry>) => void;
  onFieldChange: (id: string, key: string, value: string) => void;
  onModeChange: (id: string, mode: "freestyle" | "outline") => void;
}) {
  const meta = CIVILIZATION_STACK_LAYER_META[props.layer];
  const schema = props.schemaOverride ?? getStackLayerSchema(props.layer);

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
      <div className="mb-2">
        <h3 className="text-xs font-semibold text-zinc-100">
          <span className="mr-1" aria-hidden>
            {meta.emoji}
          </span>
          {meta.title}
        </h3>
        {meta.hint ? <p className="mt-0.5 text-[10px] text-zinc-500">{meta.hint}</p> : null}
      </div>

      {props.entries.length > 0 ? (
        <ul className="mb-2 space-y-2">
          {props.entries.map((entry, index) => {
            const expanded = props.selectedId === entry.id;
            const preview = buildStackEntryRagLine(entry, schema, props.parentTitle);
            return (
              <li
                key={entry.id}
                className="rounded-lg border border-zinc-800 bg-zinc-950/80"
              >
                <div className="flex items-center gap-1 border-b border-zinc-800/80 px-2 py-0.5">
                  <span className="text-[9px] tabular-nums text-zinc-600">{index + 1}</span>
                </div>
                <button
                  type="button"
                  onClick={() => props.onSelect(entry.id)}
                  className="flex w-full items-center justify-between px-2 py-1.5 text-left text-xs text-zinc-300"
                >
                  <span className="truncate">{entry.title}</span>
                  <span className="text-[10px] text-zinc-600">{expanded ? "▾" : "▸"}</span>
                </button>
                {expanded ? (
                  <div className="space-y-2 border-t border-zinc-800 p-2">
                    <input
                      value={entry.title}
                      onChange={(e) => props.onPatch(entry.id, { title: e.target.value })}
                      className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
                    />
                    <BlockInputModeToggle
                      mode={entry.blockInputMode ?? "outline"}
                      onChange={(m) => props.onModeChange(entry.id, m)}
                      accent="emerald"
                    />
                    {(entry.blockInputMode ?? "outline") === "outline" ? (
                      <OutlineRagPanel
                        schema={schema}
                        fields={entry.outlineFields ?? {}}
                        accent="emerald"
                        manuscriptId={props.manuscriptId}
                        onFieldChange={(key, value) =>
                          props.onFieldChange(entry.id, key, value)
                        }
                      />
                    ) : (
                      <FreestyleBlockForm
                        title={entry.title}
                        details={entry.freestyleDetails ?? ""}
                        containsSpoiler={Boolean(entry.containsSpoiler)}
                        titlePlaceholder="Entry name"
                        detailsPlaceholder="Lore for this layer…"
                        onTitleChange={(title) => props.onPatch(entry.id, { title })}
                        onDetailsChange={(freestyleDetails) =>
                          props.onPatch(entry.id, { freestyleDetails })
                        }
                        onSpoilerChange={(containsSpoiler) =>
                          props.onPatch(entry.id, { containsSpoiler })
                        }
                      />
                    )}
                    {preview ? (
                      <p className="font-mono text-[9px] leading-snug text-zinc-600">{preview}</p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => props.onDelete(entry.id)}
                      className="text-[10px] text-rose-400"
                    >
                      Delete entry
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mb-2 text-[10px] italic text-zinc-600">Nothing here yet.</p>
      )}

      <button
        type="button"
        onClick={props.onAdd}
        className="w-full rounded border border-dashed border-emerald-600/40 bg-emerald-950/20 py-1.5 text-[10px] text-emerald-200 hover:border-emerald-500/50 hover:bg-emerald-950/35"
      >
        {props.entries.length > 0 ? "+ Add another entry" : "+ Add entry"}
      </button>
    </section>
  );
}
