import { useMemo, useState } from "react";
import {
  DEFAULT_BRAIN_PUSH_QUEUE,
  loadBrainPushStatuses,
  saveBrainPushStatus,
  type BrainPushItem,
  type BrainPushStatus,
} from "../data/brainQueue";

export function BrainPushQueue() {
  const [statuses, setStatuses] = useState(() => loadBrainPushStatuses());

  const pending = useMemo(() => {
    return DEFAULT_BRAIN_PUSH_QUEUE.filter(
      (item) => (statuses[item.id] ?? "pending") === "pending"
    );
  }, [statuses]);

  function setStatus(id: string, s: BrainPushStatus) {
    saveBrainPushStatus(id, s);
    setStatuses(loadBrainPushStatuses());
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Brain push queue</h2>
          <p className="text-xs text-zinc-500">
            Proposed <code className="text-zinc-400">packages/core</code> changes from
            satellite branches — approve before merge.
          </p>
        </div>
      </div>

      {pending.length === 0 ? (
        <p className="text-sm text-zinc-500">No pending pushes.</p>
      ) : (
        <ul className="space-y-3">
          {pending.map((item) => (
            <BrainPushRow key={item.id} item={item} onDecide={setStatus} />
          ))}
        </ul>
      )}
    </section>
  );
}

function BrainPushRow({
  item,
  onDecide,
}: {
  item: BrainPushItem;
  onDecide: (id: string, s: BrainPushStatus) => void;
}) {
  return (
    <li className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-mono text-xs text-amber-200/90">{item.branch}</div>
          <div className="text-sm font-medium text-zinc-100">{item.title}</div>
          <ul className="mt-1 list-inside list-disc text-xs text-zinc-500">
            {item.corePaths.map((p) => (
              <li key={p} className="font-mono">
                {p}
              </li>
            ))}
          </ul>
          <div className="mt-1 text-[10px] uppercase tracking-wide text-zinc-600">
            from {item.openedBy} · {new Date(item.openedAt).toLocaleString()}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            className="rounded-md border border-emerald-800/80 bg-emerald-950/50 px-2 py-1 text-xs font-medium text-emerald-200 hover:bg-emerald-900/50"
            onClick={() => onDecide(item.id, "approved")}
          >
            Approve
          </button>
          <button
            type="button"
            className="rounded-md border border-red-900/80 bg-red-950/40 px-2 py-1 text-xs font-medium text-red-200 hover:bg-red-900/40"
            onClick={() => onDecide(item.id, "rejected")}
          >
            Reject
          </button>
        </div>
      </div>
    </li>
  );
}
