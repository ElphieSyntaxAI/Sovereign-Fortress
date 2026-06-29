import type { StoryScope } from "../../lib/worldBuildTypes";

const OPTIONS: { id: StoryScope; label: string; description: string }[] = [
  {
    id: "local",
    label: "Local",
    description: "One town, city, or station",
  },
  {
    id: "global",
    label: "Global",
    description: "A world or solar system",
  },
  {
    id: "universe",
    label: "Universe",
    description: "Multiple galaxies or universes",
  },
];

export function StoryScopeGuardrail(props: {
  value: StoryScope | null;
  onChange: (scope: StoryScope) => void;
}) {
  return (
    <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 p-4">
      <h2 className="mb-1 text-sm font-semibold text-emerald-100">
        Where does your story take place?
      </h2>
      <p className="mb-3 text-[11px] text-zinc-500">
        This shapes your location tree. You can change it later — hidden locations are kept safe.
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        {OPTIONS.map((opt) => {
          const selected = props.value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => props.onChange(opt.id)}
              className={[
                "rounded-lg border px-3 py-2 text-left transition",
                selected
                  ? "border-emerald-500/60 bg-emerald-900/40 text-emerald-50"
                  : "border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-600",
              ].join(" ")}
            >
              <span className="block text-xs font-medium">{opt.label}</span>
              <span className="mt-0.5 block text-[10px] opacity-80">{opt.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
