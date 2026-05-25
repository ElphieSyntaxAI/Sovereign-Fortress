import type { ClarifyingQuestion, IngestConflict, ContentSignal } from "../../lib/onboardingApi";

export function DocumentClarificationStep(props: {
  conflicts: IngestConflict[];
  signals: ContentSignal[];
  questions: ClarifyingQuestion[];
  answers: string[];
  notes: string;
  onAnswer: (index: number, value: string) => void;
  onNotes: (value: string) => void;
  onSubmit: () => void;
  busy: boolean;
}) {
  const blocking = props.conflicts.filter((c) => c.severity === "blocking");
  const warnings = props.conflicts.filter((c) => c.severity === "warning");

  return (
    <div className="mt-3 space-y-4 rounded-lg border border-amber-700/40 bg-amber-950/20 p-4">
      <div>
        <h4 className="text-sm font-semibold text-amber-100">Story context check</h4>
        <p className="mt-1 text-xs text-zinc-400">
          We read what is in the file — scene cards, outlines, character sheets, notes, chapters — not the
          filename. Help us avoid mixing two books or overwriting the wrong draft.
        </p>
      </div>

      {props.signals.length > 0 ? (
        <p className="text-[11px] text-violet-300/90">
          Detected: {props.signals.map((s) => s.kind.replace(/_/g, " ")).join(", ")}
        </p>
      ) : null}

      {blocking.length > 0 ? (
        <ul className="space-y-1 text-xs text-amber-200/90">
          {blocking.map((c) => (
            <li key={c.code}>• {c.message}</li>
          ))}
        </ul>
      ) : null}
      {warnings.length > 0 ? (
        <ul className="space-y-1 text-xs text-zinc-500">
          {warnings.map((c) => (
            <li key={c.code}>⚠ {c.message}</li>
          ))}
        </ul>
      ) : null}

      {props.questions.map((q, i) => (
        <label key={q.id} className="block text-xs text-zinc-300">
          {q.required ? <span className="text-amber-300">* </span> : null}
          {q.question}
          {q.options && q.options.length > 0 ? (
            <select
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
              value={props.answers[i] ?? ""}
              onChange={(e) => props.onAnswer(i, e.target.value)}
            >
              <option value="">Choose…</option>
              {q.options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : (
            <textarea
              className="mt-1 min-h-[60px] w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
              value={props.answers[i] ?? ""}
              onChange={(e) => props.onAnswer(i, e.target.value)}
              placeholder={q.hint}
            />
          )}
        </label>
      ))}

      <label className="block text-xs text-zinc-400">
        Extra context (old draft, co-author section, what to ignore)
        <textarea
          className="mt-1 min-h-[50px] w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
          value={props.notes}
          onChange={(e) => props.onNotes(e.target.value)}
        />
      </label>

      <button
        type="button"
        disabled={props.busy}
        onClick={props.onSubmit}
        className="rounded-lg bg-amber-600/90 px-3 py-1.5 text-xs font-semibold text-amber-950"
      >
        Continue import
      </button>
    </div>
  );
}
