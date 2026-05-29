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
 * Distribution Build ID: MSGF-3a4c1de-20260529T200349Z-internal
 */
/**
 * Shipped MSGF capabilities — single source for marketing + dashboard copy.
 */

export type ShippedFeature = {
  id: string;
  title: string;
  description: string;
  accent: "emerald" | "violet" | "cyan" | "amber";
};

export const IDE_WORKFLOW_STEPS = [
  {
    step: "01",
    title: "Connect",
    body: "Paste workspace settings · msgf_ide_* token · Command Center goes live.",
  },
  {
    step: "02",
    title: "Optimize",
    body: "0-token prompt with @-attachments and mandatory verify rules — local only.",
  },
  {
    step: "03",
    title: "Verify",
    body: "Run Scripts or Safe Build · pass → Vault · repeat fail → Hall.",
  },
  {
    step: "04",
    title: "Measure",
    body: "Token savings dashboard rolls up IDE loop + Small Brain routing.",
  },
] as const;

export const SHIPPED_FEATURE_CARDS: ShippedFeature[] = [
  {
    id: "command-center",
    title: "IDE Command Center",
    description:
      "MSGF Pulse Guard sidebar: connection health, prompt optimizer, Run Scripts, Safe Build, and advanced heal ops in Cursor or VS Code.",
    accent: "emerald",
  },
  {
    id: "verify-loop",
    title: "Vault · Hall verify loop",
    description:
      "Allowlisted execFile runs sync pass to verify-result and fail to dev-event. Learning accrues without burning Big Brain on every build.",
    accent: "cyan",
  },
  {
    id: "small-brain",
    title: "Small Brain by default",
    description:
      "Routine pulses, ingest skips, and IDE paths stay tenant-local. CONVERGE escalates only when logic drift crosses policy.",
    accent: "violet",
  },
  {
    id: "savings",
    title: "Defensible token savings",
    description:
      "Redis counters for optimizer packs, Run Script reruns, verify→Vault, and CONVERGE cache — with a 24h ROI rollup you can show finance.",
    accent: "amber",
  },
];

export const DASHBOARD_QUICK_LINKS = [
  { label: "Workspace & extension", href: "/workspace" },
  { label: "Map a project", href: "/workspace?tab=setup" },
  { label: "Features & IDE", href: "/features" },
  { label: "Token savings", href: "#token-savings" },
] as const;
