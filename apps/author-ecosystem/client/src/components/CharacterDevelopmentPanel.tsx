import { useCallback, useEffect, useState } from "react";

import {
  BlockInputModeToggle,
  AuthorTagInput,
  FreestyleBlockForm,
  OutlineRagPanel,
} from "./planningBlockUi";
import { WikiEntityPicker } from "./wiki/WikiEntityPicker";
import { CHARACTER_DEV_SCHEMA } from "../lib/planningBlockSchema";
import {
  importCharactersFromWiki,
  pushCharacterToWiki,
  upsertCharacterToPlotPool,
} from "../lib/planningBlockSync";
import {
  loadCharacterDevState,
  saveCharacterDevState,
} from "../lib/planningBlockStorage";
import {
  createPlanningBlockEntity,
  defaultCharacterDevState,
  formatWikiRef,
  type BlockInputMode,
  type CharacterDevState,
  type PlanningBlockEntity,
} from "../lib/planningBlockTypes";

export type CharacterDevelopmentPanelProps = {
  manuscriptId: string;
};

export function CharacterDevelopmentPanel({ manuscriptId }: CharacterDevelopmentPanelProps) {
  const [state, setState] = useState<CharacterDevState>(() =>
    manuscriptId
      ? loadCharacterDevState(manuscriptId) ?? defaultCharacterDevState()
      : defaultCharacterDevState()
  );
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const persist = useCallback(
    (next: CharacterDevState) => {
      setState(next);
      if (manuscriptId) saveCharacterDevState(manuscriptId, next);
    },
    [manuscriptId]
  );

  useEffect(() => {
    if (!manuscriptId) return;
    const loaded = loadCharacterDevState(manuscriptId) ?? defaultCharacterDevState();
    setState(loaded);
  }, [manuscriptId]);

  const selected = state.characters.find((c) => c.id === state.selectionId);

  const patchSelected = (patch: Partial<PlanningBlockEntity>) => {
    if (!selected) return;
    persist({
      ...state,
      characters: state.characters.map((c) =>
        c.id === selected.id ? { ...c, ...patch } : c
      ),
    });
  };

  const addCharacter = () => {
    const entity = createPlanningBlockEntity("New character");
    persist({
      ...state,
      characters: [...state.characters, entity],
      selectionId: entity.id,
    });
  };

  const deleteCharacter = (id: string) => {
    persist({
      ...state,
      characters: state.characters.filter((c) => c.id !== id),
      selectionId: state.selectionId === id ? null : state.selectionId,
    });
  };

  const setMode = (mode: BlockInputMode) => {
    if (!selected) return;
    const patch: Partial<PlanningBlockEntity> = { blockInputMode: mode };
    if (mode === "outline" && !selected.outlineFields) {
      patch.outlineFields = {
        role: selected.title,
        ...(selected.freestyleDetails ? { visual_master: selected.freestyleDetails } : {}),
      };
    }
    patchSelected(patch);
  };

  const refreshFromWiki = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const n = await importCharactersFromWiki(manuscriptId);
      const loaded = loadCharacterDevState(manuscriptId) ?? state;
      setState(loaded);
      setStatus(n ? `Imported ${n} character(s) from wiki.` : "No new character wiki entries found.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const saveToWiki = async () => {
    if (!selected) return;
    setBusy(true);
    setStatus(null);
    try {
      const ref = await pushCharacterToWiki(manuscriptId, selected);
      patchSelected({ wikiRef: ref });
      setStatus(`Saved "${selected.title}" to wiki.`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const addToPlotPools = () => {
    if (!selected) return;
    upsertCharacterToPlotPool(manuscriptId, selected);
    setStatus(`"${selected.title}" added to plot engine character pool.`);
  };

  return (
    <div className="flex min-h-[28rem] flex-col overflow-hidden rounded-xl border border-zinc-800 bg-[#0a0612] lg:flex-row">
      <aside className="w-full shrink-0 border-b border-zinc-800 p-3 lg:w-1/3 lg:border-b-0 lg:border-r">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-violet-100">Characters</h2>
          <button
            type="button"
            onClick={addCharacter}
            className="rounded border border-emerald-600/50 px-2 py-0.5 text-[10px] text-emerald-200"
          >
            + Add
          </button>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void refreshFromWiki()}
          className="mb-3 w-full rounded border border-zinc-700 py-1 text-[10px] text-zinc-400 hover:text-zinc-200"
        >
          Refresh from wiki
        </button>
        <ul className="space-y-1">
          {state.characters.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => persist({ ...state, selectionId: c.id })}
                className={[
                  "flex w-full items-center justify-between rounded-lg border px-2 py-1.5 text-left text-xs transition",
                  state.selectionId === c.id
                    ? "border-violet-500/50 bg-violet-950/40 text-violet-100"
                    : "border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-600",
                ].join(" ")}
              >
                <span className="truncate">{c.title}</span>
                {c.wikiRef ? (
                  <span className="ml-1 shrink-0 text-[9px] text-emerald-400/80">wiki</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
        {state.characters.length === 0 ? (
          <p className="mt-4 text-xs italic text-zinc-600">Add a character or refresh from wiki.</p>
        ) : null}
      </aside>

      <main className="min-w-0 flex-1 p-4">
        {status ? <p className="mb-3 text-xs text-zinc-400">{status}</p> : null}
        {selected ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={selected.title}
                onChange={(e) => patchSelected({ title: e.target.value })}
                className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
              />
              <button
                type="button"
                onClick={() => deleteCharacter(selected.id)}
                className="text-xs text-rose-400"
              >
                Delete
              </button>
            </div>

            <WikiEntityPicker
              manuscriptId={manuscriptId}
              kindFilter="character"
              value={selected.wikiRef ? formatWikiRef(selected.wikiRef) : ""}
              onChange={(_v, ref) => patchSelected({ wikiRef: ref })}
              label="Link to wiki character"
            />

            <AuthorTagInput
              tags={selected.authorTags ?? []}
              onChange={(authorTags) => patchSelected({ authorTags })}
            />

            <BlockInputModeToggle
              mode={selected.blockInputMode ?? "freestyle"}
              onChange={setMode}
            />

            {(selected.blockInputMode ?? "freestyle") === "outline" ? (
              <OutlineRagPanel
                schema={CHARACTER_DEV_SCHEMA}
                fields={selected.outlineFields ?? {}}
                accent="violet"
                manuscriptId={manuscriptId}
                onFieldChange={(key, value) => {
                  const next = { ...(selected.outlineFields ?? {}), [key]: value };
                  if (!value.trim() && key !== "containsSpoiler") delete next[key];
                  patchSelected({ outlineFields: next });
                }}
              />
            ) : (
              <FreestyleBlockForm
                title={selected.title}
                details={selected.freestyleDetails ?? ""}
                containsSpoiler={Boolean(selected.containsSpoiler)}
                titlePlaceholder="Character name"
                detailsPlaceholder="Appearance, motivation, secrets, relationships…"
                onTitleChange={(title) => patchSelected({ title })}
                onDetailsChange={(freestyleDetails) => patchSelected({ freestyleDetails })}
                onSpoilerChange={(containsSpoiler) => patchSelected({ containsSpoiler })}
              />
            )}

            <div className="flex flex-wrap gap-2 border-t border-zinc-800 pt-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveToWiki()}
                className="rounded border border-violet-500/50 bg-violet-900/40 px-3 py-1 text-xs text-violet-100"
              >
                Save to wiki
              </button>
              <button
                type="button"
                onClick={addToPlotPools}
                className="rounded border border-emerald-600/50 px-3 py-1 text-xs text-emerald-200"
              >
                Add to plot pools
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs italic text-zinc-500">Select or add a character to develop.</p>
        )}
      </main>
    </div>
  );
}
