export type PillarId = "P1" | "P2" | "P3" | "P4" | "P5" | "P6";

/**
 * Resolve MSGF constraint-ledger style labels (e.g. `...1.1.1`) or explicit `P1`…`P6` tokens.
 * Mapping follows genealogical index → pillar used across MSGF cold-layer metadata.
 */
export function pillarFromLineageLabel(lineageLabel: string): PillarId | null {
  const s = lineageLabel.trim();
  const explicit = s.match(/\bP([1-6])\b/i);
  if (explicit) {
    const n = explicit[1] as "1" | "2" | "3" | "4" | "5" | "6";
    return (`P${n}`) as PillarId;
  }

  const triple = s.match(/(?:^|\.)(\d+)\.(\d+)\.(\d+)(?:\s*$|(?=[^\d.]))/);
  if (!triple) return null;

  const a = Number(triple[1]);
  const b = Number(triple[2]);
  const c = Number(triple[3]);
  const key = `${a}.${b}.${c}`;

  const map: Record<string, PillarId> = {
    "1.0.0": "P1",
    "1.0.1": "P2",
    "1.0.2": "P3",
    "1.1.0": "P4",
    "1.1.1": "P6",
    "1.1.2": "P5",
  };

  return map[key] ?? null;
}
