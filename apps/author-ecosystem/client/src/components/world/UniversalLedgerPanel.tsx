import { useState } from "react";

import { OutlineRagPanel } from "../planningBlockUi";
import { UNIVERSAL_LEDGER_SCHEMA } from "../../lib/civilizationStackSchema";
import type { StoryScope } from "../../lib/worldBuildTypes";

export function UniversalLedgerPanel(props: {
  storyScope: StoryScope;
  fields: Record<string, string>;
  onFieldChange: (key: string, value: string) => void;
}) {
  const [open, setOpen] = useState(props.storyScope !== "local");
  const title =
    props.storyScope === "local" ? "World assumptions" : "Universal constants";

  return (
    <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-950/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <span className="text-xs font-medium text-zinc-200">{title}</span>
        <span className="text-[10px] text-zinc-500">{open ? "▾" : "▸"}</span>
      </button>
      {open ? (
        <div className="border-t border-zinc-800 px-2 pb-2">
          <p className="py-2 text-[10px] italic text-zinc-500">
            {props.storyScope === "local"
              ? "Optional — physics and magic assumed for this local story."
              : "Immutable laws — physics, magic, and universal rules."}
          </p>
          <OutlineRagPanel
            schema={UNIVERSAL_LEDGER_SCHEMA}
            fields={props.fields}
            accent="emerald"
            onFieldChange={props.onFieldChange}
          />
        </div>
      ) : null}
    </div>
  );
}
