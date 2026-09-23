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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
/**
 * Educational copy for the six MSGF governance pillars (getting-started / integrators).
 * Canonical mapping: docs/msgf/technical-specs/MSGF_PILLAR_MAPPING_SSOT.md
 */

import type { MsgfGovernancePillar } from "@/lib/services/pillar-baseline";

export type PillarGuideEntry = {
  pillar: MsgfGovernancePillar;
  title: string;
  subtitle: string;
  v32Step: string;
  whatItDoes: string;
  inYourProduct: string;
  howToUse: string;
};

export const PILLAR_GUIDE_ENTRIES: PillarGuideEntry[] = [
  {
    pillar: "P1",
    title: "Static Ledger (Immutable Rules & Security)",
    subtitle: "Immutable Rules & Security",
    v32Step: "DEFEND",
    whatItDoes:
      "Stores non-negotiable platform law: pledge versions, security constants, and HALT conditions. If a request violates legal or security policy, MSGF stops before models run.",
    inYourProduct:
      "Your app should collect explicit user consent (No-AI-Training pledge) once per account. MSGF records it in state_beats; Pulse returns 403 until pledge exists.",
    howToUse:
      "Sign up → accept pledge on first dashboard visit. Do not bypass with client-only checkboxes — call MSGF after registration so DEFEND can enforce the same legal_version everywhere.",
  },
  {
    pillar: "P2",
    title: "Flow Sequence (Pipeline & Execution Order)",
    subtitle: "Pipeline & Execution Order",
    v32Step: "CONVERGE",
    whatItDoes:
      "Orders the pipeline: preflight → shadow → dual-model consensus → optional human tie-breaker. Ensures gates run in the master directive sequence, not ad hoc in your BFF.",
    inYourProduct:
      "Route risky actions through POST /api/msgf/pulse (typing/HAL) and POST /api/msgf/ingest (code/docs). Your product supplies keystrokes or files; MSGF returns routing tier (GREEN / YELLOW / RED) and remediation hints.",
    howToUse:
      "After mapping a project, send natural keystrokes via Pulse or ingest a repo slice. Watch dashboard stoplights — YELLOW may schedule heal-queue work; RED may require human arbitration.",
  },
  {
    pillar: "P3",
    title: "Entity Profiles (Identity, Roles & Stylometry)",
    subtitle: "Identity, Roles & Stylometry",
    v32Step: "SHARD (identity)",
    whatItDoes:
      "Binds humans and tenants to entitlements: tier_id, credits, Stripe status, tenant silo. Pulse middleware checks p4_profiles before burning inference credits.",
    inYourProduct:
      "Each integrator gets a tenant silo from the license or session in the MSGF database. Map your app's org/user id to x-msgf-entity-id; keep billing in MSGF or mirror Stripe webhooks into p4_profiles.",
    howToUse:
      "Mint a license (`msgf_live_…` / `msgf_test_…`) and send it as `x-msgf-key`. Tenant always comes from that license row — never set `x-msgf-tenant-id` as the source of truth.",
  },
  {
    pillar: "P4",
    title: "State Ledger (Runtime Telemetry & Active Memory)",
    subtitle: "Runtime Telemetry & Active Memory",
    v32Step: "SHARD",
    whatItDoes:
      "Flight recorder for rhythm telemetry (dwell, flight, paste flags), session beats, and Redis hot slices. HAL scores and baseline training live here — not under P1.",
    inYourProduct:
      "Capture keystrokes in your editor, LMS, or HR monitor; normalize to p1-hal-standard and POST to Pulse. Optional: send chunked packets via msgf/hal-author-bridge (175 words, 10-word overlap).",
    howToUse:
      "Install msgf-pulse-guard, paste workspace settings, type until baseline clears (202 → 200). Dashboard P4 turns green when recent HAL activity exists for your mapped project.",
  },
  {
    pillar: "P5",
    title: "Local Variables (Workspace Context Sharding)",
    subtitle: "Workspace Context Sharding",
    v32Step: "SWEEP",
    whatItDoes:
      "Holds per-tenant configuration shards: project_origin tags, module context, and UI-scoped variables used to scope health views and ingest paths.",
    inYourProduct:
      "Register each repo or product surface in Projects with a stable project_origin. Health API and dashboard filter telemetry to those tags so one account can separate workstreams.",
    howToUse:
      "Setup → Projects → add local path or GitHub repo. Re-use the same origin string in ingest metadata and IDE settings so SWEEP lineage maps to the right silo.",
  },
  {
    pillar: "P6",
    title: "Constraint Ledger (Vault vs. Hall Anomaly Isolation)",
    subtitle: "Vault vs. Hall Anomaly Isolation",
    v32Step: "CROSS-REF / PERSIST",
    whatItDoes:
      "Vault stores successful patterns; Hall stores failures and constraints. Every ingest/Pulse cross-references genealogical bug_index (1.0 / 1.1 / 1.1.1) before persisting vectors.",
    inYourProduct:
      "Send coherent file paths and optional bug_index on ingest. Failed validations land in Hall; successes in Vault — heal-queue remediates Hall rows with BULK / INDIVIDUAL / SCHEDULED actions.",
    howToUse:
      "Run ingest on a sample file after Pulse baseline. Open heal-queue from a pillar card when misalignments appear; use human arbitration when the circuit breaker trips.",
  },
];

export const V32_PIPELINE_STEPS = [
  { step: "SWEEP", blurb: "Audit & lineage map before ingestion" },
  { step: "SHARD", blurb: "Redis hot layer + Postgres cold storage" },
  { step: "DEFEND", blurb: "Shadow preflight & legal/security HALT" },
  { step: "CROSS-REF", blurb: "Vault/Hall preflight on every write" },
  { step: "CONVERGE", blurb: "Dual-model consensus on Pulse" },
  { step: "ARBITRATE", blurb: "Human tie-breaker when models disagree" },
  { step: "PERSIST", blurb: "Durable Vault write; Hall purge policies" },
] as const;
