import type { ConsequenceProfile, RiskLevel } from "../lib/decision-portal";

const RISK_STYLES: Record<RiskLevel, string> = {
  Low: "text-emerald-400 border-emerald-800/50 bg-emerald-950/40",
  Medium: "text-amber-300 border-amber-800/50 bg-amber-950/40",
  High: "text-red-300 border-red-800/50 bg-red-950/40",
};

function ConsequenceRow({ label, level }: { label: string; level: RiskLevel }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="text-zinc-500">{label}</span>
      <span
        className={`rounded border px-2 py-0.5 font-semibold ${RISK_STYLES[level]}`}
      >
        {level}
      </span>
    </div>
  );
}

type Props = {
  consequences: ConsequenceProfile;
  compact?: boolean;
};

export function ConsequenceVisualizer({ consequences, compact }: Props) {
  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5">
        <span
          className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${RISK_STYLES[consequences.integrityRisk]}`}
        >
          Integrity: {consequences.integrityRisk}
        </span>
        <span
          className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${RISK_STYLES[consequences.userFriction]}`}
        >
          Friction: {consequences.userFriction}
        </span>
        <span
          className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${RISK_STYLES[consequences.vaultDrift]}`}
        >
          Vault drift: {consequences.vaultDrift}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 rounded-md border border-zinc-800/80 bg-zinc-950/60 px-2.5 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        Consequence profile
      </p>
      <ConsequenceRow label="Integrity risk" level={consequences.integrityRisk} />
      <ConsequenceRow label="User friction" level={consequences.userFriction} />
      <ConsequenceRow label="Vault drift" level={consequences.vaultDrift} />
      <div className="flex items-center justify-between border-t border-zinc-800/80 pt-1.5 text-[11px]">
        <span className="text-zinc-500">Composite score</span>
        <span className="font-mono text-zinc-300">{consequences.compositeScore}</span>
      </div>
    </div>
  );
}
