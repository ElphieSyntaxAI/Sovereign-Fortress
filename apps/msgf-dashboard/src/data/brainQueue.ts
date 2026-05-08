export type BrainPushStatus = "pending" | "approved" | "rejected";

export type BrainPushItem = {
  id: string;
  /** Git branch proposing changes under packages/core */
  branch: string;
  title: string;
  /** e.g. packages/core/src/msgf-shadow.ts */
  corePaths: string[];
  openedAt: string;
  openedBy: string;
};

export const DEFAULT_BRAIN_PUSH_QUEUE: BrainPushItem[] = [
  {
    id: "BP-01",
    branch: "feature/core-shadow-tuning",
    title: "Tighten Hall overlap threshold for RED tier",
    corePaths: ["packages/core/src/msgf-shadow.ts"],
    openedAt: new Date(Date.now() - 48 * 3600_000).toISOString(),
    openedBy: "syntaxeducates.elphiesyntax.com",
  },
  {
    id: "BP-02",
    branch: "tax/ledger-vectors-1536",
    title: "Align core pillar vectors with 1536 embeddings",
    corePaths: ["packages/core/src/index.ts"],
    openedAt: new Date(Date.now() - 12 * 3600_000).toISOString(),
    openedBy: "tax.elphiesyntax.com",
  },
  {
    id: "BP-03",
    branch: "decks/consensus-copy",
    title: "Copy tweak: consensus error strings",
    corePaths: ["packages/core/src/msgf-legal.ts"],
    openedAt: new Date(Date.now() - 3 * 3600_000).toISOString(),
    openedBy: "decks.elphiesyntax.com",
  },
];

const STORAGE_KEY = "msgf-dashboard-brain-push-status";

export function loadBrainPushStatuses(): Record<string, BrainPushStatus> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, BrainPushStatus>;
  } catch {
    return {};
  }
}

export function saveBrainPushStatus(id: string, status: BrainPushStatus) {
  const cur = loadBrainPushStatuses();
  cur[id] = status;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cur));
}
