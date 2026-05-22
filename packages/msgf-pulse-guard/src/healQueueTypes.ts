/** Mirrors GET /api/msgf/heal-queue remediation_tasks. */

export type HealQueueGovernancePillar = "P1" | "P2" | "P3" | "P4" | "P5" | "P6";

export type HealQueueBugIndex = {
  level_1_category: string;
  level_1_1_branch: string;
  level_1_1_1_instance: string;
};

export type HealQueueRemediationTask = {
  task_id: string;
  file_path: string;
  governance_pillar: HealQueueGovernancePillar;
  bug_index: HealQueueBugIndex;
  reason: string;
  source: "brain_readiness" | "pillar_vector" | "scheduled";
  pillar_vector_id: string | null;
  scheduling_tier: "RED" | "YELLOW" | "GREEN" | null;
  preset_interval: "immediate" | "1h" | "6h" | "nightly" | null;
};

export type HealQueueGetResponse = {
  ok: boolean;
  tenant_id?: string;
  brain_readiness?: {
    readiness_score: number;
    missing_pillars: HealQueueGovernancePillar[];
    baseline_training_required: boolean;
    baseline_training_remaining: number;
    is_pillar_baseline_set: boolean;
    brain_fully_initialized: boolean;
  };
  remediation_tasks?: HealQueueRemediationTask[];
  error?: string;
  message?: string;
};

export type HealQueuePresetInterval = "immediate" | "1h" | "6h" | "nightly";

export type HealConsoleTask = HealQueueRemediationTask & {
  /** Stable key for checkbox state in webview */
  row_key: string;
};

export type HealConsoleStatusTone = "idle" | "processing" | "scheduled" | "success" | "error";
