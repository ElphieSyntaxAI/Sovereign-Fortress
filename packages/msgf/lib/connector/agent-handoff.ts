/**
 * Connector types for IDE / MCP agent handoff (P3 product boundaries).
 */

export type AgentHandoffMode = "guided" | "auto";

export type AgentContextPackRef = {
  mode: AgentHandoffMode;
  tenant_id: string;
  markdown: string;
  task_count: number;
};

export type DevHealCycleRef = {
  dev_cycle_required: boolean;
  recommended_path: "self" | "cloud";
  occurrence_threshold: number;
  max_occurrence_count: number;
};

export type VerifyResultRef = {
  passed: boolean;
  narrative_log_id: string | null;
  command?: string;
};

export type AgentHandoffBundle = {
  context_pack?: AgentContextPackRef;
  dev_heal?: DevHealCycleRef;
  verify?: VerifyResultRef;
  product_surface?: "gatedai" | "author" | "education" | "integrator" | "ide";
};
