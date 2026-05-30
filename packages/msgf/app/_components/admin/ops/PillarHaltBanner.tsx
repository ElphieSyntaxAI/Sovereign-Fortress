/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-48a02b8-20260530T050749Z-internal
 */
import {
  haltPillarLabel,
  P2_PIPELINE,
  resolveHaltPillar,
  type GenealogicalBugIndex,
  type P2Pillar,
} from "@/lib/admin-decision-portal";

type Props = {
  bugIndex: GenealogicalBugIndex;
};

function pillarChip(pillar: P2Pillar, haltPillar: P2Pillar) {
  const isHalt = pillar === haltPillar;
  const passed =
    P2_PIPELINE.indexOf(pillar) < P2_PIPELINE.indexOf(haltPillar);

  return (
    <span
      key={pillar}
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wide ${
        isHalt
          ? "bg-amber-950/80 text-amber-200 ring-1 ring-amber-700/60"
          : passed
            ? "bg-zinc-800/80 text-zinc-500"
            : "bg-zinc-900 text-zinc-600"
      }`}
      title={isHalt ? "Halt originated here" : passed ? "Completed" : "Not reached"}
    >
      {pillar}
    </span>
  );
}

export function PillarHaltBanner({ bugIndex }: Props) {
  const haltPillar = resolveHaltPillar(bugIndex);

  return (
    <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-amber-400/90">
        Pillar tie-in — halt origin
      </p>
      <p className="mt-1 text-sm font-semibold text-amber-100">{haltPillarLabel(bugIndex)}</p>
      <p className="mt-2 text-[11px] leading-relaxed text-amber-200/70">
        Pipeline stopped at{" "}
        <span className="font-mono text-amber-100">{haltPillar}</span> before PERSIST could
        complete. Remediation must respect the P2 Roadmap from this gate forward.
      </p>
      <div className="mt-3 flex flex-wrap gap-1">
        {P2_PIPELINE.map((p) => pillarChip(p, haltPillar))}
      </div>
    </div>
  );
}
