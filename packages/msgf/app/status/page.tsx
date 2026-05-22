/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 */
import Link from "next/link";

import { getSystemConnectionStatus } from "@msgf/lib/system-connection-status";

import { LandingNav } from "@/app/_components/landing/LandingNav";
import { evaluateV32RuntimeStatus } from "@/lib/v32-ultra-directive";

function StatusRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="glass-panel flex flex-col gap-1 rounded-xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-500"}`}
          aria-hidden
        />
        <span className="font-medium text-slate-100">{label}</span>
      </div>
      <p className="text-sm text-slate-400 sm:max-w-md sm:text-right">{detail}</p>
    </div>
  );
}

function V32StepRow({
  status,
  step,
  detail,
}: {
  status: "ok" | "degraded" | "missing";
  step: string;
  detail: string;
}) {
  const ok = status === "ok";
  return (
    <div className="glass-panel flex flex-col gap-1 rounded-xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
            ok ? "bg-emerald-500" : status === "degraded" ? "bg-amber-500" : "bg-rose-500"
          }`}
          aria-hidden
        />
        <span className="font-mono text-sm font-medium text-violet-200">{step}</span>
      </div>
      <p className="text-sm text-slate-400 sm:max-w-lg sm:text-right">{detail}</p>
    </div>
  );
}

export default async function StatusPage() {
  const { gcp, anthropic, stripe } = getSystemConnectionStatus();
  const v32 = await evaluateV32RuntimeStatus();

  return (
    <div className="landing-mesh min-h-screen text-slate-100">
      <LandingNav />
      <main className="mx-auto max-w-xl space-y-8 px-5 py-10">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">System status</h1>
          <p className="text-sm text-slate-400">
            Integration env checks plus live V3.2-ULTRA directive readiness (Redis SHARD, ops
            heartbeat, HITL).
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-300/90">
            V3.2-ULTRA checklist
          </h2>
          {v32.steps.map((s) => (
            <V32StepRow key={s.step} status={s.status} step={s.step} detail={s.detail} />
          ))}
          <p className="text-xs text-slate-500">
            Evaluated {new Date(v32.evaluated_at).toLocaleString()}. Load balancers should use{" "}
            <Link href="/health" className="text-cyan-300 hover:underline">
              GET /health
            </Link>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Integrations (env)
          </h2>
          <StatusRow {...gcp} />
          <StatusRow {...anthropic} />
          <StatusRow {...stripe} />
        </section>

        <p className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-400">
          <Link href="/workspace" className="text-cyan-300 underline-offset-4 hover:underline">
            Workspace setup
          </Link>
          <Link href="/dashboard" className="text-violet-300 underline-offset-4 hover:underline">
            Governance dashboard
          </Link>
          <Link href="/" className="text-slate-300 underline-offset-4 hover:underline">
            Home
          </Link>
        </p>
      </main>
    </div>
  );
}
