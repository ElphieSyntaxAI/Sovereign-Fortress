/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-570add3d-20260922T212921Z-internal
 */
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
