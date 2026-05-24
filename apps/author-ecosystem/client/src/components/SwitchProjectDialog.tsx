import type { HubManuscript } from "../lib/manuscriptTypes";
import { displayTitle } from "../lib/manuscriptTypes";

export function SwitchProjectDialog(props: {
  open: boolean;
  target: HubManuscript | null;
  currentTitle: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!props.open || !props.target) return null;

  const nextLabel = displayTitle(props.target);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="switch-project-title"
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-950 p-5 shadow-2xl">
        <h2 id="switch-project-title" className="text-lg font-semibold text-zinc-100">
          Switch active project?
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          Confirm change to <span className="font-medium text-zinc-200">{nextLabel}</span>. Wiki,
          HAL, drafting, and row-level security will scope to this manuscript
          {props.currentTitle ? (
            <>
              {" "}
              instead of <span className="text-zinc-300">{props.currentTitle}</span>
            </>
          ) : null}
          .
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={props.onCancel}
            className="rounded-full border border-zinc-700 px-4 py-2 text-xs text-zinc-300 hover:bg-zinc-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={props.onConfirm}
            className="rounded-full border border-violet-500/60 bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500"
          >
            Switch to project
          </button>
        </div>
      </div>
    </div>
  );
}
