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
 * Distribution Build ID: MSGF-191e80fa-20260921T055901Z-internal
 */
import { IDE_WORKFLOW_STEPS } from "./shipped-capabilities";

export function WorkflowStrip() {
  return (
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {IDE_WORKFLOW_STEPS.map((step, index) => (
        <li
          key={step.step}
          className="relative rounded-2xl border border-slate-700/50 bg-slate-950/50 p-4"
        >
          {index < IDE_WORKFLOW_STEPS.length - 1 ? (
            <span
              className="pointer-events-none absolute -right-2 top-1/2 hidden h-px w-4 -translate-y-1/2 bg-gradient-to-r from-emerald-500/40 to-transparent lg:block"
              aria-hidden
            />
          ) : null}
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400/90">
            {step.step}
          </p>
          <p className="mt-2 font-semibold text-slate-100">{step.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">{step.body}</p>
        </li>
      ))}
    </ol>
  );
}
