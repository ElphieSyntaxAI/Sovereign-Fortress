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
 * Shipped MSGF capabilities — single source for marketing + dashboard copy.
 * Keep in sync with docs/msgf/marketing/MSGF_PRODUCT_OVERVIEW.md §2–§4.
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
    body: "Map the repo, mint an IDE token, and confirm the extension is healthy.",
  },
  {
    step: "02",
    title: "Optimize",
    body: "Compile a local prompt with file attachments and required verify steps — no model call.",
  },
  {
    step: "03",
    title: "Verify",
    body: "Run allowlisted tests or a local build. Pass writes to Vault; repeated fail writes to Hall.",
  },
  {
    step: "04",
    title: "Govern",
    body: "Small Brain routing by default; Big Brain consensus on high drift; shadow then enforce; human-in-the-loop review; SIEM.",
  },
] as const;

/** Primary grid on / and /features — core developer loop. */
export const SHIPPED_FEATURE_CARDS: ShippedFeature[] = [
  {
    id: "command-center",
    title: "IDE extension panel",
    description:
      "Pulse Guard is IDE dev-environment protection for keystrokes. Cursor or VS Code: connection health, local prompt compiler, allowlisted verify scripts, Safe Build, and remediation tools.",
    accent: "emerald",
  },
  {
    id: "verify-loop",
    title: "Verify loop (Vault / Hall)",
    description:
      "Allowlisted local commands write passing results to Vault (verified state memory) and repeated failures to Hall — then unlock the deploy gate.",
    accent: "cyan",
  },
  {
    id: "model-presets",
    title: "Model routing + consensus",
    description:
      "Default pair is Claude + Gemini. Optional Claude + Grok or Gemini + Grok. High drift can take a three-model majority (Claude + Gemini + Grok). Humans are notified only above the drift threshold.",
    accent: "violet",
  },
  {
    id: "savings",
    title: "Defensible token-cost reporting",
    description:
      "Metered provider usage, proven avoidance (not estimates), weekly and monthly reports with PDF, and shadow-mode projected spend kept separate from public eco metrics.",
    accent: "amber",
  },
  {
    id: "shadow-proxy",
    title: "Shadow mode → enforcement",
    description:
      "Point the SDK at /api/v1 with x-msgf-mode: shadow. Shadow mode is observe-only. Active mode applies the Active Cache, context gating, and live reputation.",
    accent: "violet",
  },
  {
    id: "sentry-quarantine",
    title: "Sentry → context quarantine",
    description:
      "Sentry crashes match approved records in Vault and mark them quarantined (no silent move to Hall). Operators restore or demote on /admin/ops — runtime monitoring linked to governance memory.",
    accent: "emerald",
  },
  {
    id: "workspace-sso",
    title: "Workspace SSO",
    description:
      "Company domains and Google Workspace SSO for corporate seats. Consumer Gmail lands on invite-only — not a silent tenant.",
    accent: "cyan",
  },
];

/** Extra enterprise / platform cards (features page + product detail). */
export const ENTERPRISE_FEATURE_CARDS: ShippedFeature[] = [
  {
    id: "tri-converge",
    title: "Three-model consensus",
    description:
      "Big Brain can take a Claude + Gemini + Grok majority when drift is high. Split votes no longer force human review when a majority agrees.",
    accent: "violet",
  },
  {
    id: "signed-hitl",
    title: "Signed human-in-the-loop audits",
    description:
      "Skip-gateway and arbitration decisions leave HMAC-signed, hash-chained snapshots — a compliance trail of who approved what on /admin/ops.",
    accent: "amber",
  },
  {
    id: "deploy-gate",
    title: "Deploy gate",
    description:
      "CI checks GET /api/msgf/deploy-gate for your project. Ship only when verify is green for that isolation boundary.",
    accent: "emerald",
  },
  {
    id: "tenant-isolation",
    title: "Compound tenant isolation",
    description:
      "Every vector is scoped by project and subpath — agencies and monorepos keep client and app memory from crossing silos.",
    accent: "cyan",
  },
  {
    id: "hybrid-crypto",
    title: "Post-quantum envelopes",
    description:
      "Optional hybrid post-quantum envelopes (X25519 + ML-KEM-768) for Vault secrets and ML-DSA-65 authorship certificates. HTTPS post-quantum only when the load-balancer SSL policy is enabled — not Pulse, Redis, or Supabase.",
    accent: "violet",
  },
  {
    id: "ops-tower",
    title: "Admin ops console",
    description:
      "One /admin/ops surface: audit timeline, Session Replay, security event log, most-used resources, model fitness, diff impact, tenant budgets, SIEM export, trusted-OSS bulk review, and Sentry quarantine.",
    accent: "amber",
  },
  {
    id: "governance-audit",
    title: "Platform governance audit",
    description:
      "Hashed resource-usage rankings, unified audit events, prompt-session forensics, and human-in-the-loop gates — policy failures and harm always open review; budgets never bypass safety.",
    accent: "cyan",
  },
  {
    id: "siem-budgets",
    title: "Budgets + SIEM export",
    description:
      "Hard monthly spend caps and rapid-retry circuit breakers before gateway dispatch, plus async OpenTelemetry JSON webhooks to your SIEM — primary paths never wait on export.",
    accent: "emerald",
  },
];

export const DASHBOARD_QUICK_LINKS = [
  { label: "Workspace & extension", href: "/workspace" },
  { label: "Map a project", href: "/setup/projects" },
  { label: "Features & IDE", href: "/features" },
  { label: "Ops audit hub", href: "/admin/ops#audit-hub" },
  { label: "Session Replay", href: "/admin/ops#session-replay" },
  { label: "Routing presets", href: "#token-savings" },
  { label: "Token cost", href: "#token-savings" },
  { label: "Reports", href: "/dashboard/daily-reports" },
] as const;
