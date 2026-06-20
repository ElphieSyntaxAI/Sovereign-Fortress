import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Link } from "react-router-dom";

import { GoogleDocDrivePicker } from "../GoogleDocDrivePicker";
import { dispatchDocumentIngestCommitted } from "../../lib/documentIngestEvents";
import { formatBffFetchError } from "../../lib/bffFetch";
import { usePlanningSessionOptional } from "../../planning/PlanningSessionContext";
import { bffAuthHeaders, bffCredentials, bffUrl } from "../../lib/bffFetch";
import type {
  ClarifyingQuestion,
  ContentSignal,
  IngestConflict,
  ProposedWiki,
  ScanThought,
} from "../../lib/onboardingApi";
import { DocumentClarificationStep } from "./DocumentClarificationStep";
import { DocumentScanLoader } from "./DocumentScanLoader";
import { WikiIngestReviewModal } from "./WikiIngestReviewModal";

export type DocumentSlot = "world_bible" | "current_draft" | "character_sheet";

const SLOT_META: Record<DocumentSlot, { label: string; hint: string }> = {
  world_bible: {
    label: "World Bible",
    hint: "Immutable laws, environment, and world-scale lore.",
  },
  current_draft: {
    label: "Current Draft",
    hint: "Your active manuscript draft (plot + continuity).",
  },
  character_sheet: {
    label: "Character Sheets",
    hint: "Cast profiles and character state.",
  },
};

type AuthorshipQuestion = { id: string; question: string; hint?: string };

type OutlineBeat = {
  synopsis: string;
  order: number;
  title?: string;
  pov_mode?: "single" | "split" | "unknown";
  pov_names?: string[];
};

type IngestTabDiagnostics = {
  count: number;
  method?: string;
  sections?: Array<{ title: string; path?: string; layer: string }>;
};

export function DocumentIngestFlow(props: {
  slot: DocumentSlot;
  manuscriptId: string;
  getAccessToken: () => string | null | Promise<string | null>;
  onCommitted?: () => void;
}) {
  const [phase, setPhase] = useState<
    "idle" | "scanning" | "clarification" | "authorship" | "review"
  >("idle");
  const [thoughts, setThoughts] = useState<ScanThought[]>([]);
  const [filename, setFilename] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<AuthorshipQuestion[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [proposed, setProposed] = useState<ProposedWiki[]>([]);
  const [outlineBeats, setOutlineBeats] = useState<OutlineBeat[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [commitMessage, setCommitMessage] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<IngestConflict[]>([]);
  const [signals, setSignals] = useState<ContentSignal[]>([]);
  const [clarifyingQuestions, setClarifyingQuestions] = useState<ClarifyingQuestion[]>([]);
  const [clarifyAnswers, setClarifyAnswers] = useState<string[]>([]);
  const [clarifyNotes, setClarifyNotes] = useState("");
  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const [forceCommit, setForceCommit] = useState(false);
  const [tabDiagnostics, setTabDiagnostics] = useState<IngestTabDiagnostics | null>(null);
  const [outlineBeatCount, setOutlineBeatCount] = useState<number | null>(null);
  const planning = usePlanningSessionOptional();

  const handleAutoCommitResponse = useCallback(
    (json: {
      session_id?: string;
      auto_committed?: boolean;
      auto_commit_failed?: boolean;
      auto_commit_error?: string;
      message?: string;
      wiki_entry_count?: number;
    }) => {
      if (json.auto_committed) {
        setSessionId(String(json.session_id ?? ""));
        const count = json.wiki_entry_count ?? 0;
        setCommitMessage(
          json.message ??
            `Wiki built automatically (${count} article${count === 1 ? "" : "s"}). Open Wiki to browse.`
        );
        setPhase("idle");
        dispatchDocumentIngestCommitted({ manuscriptId: props.manuscriptId });
        props.onCommitted?.();
        void planning?.reloadPlotBeatsFromStorage?.();
        return true;
      }
      if (json.auto_commit_failed) {
        setError(
          json.auto_commit_error ??
            "Auto wiki build needs manual review — check proposed articles below."
        );
      }
      return false;
    },
    [planning, props]
  );

  const applyScanResponse = useCallback(
    (json: {
      error?: string;
      session_id?: string;
      status?: string;
      auto_committed?: boolean;
      auto_commit_failed?: boolean;
      auto_commit_error?: string;
      message?: string;
      wiki_entry_count?: number;
      scan_thoughts?: ScanThought[];
      authorship_questions?: AuthorshipQuestion[];
      proposed_wiki?: ProposedWiki[];
      outline_beats?: OutlineBeat[];
      outline_beat_count?: number;
      google_doc_tabs?: IngestTabDiagnostics;
      content_signals?: ContentSignal[];
      ingest_conflicts?: IngestConflict[];
      clarifying_questions?: ClarifyingQuestion[];
    }) => {
      if (handleAutoCommitResponse(json)) return;
      setSessionId(String(json.session_id ?? ""));
      setThoughts(Array.isArray(json.scan_thoughts) ? json.scan_thoughts : []);
      setOutlineBeats(Array.isArray(json.outline_beats) ? json.outline_beats : []);
      setOutlineBeatCount(
        typeof json.outline_beat_count === "number"
          ? json.outline_beat_count
          : Array.isArray(json.outline_beats)
            ? json.outline_beats.length
            : null
      );
      setTabDiagnostics(json.google_doc_tabs ?? null);
      setSignals(Array.isArray(json.content_signals) ? json.content_signals : []);
      setConflicts(Array.isArray(json.ingest_conflicts) ? json.ingest_conflicts : []);
      if (json.status === "clarification") {
        const cqs = Array.isArray(json.clarifying_questions) ? json.clarifying_questions : [];
        setClarifyingQuestions(cqs);
        setClarifyAnswers(cqs.map(() => ""));
        setPhase("clarification");
      } else if (json.status === "authorship") {
        const qs = Array.isArray(json.authorship_questions) ? json.authorship_questions : [];
        if (qs.length === 0) {
          setProposed(Array.isArray(json.proposed_wiki) ? json.proposed_wiki : []);
          setPhase("review");
        } else {
          setQuestions(qs);
          setAnswers(qs.map(() => ""));
          setPhase("authorship");
        }
      } else {
        setProposed(Array.isArray(json.proposed_wiki) ? json.proposed_wiki : []);
        setPhase("review");
      }
    },
    [handleAutoCommitResponse]
  );

  const onDrop = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file || busy) return;
      setError(null);
      setBusy(true);
      setPhase("scanning");
      setFilename(file.name);
      try {
        const token = await props.getAccessToken();
        const fd = new FormData();
        fd.append("file", file);
        fd.append("manuscript_id", props.manuscriptId);
        fd.append("slot", props.slot);
        const res = await fetch(bffUrl("/api/onboarding/document/scan"), {
          method: "POST",
          ...bffCredentials,
          headers: bffAuthHeaders(token),
          body: fd,
        });
        const json = (await res.json().catch(() => ({}))) as {
          error?: string;
          session_id?: string;
          status?: string;
          scan_thoughts?: ScanThought[];
          authorship_questions?: AuthorshipQuestion[];
          proposed_wiki?: ProposedWiki[];
          outline_beats?: OutlineBeat[];
          content_signals?: ContentSignal[];
          ingest_conflicts?: IngestConflict[];
          clarifying_questions?: ClarifyingQuestion[];
        };
        if (!res.ok) throw new Error(json.error || res.statusText);
        applyScanResponse(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setPhase("idle");
      } finally {
        setBusy(false);
      }
    },
    [busy, props, applyScanResponse]
  );

  const scanFromGoogle = useCallback(
    async (docs: { id: string; name: string }[], primaryId: string) => {
      const doc = docs.find((d) => d.id === primaryId) ?? docs[0];
      if (!doc || busy) return;
      setError(null);
      setBusy(true);
      setPhase("scanning");
      setFilename(doc.name);
      setShowDrivePicker(false);
      try {
        const token = await props.getAccessToken();
        const res = await fetch(bffUrl("/api/onboarding/document/scan-google"), {
          method: "POST",
          ...bffCredentials,
          headers: { ...bffAuthHeaders(token), "Content-Type": "application/json" },
          body: JSON.stringify({
            google_doc_id: doc.id,
            manuscript_id: props.manuscriptId,
            slot: props.slot,
          }),
        });
        const json = (await res.json().catch(() => ({}))) as Parameters<typeof applyScanResponse>[0];
        if (!res.ok) throw new Error(json.error || res.statusText);
        applyScanResponse(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setPhase("idle");
      } finally {
        setBusy(false);
      }
    },
    [busy, props, applyScanResponse]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (f) => void onDrop(f),
    disabled: busy || phase !== "idle",
    maxFiles: 1,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/plain": [".txt"],
    },
  });

  const verifyClarification = async () => {
    if (!sessionId) return;
    setBusy(true);
    setError(null);
    try {
      const token = await props.getAccessToken();
      const res = await fetch(bffUrl("/api/onboarding/document/verify-clarification"), {
        method: "POST",
        ...bffCredentials,
        headers: { ...bffAuthHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          answers: clarifyAnswers,
          notes: clarifyNotes,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        cancelled?: boolean;
        message?: string;
        status?: string;
        proposed_wiki?: ProposedWiki[];
        outline_beats?: OutlineBeat[];
        authorship_questions?: AuthorshipQuestion[];
        ingest_conflicts?: IngestConflict[];
      };
      if (!res.ok) throw new Error(json.error || res.statusText);
      if (json.cancelled) {
        setCommitMessage(json.message ?? "Import cancelled.");
        setPhase("idle");
        setSessionId(null);
        return;
      }
      if (handleAutoCommitResponse({ ...json, session_id: sessionId })) return;
      if (Array.isArray(json.ingest_conflicts)) setConflicts(json.ingest_conflicts);
      setOutlineBeats(Array.isArray(json.outline_beats) ? json.outline_beats : []);
      if (json.status === "authorship") {
        const qs = Array.isArray(json.authorship_questions) ? json.authorship_questions : [];
        if (qs.length) {
          setQuestions(qs);
          setAnswers(qs.map(() => ""));
          setPhase("authorship");
        } else {
          setProposed(Array.isArray(json.proposed_wiki) ? json.proposed_wiki : []);
          setOutlineBeats(Array.isArray(json.outline_beats) ? json.outline_beats : []);
          setPhase("review");
        }
      } else {
        setProposed(Array.isArray(json.proposed_wiki) ? json.proposed_wiki : []);
        setOutlineBeats(Array.isArray(json.outline_beats) ? json.outline_beats : []);
        setPhase("review");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const verifyAuthorship = async () => {
    if (!sessionId) return;
    setBusy(true);
    setError(null);
    try {
      const token = await props.getAccessToken();
      const res = await fetch(bffUrl("/api/onboarding/document/verify-authorship"), {
        method: "POST",
        ...bffCredentials,
        headers: { ...bffAuthHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, answers }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        failed_indices?: number[];
        proposed_wiki?: ProposedWiki[];
        outline_beats?: OutlineBeat[];
      };
      if (!res.ok) {
        const failed =
          Array.isArray(json.failed_indices) && json.failed_indices.length
            ? ` (questions ${json.failed_indices.map((i) => i + 1).join(", ")})`
            : "";
        throw new Error(`${json.error || res.statusText}${failed}`);
      }
      if (handleAutoCommitResponse({ ...json, session_id: sessionId })) return;
      setProposed(Array.isArray(json.proposed_wiki) ? json.proposed_wiki : []);
      setOutlineBeats(Array.isArray(json.outline_beats) ? json.outline_beats : []);
      setPhase("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const postCommit = async (
    action: "submit" | "cancel" | "reject",
    extra?: { rejection_reason?: string; force_commit?: boolean }
  ) => {
    if (!sessionId) return;
    setBusy(true);
    setError(null);
    try {
      const token = await props.getAccessToken();
      const res = await fetch(bffUrl("/api/onboarding/document/commit"), {
        method: "POST",
        ...bffCredentials,
        headers: { ...bffAuthHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          action,
          proposed_wiki: proposed,
          outline_beats: outlineBeats,
          sync_msgf_brain: false,
          ...extra,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        hint?: string;
        planning?: { plot_beats?: OutlineBeat[] };
      };
      if (res.status === 409 && action === "submit") {
        setForceCommit(true);
        throw new Error(
          `${json.message ?? json.error ?? res.statusText}${json.hint ? ` ${json.hint}` : ""}`
        );
      }
      if (!res.ok) throw new Error(json.message ?? json.error ?? res.statusText);
      if (action === "submit") {
        const beats = json.planning?.plot_beats ?? outlineBeats;
        planning?.applyPlanningFromFileImport(
          beats.map((b, i) => ({
            synopsis: b.synopsis,
            title: b.title,
            order: typeof b.order === "number" ? b.order : i,
          }))
        );
        dispatchDocumentIngestCommitted({
          manuscriptId: props.manuscriptId,
          wikiCount: proposed.length,
          beatCount: beats.length,
        });
        setCommitMessage(
          json.message ??
            `Imported ${proposed.length} wiki entries and ${beats.length} outline beats. Open Wiki or Outline to continue.`
        );
      } else if (action === "reject") {
        setCommitMessage(json.message ?? "Import rejected — pattern recorded for future guard.");
      }
      setForceCommit(false);
      setError(null);
      setPhase("idle");
      setSessionId(null);
      props.onCommitted?.();
    } catch (e) {
      const msg =
        e instanceof TypeError
          ? formatBffFetchError(e, "/api/onboarding/document/commit")
          : e instanceof Error
            ? e.message
            : String(e);
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const commit = async (action: "submit" | "cancel", opts?: { force_commit?: boolean }) => {
    await postCommit(
      action,
      action === "submit" && (opts?.force_commit || forceCommit) ? { force_commit: true } : undefined
    );
  };

  const meta = SLOT_META[props.slot];

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
      <h3 className="text-sm font-semibold text-zinc-100">{meta.label}</h3>
      <p className="mt-1 text-xs text-zinc-500">{meta.hint}</p>
      <p className="mt-1 text-[10px] text-zinc-600">
        Any format — scene cards, outlines, character sheets, chapter breakdowns, notes. We map content to wiki
        and plot sandbox, not the file type. Large files may require authorship proof; mixed WIPs trigger
        clarifying questions.
      </p>

      {phase === "idle" ? (
        <div className="mt-3 space-y-2">
          <div
            {...getRootProps()}
            className={[
              "cursor-pointer rounded-lg border border-dashed px-4 py-6 text-center text-xs",
              isDragActive ? "border-violet-500 bg-violet-950/20" : "border-zinc-700 text-zinc-500",
            ].join(" ")}
          >
            <input {...getInputProps()} />
            Drop PDF, DOCX, or TXT — or click to upload
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => setShowDrivePicker((v) => !v)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-xs text-zinc-300 hover:border-violet-500/40"
          >
            {showDrivePicker ? "Hide Google Drive" : "Choose from Google Drive"}
          </button>
          {showDrivePicker ? (
            <GoogleDocDrivePicker
              manuscriptId={props.manuscriptId}
              oauthReturnPath="/manuscripts#import-documents"
              busy={busy}
              primaryLabel="Scan selected Google Doc"
              onSubmit={scanFromGoogle}
            />
          ) : null}
        </div>
      ) : null}

      {phase === "scanning" ? <DocumentScanLoader thoughts={thoughts} filename={filename} /> : null}

      {phase === "clarification" ? (
        <DocumentClarificationStep
          conflicts={conflicts}
          signals={signals}
          questions={clarifyingQuestions}
          answers={clarifyAnswers}
          notes={clarifyNotes}
          onAnswer={(i, v) => {
            const next = [...clarifyAnswers];
            next[i] = v;
            setClarifyAnswers(next);
          }}
          onNotes={setClarifyNotes}
          onSubmit={() => void verifyClarification()}
          busy={busy}
        />
      ) : null}

      {phase === "authorship" ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-amber-200/90">Prove you wrote this document — answers must appear in your text.</p>
          {questions.length === 0 ? (
            <p className="text-xs text-amber-300/80">
              Loading authorship questions… if this stays empty, scan again or use a smaller excerpt.
            </p>
          ) : null}
          {questions.map((q, i) => (
            <label key={q.id} className="block text-xs text-zinc-400">
              {i + 1}. {q.question}
              <input
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
                value={answers[i] ?? ""}
                onChange={(e) => {
                  const next = [...answers];
                  next[i] = e.target.value;
                  setAnswers(next);
                }}
              />
            </label>
          ))}
          <button
            type="button"
            disabled={busy || questions.length === 0}
            onClick={() => void verifyAuthorship()}
            className="rounded-lg bg-amber-600/90 px-3 py-1.5 text-xs font-semibold text-amber-950 disabled:opacity-40"
          >
            Verify authorship
          </button>
        </div>
      ) : null}

      {error && phase !== "review" ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
      {commitMessage ? (
        <p className="mt-2 text-xs text-emerald-400/90">
          {commitMessage}{" "}
          <Link to="/outline" className="underline">
            Open outline &amp; sandbox
          </Link>
        </p>
      ) : null}

      <WikiIngestReviewModal
        open={phase === "review"}
        slotLabel={meta.label}
        proposed={proposed}
        outlineBeats={outlineBeats}
        outlineBeatCount={outlineBeatCount ?? outlineBeats.length}
        tabDiagnostics={tabDiagnostics}
        contentSignals={signals}
        ingestConflicts={conflicts}
        onEdit={setProposed}
        onRemoveWiki={(idx) => setProposed((prev) => prev.filter((_, i) => i !== idx))}
        onRemoveBeat={(idx) => setOutlineBeats((prev) => prev.filter((_, i) => i !== idx))}
        onSubmit={() => void commit("submit")}
        onSubmitAnyway={() => void commit("submit", { force_commit: true })}
        onCancel={() => void commit("cancel")}
        onReject={(reason) => void postCommit("reject", { rejection_reason: reason })}
        busy={busy}
        error={phase === "review" ? error : null}
        showSubmitAnyway={forceCommit}
      />
    </div>
  );
}
