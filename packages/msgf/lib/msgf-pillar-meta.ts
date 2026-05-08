/** Hierarchical lineage labels aligned with P6 DEFEND / constraint ledger 1.1.1. */
export function pillarGateMeta(pillar: "P6") {
  if (pillar === "P6") {
    return {
      pillar: "P6" as const,
      lineageLabel: "MSGF_V3_STRICT.constraint_ledger.1.1.1",
      violationCode: "P6_DEFEND_LOM_VIOLATION",
    };
  }
  throw new Error(`pillarGateMeta: unsupported pillar ${String(pillar)}`);
}
