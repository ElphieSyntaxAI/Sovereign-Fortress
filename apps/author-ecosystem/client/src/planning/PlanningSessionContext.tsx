import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export function outlineBrainstormStorageKey(manuscriptId: string): string {
  return `elphie:outline:notes:${manuscriptId}`;
}

export type InterviewTurn = {
  id: string;
  question: string;
  answer: string;
  createdAt: number;
};

export type PlotBeat = {
  id: string;
  synopsis: string;
  order: number;
};

export type SandboxDualAuditSummary = {
  sceneLabel: string;
  sceneIndex: number;
  librarianLogic: string;
  criticSensitivity: string;
  updatedAt: number;
};

export type PlanningSessionState = {
  interviewTurns: InterviewTurn[];
  plotBeats: PlotBeat[];
  wikiNotes: string;
  /** Outline → Notes/brainstorming tab (persisted per manuscript). */
  brainstormNotes: string;
  lastSandboxDualAudit: SandboxDualAuditSummary | null;
  appendInterviewTurn: (question: string, answer: string) => void;
  setPlotBeats: (next: PlotBeat[] | ((prev: PlotBeat[]) => PlotBeat[])) => void;
  appendPlotBeat: (synopsis: string) => void;
  setWikiNotes: (notes: string) => void;
  setBrainstormNotes: (notes: string) => void;
  setLastSandboxDualAudit: (next: SandboxDualAuditSummary | null) => void;
};

/** Wiki scratch + brainstorm block sent to sync-session. */
export function mergeNotesForLibrarianSync(wikiNotes: string, brainstormNotes: string): string {
  const parts: string[] = [];
  const wiki = wikiNotes.trim();
  const brain = brainstormNotes.trim();
  if (wiki) parts.push(wiki);
  if (brain) parts.push("## Outline brainstorm notes", "", brain);
  return parts.join("\n\n").trim();
}

const PlanningSessionContext = createContext<PlanningSessionState | null>(null);

export function PlanningSessionProvider({
  children,
  manuscriptId,
}: {
  children: ReactNode;
  /** When set, brainstorm notes load/save to localStorage for this manuscript. */
  manuscriptId?: string;
}) {
  const [interviewTurns, setInterviewTurns] = useState<InterviewTurn[]>([]);
  const [plotBeats, setPlotBeats] = useState<PlotBeat[]>([]);
  const [wikiNotes, setWikiNotes] = useState("");
  const [brainstormNotes, setBrainstormNotesState] = useState("");
  const [lastSandboxDualAudit, setLastSandboxDualAudit] = useState<SandboxDualAuditSummary | null>(null);

  useEffect(() => {
    setInterviewTurns([]);
    setPlotBeats([]);
    setWikiNotes("");
    setLastSandboxDualAudit(null);
    if (!manuscriptId) {
      setBrainstormNotesState("");
      return;
    }
    try {
      setBrainstormNotesState(localStorage.getItem(outlineBrainstormStorageKey(manuscriptId)) ?? "");
    } catch {
      setBrainstormNotesState("");
    }
  }, [manuscriptId]);

  const setBrainstormNotes = useCallback(
    (notes: string) => {
      setBrainstormNotesState(notes);
      if (!manuscriptId) return;
      try {
        localStorage.setItem(outlineBrainstormStorageKey(manuscriptId), notes);
      } catch {
        /* ignore quota */
      }
    },
    [manuscriptId]
  );

  const appendInterviewTurn = useCallback((question: string, answer: string) => {
    const turn: InterviewTurn = {
      id: crypto.randomUUID(),
      question: question.trim(),
      answer: answer.trim(),
      createdAt: Date.now(),
    };
    setInterviewTurns((prev) => [...prev, turn]);
  }, []);

  const appendPlotBeat = useCallback((synopsis: string) => {
    const s = synopsis.trim();
    if (!s) return;
    setPlotBeats((prev) => [
      ...prev,
      { id: crypto.randomUUID(), synopsis: s, order: prev.length },
    ]);
  }, []);

  const value = useMemo<PlanningSessionState>(
    () => ({
      interviewTurns,
      plotBeats,
      wikiNotes,
      brainstormNotes,
      lastSandboxDualAudit,
      appendInterviewTurn,
      setPlotBeats,
      appendPlotBeat,
      setWikiNotes,
      setBrainstormNotes,
      setLastSandboxDualAudit,
    }),
    [
      interviewTurns,
      plotBeats,
      wikiNotes,
      brainstormNotes,
      lastSandboxDualAudit,
      appendInterviewTurn,
      appendPlotBeat,
      setBrainstormNotes,
    ]
  );

  return (
    <PlanningSessionContext.Provider value={value}>
      {children}
    </PlanningSessionContext.Provider>
  );
}

export function usePlanningSession(): PlanningSessionState {
  const ctx = useContext(PlanningSessionContext);
  if (!ctx) {
    throw new Error("usePlanningSession must be used within PlanningSessionProvider");
  }
  return ctx;
}
