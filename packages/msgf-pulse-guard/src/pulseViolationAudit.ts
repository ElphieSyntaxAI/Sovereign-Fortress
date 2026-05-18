/**
 * Audits POST /api/msgf/pulse JSON for Wrong Logic / Hall / constraint violations.
 */

export type ViolationDiagnostic = {
  line?: string;
  path?: string;
  ruleIndex: string;
  summary: string;
};

export type WrongLogicViolation = {
  errorMessage: string;
  traceId?: string;
  diagnostics: ViolationDiagnostic[];
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function readGlass(raw: Record<string, unknown>): Record<string, unknown> | null {
  return asRecord(raw.data);
}

function readPillarStatus(glass: Record<string, unknown> | null): Record<string, unknown> | null {
  return glass ? asRecord(glass.pillarStatus) : null;
}

function collectHallLogEntries(raw: Record<string, unknown>, glass: Record<string, unknown> | null): unknown[] {
  const candidates = [
    raw.hall_log,
    raw.constraint_ledger,
    raw.p6_constraint_ledger,
    glass?.constraintLedger,
    glass?.hallLog,
    asRecord(raw.data)?.hallLog,
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) return c;
  }
  return [];
}

function diagnosticFromHallEntry(entry: unknown, index: number): ViolationDiagnostic | null {
  const row = asRecord(entry);
  if (!row) return null;

  const bugIndex = asRecord(row.bug_index) ?? asRecord(row.bugIndex);
  const ruleIndex =
    typeof bugIndex?.level_1_1_1_instance === "string"
      ? bugIndex.level_1_1_1_instance
      : typeof row.rule_index === "string"
        ? row.rule_index
        : "1.1.1";

  const summary =
    typeof row.reason === "string"
      ? row.reason
      : typeof row.summary === "string"
        ? row.summary
        : typeof row.message === "string"
          ? row.message
          : `Hall constraint entry #${index + 1}`;

  return {
    line: typeof row.line === "string" ? row.line : typeof row.line_number === "string" ? row.line_number : undefined,
    path: typeof row.path === "string" ? row.path : typeof row.file === "string" ? row.file : undefined,
    ruleIndex,
    summary,
  };
}

function buildDiagnostics(raw: Record<string, unknown>, glass: Record<string, unknown> | null): ViolationDiagnostic[] {
  const diagnostics: ViolationDiagnostic[] = [];
  const pillar = readPillarStatus(glass);

  for (const entry of collectHallLogEntries(raw, glass)) {
    const d = diagnosticFromHallEntry(entry, diagnostics.length);
    if (d) diagnostics.push(d);
  }

  const hallId = raw.hall_narrative_log_id;
  if (typeof hallId === "string" && hallId.trim()) {
    diagnostics.push({
      ruleIndex: "P6 / hall",
      summary: `Delta persisted to Hall narrative log (${hallId.trim()}).`,
    });
  }

  const contradicts = raw.vault_p2_contradicts_roadmap;
  if (typeof contradicts === "number" && contradicts > 0) {
    diagnostics.push({
      ruleIndex: "1.1.1 / P2",
      summary: `${contradicts} logic delta(s) contradict the active P2 roadmap.`,
    });
  }

  if (raw.contradicts_p2_roadmap === true) {
    diagnostics.push({
      ruleIndex: "1.1.1",
      summary: "Active workspace pulse contradicts P2 roadmap alignment.",
    });
  }

  const tier = pillar?.preflightTier ?? raw.defend_preflight_tier;
  if (tier === "RED") {
    diagnostics.push({
      ruleIndex: "1.1.1 / shadow_preflight",
      summary: "DEFEND shadow preflight RED — malformed or misaligned logic rejected.",
    });
  }

  if (raw.block_user === true) {
    diagnostics.push({
      ruleIndex: "P6",
      summary: "Engine blocked further pulses for this session (block_user).",
    });
  }

  const remediation =
    typeof glass?.remediationSummary === "string" ? glass.remediationSummary : "";
  if (/constraint ledger|hall/i.test(remediation)) {
    diagnostics.push({
      ruleIndex: "P6",
      summary: remediation,
    });
  }

  return diagnostics;
}

function resolveErrorMessage(
  raw: Record<string, unknown>,
  glass: Record<string, unknown> | null
): string {
  if (typeof glass?.errorMessage === "string" && glass.errorMessage.trim()) {
    return glass.errorMessage.trim();
  }
  if (glass?.hasWrongLogic === true && typeof glass?.wrongLogicReason === "string") {
    return glass.wrongLogicReason.trim();
  }
  if (typeof raw.error === "string" && raw.error.trim()) {
    return raw.error.trim();
  }
  const pillar = readPillarStatus(glass);
  if (pillar?.ledger === "hall" || raw.ledger === "hall") {
    return "Pulse routed to P6 Hall constraint ledger.";
  }
  if (pillar?.preflightTier === "RED" || raw.defend_preflight_tier === "RED") {
    return "Shadow preflight RED — wrong logic mismatch.";
  }
  return "Governance alignment failure detected.";
}

/**
 * Returns violation context when the pulse body signals Wrong Logic / Hall routing.
 */
export function auditPulseResponseForWrongLogic(
  raw: Record<string, unknown>
): WrongLogicViolation | null {
  const glass = readGlass(raw);
  const pillar = readPillarStatus(glass);

  const explicitWrongLogic = glass?.hasWrongLogic === true;
  const ledgerHall = raw.ledger === "hall" || pillar?.ledger === "hall";
  const hallLogId =
    typeof raw.hall_narrative_log_id === "string" && raw.hall_narrative_log_id.trim().length > 0;
  const preflightRed = pillar?.preflightTier === "RED" || raw.defend_preflight_tier === "RED";
  const p2Conflict =
    raw.contradicts_p2_roadmap === true ||
    (typeof raw.vault_p2_contradicts_roadmap === "number" && raw.vault_p2_contradicts_roadmap > 0);
  const hallLogEntries = collectHallLogEntries(raw, glass).length > 0;
  const malformedFlag =
    glass?.malformed === true ||
    glass?.validation_failed === true ||
    raw.code === "ERR_MALFORMED_LOGIC";

  const detected =
    explicitWrongLogic ||
    ledgerHall ||
    hallLogId ||
    (preflightRed && (ledgerHall || hallLogId)) ||
    (preflightRed && p2Conflict) ||
    hallLogEntries ||
    malformedFlag;

  if (!detected) return null;

  const diagnostics = buildDiagnostics(raw, glass);
  if (!diagnostics.length) {
    diagnostics.push({
      ruleIndex: "1.1.1",
      summary: resolveErrorMessage(raw, glass),
    });
  }

  return {
    errorMessage: resolveErrorMessage(raw, glass),
    traceId: typeof raw.trace_id === "string" ? raw.trace_id : undefined,
    diagnostics,
  };
}
