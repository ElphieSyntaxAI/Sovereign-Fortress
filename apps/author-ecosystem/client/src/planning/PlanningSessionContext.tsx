import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

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
  lastSandboxDualAudit: SandboxDualAuditSummary | null;
  appendInterviewTurn: (question: string, answer: string) => void;
  setPlotBeats: (next: PlotBeat[] | ((prev: PlotBeat[]) => PlotBeat[])) => void;
  appendPlotBeat: (synopsis: string) => void;
  setWikiNotes: (notes: string) => void;
  setLastSandboxDualAudit: (next: SandboxDualAuditSummary | null) => void;
};

const PlanningSessionContext = createContext<PlanningSessionState | null>(null);

export function PlanningSessionProvider({ children }: { children: ReactNode }) {
  const [interviewTurns, setInterviewTurns] = useState<InterviewTurn[]>([]);
  const [plotBeats, setPlotBeats] = useState<PlotBeat[]>([]);
  const [wikiNotes, setWikiNotes] = useState("");
  const [lastSandboxDualAudit, setLastSandboxDualAudit] = useState<SandboxDualAuditSummary | null>(null);

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
      lastSandboxDualAudit,
      appendInterviewTurn,
      setPlotBeats,
      appendPlotBeat,
      setWikiNotes,
      setLastSandboxDualAudit,
    }),
    [interviewTurns, plotBeats, wikiNotes, lastSandboxDualAudit, appendInterviewTurn, appendPlotBeat]
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
