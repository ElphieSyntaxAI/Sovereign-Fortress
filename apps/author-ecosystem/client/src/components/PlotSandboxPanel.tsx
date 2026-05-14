import { useCallback, useEffect, useMemo, useState } from "react";
import { bffAuthHeaders, bffCredentials } from "../lib/bffFetch";
import { usePlanningSession } from "../planning/PlanningSessionContext";
import {
  buildWikiStateText,
  sceneCardsFromManuscriptOutline,
  type SceneCardModel,
} from "../lib/sceneCardsFromOutline";

export type PlotSandboxPanelProps = {
  manuscriptId: string;
  tenantId: string;
  getAccessToken: () => string | null | Promise<string | null>;
};

type PlanningPayload = {
  data?: {
    manuscript_outline?: string | null;
    bible?: Array<{ excerpt?: string; source_document?: string }>;
    outline?: Array<{ excerpt?: string }>;
  };
};

type AuditRow = {
  kind?: string;
  hal_ledger_id: string;
  created_at: string;
  narrative_audit: string;
  librarian_logic?: string;
  critic_sensitivity?: string;
  scene_index: number;
  scene_label: string | null;
  narrative_logic_outcome?: string;
};

type CardFields = { environment: string; cast: string; logicHooks: string };

type LegacyCardFields = CardFields & { characters?: string; tropes?: string };

function emptyFields(): CardFields {
  return { environment: "", cast: "", logicHooks: "" };
}

function migrateFields(f: LegacyCardFields | CardFields | undefined): CardFields {
  if (!f) return emptyFields();
  const leg = f as LegacyCardFields;
  return {
    environment: f.environment ?? "",
    cast: f.cast ?? leg.characters ?? "",
    logicHooks: f.logicHooks ?? leg.tropes ?? "",
  };
}

export function PlotSandboxPanel({ manuscriptId, tenantId, getAccessToken }: PlotSandboxPanelProps) {
  const { wikiNotes, plotBeats, appendPlotBeat, setPlotBeats, setLastSandboxDualAudit } = usePlanningSession();
  const [planning, setPlanning] = useState<PlanningPayload | null>(null);
  const [planErr, setPlanErr] = useState<string | null>(null);
  const [fieldsByCard, setFieldsByCard] = useState<Record<string, CardFields>>({});
  const [simulatingImpactId, setSimulatingImpactId] = useState<string | null>(null);
  const [simulatingLogicId, setSimulatingLogicId] = useState<string | null>(null);
  const [dualAuditByCard, setDualAuditByCard] = useState<Record<string, { logic: string; sensitivity: string }>>({});
  const [logicWarningByCard, setLogicWarningByCard] = useState<Record<string, string>>({});
  const [logicOkByCard, setLogicOkByCard] = useState<Record<string, string>>({});
  const [auditLog, setAuditLog] = useState<AuditRow[]>([]);
  const [beatDraft, setBeatDraft] = useState("");

  const cards = useMemo((): SceneCardModel[] => {
    const data = planning?.data;
    const outlineRows = (data?.outline ?? []).map((r) => ({ excerpt: String(r.excerpt ?? "") }));
    return sceneCardsFromManuscriptOutline(data?.manuscript_outline ?? null, outlineRows);
  }, [planning]);

  useEffect(() => {
    setFieldsByCard((prev) => {
      const next = { ...prev };
      for (const c of cards) {
        if (!next[c.id]) next[c.id] = migrateFields(prev[c.id]);
      }
      for (const k of Object.keys(next)) {
        if (!cards.some((c) => c.id === k)) delete next[k];
      }
      return next;
    });
  }, [cards]);

  const loadPlanning = useCallback(async () => {
    if (!manuscriptId.trim()) return;
    setPlanErr(null);
    try {
      const token = await getAccessToken();
      const u = new URL("/api/dashboard/planning", window.location.origin);
      u.searchParams.set("manuscript_id", manuscriptId.trim());
      const res = await fetch(u.toString(), { ...bffCredentials, headers: bffAuthHeaders(token) });
      const json: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err =
          json && typeof json === "object" && "error" in json && typeof (json as { error: unknown }).error === "string"
            ? (json as { error: string }).error
            : res.statusText;
        throw new Error(err);
      }
      setPlanning(json as PlanningPayload);
    } catch (e) {
      setPlanErr(e instanceof Error ? e.message : String(e));
    }
  }, [getAccessToken, manuscriptId]);

  const loadAuditLog = useCallback(async () => {
    if (!manuscriptId.trim()) return;
    try {
      const token = await getAccessToken();
      const u = new URL("/api/plot-sandbox/audit-log", window.location.origin);
      u.searchParams.set("manuscript_id", manuscriptId.trim());
      const res = await fetch(u.toString(), { ...bffCredentials, headers: bffAuthHeaders(token) });
      const json = (await res.json().catch(() => ({}))) as { audits?: AuditRow[] };
      if (res.ok && Array.isArray(json.audits)) setAuditLog(json.audits as AuditRow[]);
    } catch {
      /* optional */
    }
  }, [getAccessToken, manuscriptId]);

  useEffect(() => {
    void loadPlanning();
  }, [loadPlanning]);

  useEffect(() => {
    void loadAuditLog();
  }, [loadAuditLog]);

  const wikiDigest = useMemo(() => {
    const bible = planning?.data?.bible ?? [];
    return buildWikiStateText(bible, wikiNotes);
  }, [planning, wikiNotes]);

  const setField = (cardId: string, key: keyof CardFields, value: string) => {
    setFieldsByCard((prev) => ({
      ...prev,
      [cardId]: { ...(prev[cardId] ?? emptyFields()), [key]: value },
    }));
  };

  const persistLogicProof = async (args: {
    card: SceneCardModel;
    index: number;
    outcome: string;
    logic_warning: string | null;
    librarian_reply: string;
    fields: CardFields;
  }) => {
    const token = await getAccessToken();
    const res = await fetch("/api/hal/narrative-logic-proof", {
      method: "POST",
      ...bffCredentials,
      headers: {
        ...bffAuthHeaders(token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tenant_id: tenantId.trim(),
        manuscript_id: manuscriptId.trim(),
        scene_card_id: args.card.id,
        scene_index: args.index,
        scene_label: args.card.label,
        outcome: args.outcome,
        logic_warning: args.logic_warning,
        librarian_reply: args.librarian_reply,
        environment: args.fields.environment,
        cast: args.fields.cast,
        logic_hooks: args.fields.logicHooks,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(json.error || res.statusText);
  };

  const simulateImpact = async (card: SceneCardModel, index: number) => {
    if (!tenantId.trim()) {
      setPlanErr("tenantId is required for Simulate Impact.");
      return;
    }
    setSimulatingImpactId(card.id);
    setPlanErr(null);
    try {
      const token = await getAccessToken();
      const f = fieldsByCard[card.id] ?? emptyFields();
      const outlineSnap = String(planning?.data?.manuscript_outline ?? "").trim();

      const res = await fetch("/api/plot-sandbox/simulate-impact", {
        method: "POST",
        ...bffCredentials,
        headers: {
          ...bffAuthHeaders(token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          manuscript_id: manuscriptId.trim(),
          tenant_id: tenantId.trim(),
          scene_card_id: card.id,
          scene_index: index,
          scene_label: card.label,
          scene_beat_text: card.beatText,
          environment: f.environment,
          cast: f.cast,
          logic_hooks: f.logicHooks,
          characters: f.cast,
          tropes: f.logicHooks,
          wiki_state_text: wikiDigest,
          manuscript_outline_snapshot: outlineSnap,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as {
        librarian_logic?: string;
        critic_sensitivity?: string;
        narrative_audit?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || res.statusText);

      const logic = String(json.librarian_logic ?? json.narrative_audit ?? "").trim();
      const sensitivity = String(json.critic_sensitivity ?? "").trim();
      setDualAuditByCard((prev) => ({ ...prev, [card.id]: { logic, sensitivity } }));
      setLastSandboxDualAudit({
        sceneLabel: card.label,
        sceneIndex: index,
        librarianLogic: logic,
        criticSensitivity: sensitivity,
        updatedAt: Date.now(),
      });
      await loadAuditLog();
      const beatLine =
        sensitivity.length > 0
          ? `[Impact scene ${index + 1}] Librarian (Logic): ${logic} — Critic (Sensitivity): ${sensitivity.slice(0, 280)}${sensitivity.length > 280 ? "…" : ""}`
          : `[Impact scene ${index + 1}] Librarian (Logic): ${logic}`;
      appendPlotBeat(beatLine);
    } catch (e) {
      setPlanErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSimulatingImpactId(null);
    }
  };

  const simulateLogic = async (card: SceneCardModel, index: number) => {
    if (!tenantId.trim()) {
      setPlanErr("tenantId is required for Simulate Logic.");
      return;
    }
    setSimulatingLogicId(card.id);
    setPlanErr(null);
    setLogicWarningByCard((prev) => {
      const n = { ...prev };
      delete n[card.id];
      return n;
    });
    setLogicOkByCard((prev) => {
      const n = { ...prev };
      delete n[card.id];
      return n;
    });

    const f = fieldsByCard[card.id] ?? emptyFields();
    const summary = (card.beatText || card.label).trim().slice(0, 500);
    const env = f.environment.trim() || "unspecified environment";
    const cast = f.cast.trim() || "unspecified cast";
    let question = `Audit this scene: ${summary} in ${env} with ${cast}. Any lore contradictions?`;
    const lh = f.logicHooks.trim();
    if (lh) question += ` Logic hooks: ${lh}.`;

    try {
      const token = await getAccessToken();

      const res = await fetch("/api/rag/chat", {
        method: "POST",
        ...bffCredentials,
        headers: {
          ...bffAuthHeaders(token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audience: "author",
          question,
          project_id: manuscriptId.trim() || null,
          system_prompt: "narrative_audit",
          include_wiki_drafts: true,
          hud_state: {},
        }),
      });

      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        narrative_audit?: boolean;
        logic_status?: string;
        logic_warning?: string | null;
        explanation?: string;
        answer?: string;
      };
      if (!res.ok) throw new Error(json.error || res.statusText);

      const status = String(json.logic_status ?? "AUDIT_PASSED").toUpperCase();
      const warning = json.logic_warning != null ? String(json.logic_warning).trim() : "";
      const reply = String(json.answer ?? json.explanation ?? "").trim();

      if (status === "LOGIC_WARNING") {
        const msg = warning || reply || "Lore contradiction suspected — see librarian reply.";
        setLogicWarningByCard((prev) => ({ ...prev, [card.id]: msg }));
      } else {
        const okMsg =
          status === "CONFLICT_RESOLVED"
            ? "Conflict resolved — scene aligns with retrieved lore."
            : "Audit passed — no lore contradiction flagged for this snapshot.";
        setLogicOkByCard((prev) => ({ ...prev, [card.id]: okMsg }));
      }

      try {
        await persistLogicProof({
          card,
          index,
          outcome: status,
          logic_warning: status === "LOGIC_WARNING" ? warning || reply || null : null,
          librarian_reply: reply,
          fields: f,
        });
      } catch (pe) {
        setPlanErr(pe instanceof Error ? pe.message : String(pe));
      }

      await loadAuditLog();
      const warnBit =
        status === "LOGIC_WARNING" ? (warning || reply).trim() : "";
      appendPlotBeat(`[Logic ${index + 1}] ${status}${warnBit ? `: ${warnBit}` : ""}`);
    } catch (e) {
      setPlanErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSimulatingLogicId(null);
    }
  };

  const missingIds = !manuscriptId.trim() || !tenantId.trim();

  return (
    <div className="space-y-4">
      {missingIds ? (
        <p className="text-sm text-amber-300/90">
          Plot Sandbox needs both manuscript and tenant ids (same as Wiki Architect env props).
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-400">
          Scene cards use <code className="text-zinc-300">p4_manuscripts.outline</code>. Fill{" "}
          <strong className="text-zinc-200">Environment</strong>, <strong className="text-zinc-200">Cast</strong>, and{" "}
          <strong className="text-zinc-200">Logic hooks</strong>. <strong className="text-zinc-200">Simulate Logic</strong>{" "}
          calls <code className="text-zinc-300">POST /api/rag/chat</code> with{" "}
          <code className="text-zinc-300">narrative_audit</code>; <strong className="text-zinc-200">Simulate Impact</strong>{" "}
          calls <code className="text-zinc-300">POST /api/plot-sandbox/simulate-impact</code> (Gemini librarian logic +
          Claude sensitivity critic). Both write to the HAL ledger (impact via simulate-impact; logic via{" "}
          <code className="text-zinc-300">POST /api/hal/narrative-logic-proof</code>).
        </p>
        <button
          type="button"
          onClick={() => void loadPlanning().then(() => loadAuditLog())}
          className="shrink-0 rounded-md border border-zinc-600 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
        >
          Refresh outline
        </button>
      </div>

      {planErr ? <p className="text-sm text-red-400">{planErr}</p> : null}

      <div className="overflow-x-auto pb-2">
        <div className="flex min-h-[26rem] snap-x snap-mandatory gap-3 pr-2">
          {cards.map((card, index) => {
            const f = fieldsByCard[card.id] ?? emptyFields();
            const busyImpact = simulatingImpactId === card.id;
            const busyLogic = simulatingLogicId === card.id;
            const dual = dualAuditByCard[card.id];
            const logicWarn = logicWarningByCard[card.id];
            const logicOk = logicOkByCard[card.id];
            return (
              <article
                key={card.id}
                className="snap-start w-[min(100%,300px)] shrink-0 rounded-xl border border-zinc-700 bg-zinc-900/60 p-3 shadow-lg shadow-black/20"
              >
                <header className="border-b border-zinc-800 pb-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-400/90">
                    Scene {index + 1}
                  </p>
                  <h3 className="text-sm font-medium text-zinc-100">{card.label}</h3>
                  <p className="mt-1 max-h-24 overflow-y-auto text-xs leading-relaxed text-zinc-500">{card.beatText}</p>
                </header>

                <div className="mt-3 space-y-2">
                  <label className="block text-[10px] uppercase tracking-wide text-zinc-500">
                    Environment
                    <textarea
                      value={f.environment}
                      onChange={(e) => setField(card.id, "environment", e.target.value)}
                      rows={2}
                      placeholder="e.g. Volcanic Crater"
                      className="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 placeholder:text-zinc-600"
                    />
                  </label>
                  <label className="block text-[10px] uppercase tracking-wide text-zinc-500">
                    Cast
                    <textarea
                      value={f.cast}
                      onChange={(e) => setField(card.id, "cast", e.target.value)}
                      rows={2}
                      placeholder="e.g. Mib, The Librarian"
                      className="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 placeholder:text-zinc-600"
                    />
                  </label>
                  <label className="block text-[10px] uppercase tracking-wide text-zinc-500">
                    Logic hooks
                    <textarea
                      value={f.logicHooks}
                      onChange={(e) => setField(card.id, "logicHooks", e.target.value)}
                      rows={2}
                      placeholder="e.g. Low gravity, high heat"
                      className="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 placeholder:text-zinc-600"
                    />
                  </label>
                </div>

                {logicWarn ? (
                  <div
                    className="mt-3 rounded-md border border-red-800/80 bg-red-950/50 px-2 py-2 text-xs text-red-100"
                    role="alert"
                  >
                    <p className="font-semibold uppercase tracking-wide text-red-300">[LOGIC WARNING]</p>
                    <p className="mt-1 text-red-50/95">{logicWarn}</p>
                  </div>
                ) : null}

                {logicOk ? (
                  <p className="mt-2 rounded border border-emerald-900/50 bg-emerald-950/25 px-2 py-1.5 text-[11px] text-emerald-100/90">
                    {logicOk}
                  </p>
                ) : null}

                <div className="mt-3 space-y-2 border-t border-zinc-800 pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Audits</p>
                  <button
                    type="button"
                    disabled={busyLogic || missingIds}
                    onClick={() => void simulateLogic(card, index)}
                    className="w-full rounded-md border border-sky-700/60 bg-sky-950/40 px-2 py-1.5 text-xs font-medium text-sky-100 hover:bg-sky-900/50 disabled:opacity-50"
                  >
                    {busyLogic ? "Auditing…" : "Simulate Logic"}
                  </button>
                  <button
                    type="button"
                    disabled={busyImpact || missingIds}
                    onClick={() => void simulateImpact(card, index)}
                    className="w-full rounded-md bg-amber-700/90 px-2 py-1.5 text-xs font-medium text-amber-50 hover:bg-amber-600 disabled:opacity-50"
                  >
                    {busyImpact ? "Running…" : "Simulate Impact"}
                  </button>
                  {dual?.logic ? (
                    <div className="space-y-2 rounded border border-zinc-800 bg-zinc-950/80 p-2 text-xs text-zinc-200">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/90">
                        Librarian (Logic)
                      </p>
                      <p>{dual.logic}</p>
                      {dual.sensitivity ? (
                        <>
                          <p className="border-t border-zinc-800 pt-2 text-[10px] font-semibold uppercase tracking-wide text-fuchsia-200/85">
                            Critic (Sensitivity)
                          </p>
                          <p className="max-h-36 overflow-y-auto whitespace-pre-wrap leading-relaxed text-zinc-300">
                            {dual.sensitivity}
                          </p>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <section className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">HAL ledger (sandbox)</h4>
        <p className="mt-1 text-[11px] text-zinc-500">
          Impact runs (<code className="text-zinc-400">plot_sandbox_audit</code>) and logic proofs (
          <code className="text-zinc-400">narrative_logic_proof</code>), newest first.
        </p>
        <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto text-xs text-zinc-300">
          {auditLog.length === 0 ? (
            <li className="text-zinc-600">No sandbox HAL rows yet for this manuscript.</li>
          ) : (
            auditLog.map((a) => (
              <li key={a.hal_ledger_id} className="rounded border border-zinc-800/80 bg-zinc-900/40 px-2 py-1.5">
                <span className="text-[10px] text-zinc-600">{a.created_at}</span>
                <span className="ml-2 text-[10px] text-violet-400">
                  {a.kind === "logic_proof" ? "logic" : "impact"} · scene{" "}
                  {(Number.isFinite(Number(a.scene_index)) ? Number(a.scene_index) : 0) + 1}
                </span>
                {a.kind !== "logic_proof" && (a.librarian_logic || a.critic_sensitivity) ? (
                  <div className="mt-1 space-y-1.5 text-zinc-200">
                    {a.librarian_logic ? (
                      <div>
                        <p className="text-[10px] font-semibold uppercase text-amber-200/90">Librarian (Logic)</p>
                        <p>{a.librarian_logic}</p>
                      </div>
                    ) : null}
                    {a.critic_sensitivity ? (
                      <div>
                        <p className="text-[10px] font-semibold uppercase text-fuchsia-200/85">Critic (Sensitivity)</p>
                        <p className="max-h-24 overflow-y-auto whitespace-pre-wrap text-zinc-300">{a.critic_sensitivity}</p>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-1 text-zinc-200">{a.narrative_audit}</p>
                )}
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-lg border border-zinc-800/80 bg-zinc-900/30 p-3">
        <h4 className="text-xs font-semibold text-zinc-400">Session beats (shared)</h4>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            value={beatDraft}
            onChange={(e) => setBeatDraft(e.target.value)}
            placeholder="Add a beat note to shared session…"
            className="min-w-[10rem] flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100"
          />
          <button
            type="button"
            onClick={() => {
              appendPlotBeat(beatDraft);
              setBeatDraft("");
            }}
            className="rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
          >
            Add beat
          </button>
          {plotBeats.length > 0 ? (
            <button
              type="button"
              onClick={() => setPlotBeats([])}
              className="text-xs text-zinc-500 underline hover:text-zinc-300"
            >
              Clear beats
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
