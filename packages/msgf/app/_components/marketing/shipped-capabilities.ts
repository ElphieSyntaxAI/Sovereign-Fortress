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
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */
/**
 * Shipped MSGF capabilities — single source for marketing + dashboard copy.
 * Keep in sync with docs/MSGF_PRODUCT_OVERVIEW.md §2–§4.
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
    body: "Map project_origin · msgf_ide_* token · Command Center health goes green.",
  },
  {
    step: "02",
    title: "Optimize",
    body: "0-token prompt with @-attachments and mandatory verify rules — local SOLO_FAST only.",
  },
  {
    step: "03",
    title: "Verify",
    body: "Run Scripts or Safe Build · pass → Vault · repeat fail → Hall · deploy-gate.",
  },
  {
    step: "04",
    title: "Govern",
    body: "Small Brain dual presets · TRI Big Brain on high drift · Shadow→Active gateway · Sentry quarantine · signed HITL.",
  },
] as const;

/** Primary grid on / and /features — core developer loop. */
export const SHIPPED_FEATURE_CARDS: ShippedFeature[] = [
  {
    id: "command-center",
    title: "IDE Command Center",
    description:
      "MSGF Pulse Guard sidebar: connection health, prompt optimizer, Run Scripts, Safe Build (async preflight), and advanced heal ops in Cursor or VS Code.",
    accent: "emerald",
  },
  {
    id: "verify-loop",
    title: "Vault · Hall verify loop",
    description:
      "Allowlisted execFile runs sync pass to verify-result and fail to dev-event. Learning accrues without burning Big Brain on every build — then unlock deploy-gate.",
    accent: "cyan",
  },
  {
    id: "model-presets",
    title: "Model presets + Grok",
    description:
      "Pick your Small Brain pair: Claude+Gemini (default), Claude+Grok, or Gemini+Grok. Big Brain uses TRI majority (Claude + Gemini + Grok) when drift is high — humans notify only above the high-drift threshold.",
    accent: "violet",
  },
  {
    id: "savings",
    title: "Defensible token savings",
    description:
      "Metered provider usage, proven avoidance (not estimates), weekly/monthly Reports + PDF, and Shadow Proxy projected $ kept separate from public eco.",
    accent: "amber",
  },
  {
    id: "shadow-proxy",
    title: "Shadow Proxy → Active Governance",
    description:
      "Point OpenAI or Anthropic SDKs at /api/v1. Shadow mode proves projected bill savings with zero added latency; Active mode applies cache, state-gating, and sharded prompts — license-bound auth, never spoofable tenant headers.",
    accent: "violet",
  },
  {
    id: "sentry-quarantine",
    title: "Sentry → Vault quarantine",
    description:
      "Sentry crashes match Vault wins and mark them QUARANTINED (no silent auto-Hall). Ops restore or demote on /admin/ops — runtime monitoring links to governance memory.",
    accent: "emerald",
  },
  {
    id: "esign-sso",
    title: "E-sign + Workspace SSO",
    description:
      "Team invites via DocuSign or Dropbox Sign, company domains, and Google Workspace SSO. Signing webhooks and ops panels ship ready — configure keys when you go live.",
    accent: "cyan",
  },
];

/** Extra enterprise / platform cards (features page + product detail). */
export const ENTERPRISE_FEATURE_CARDS: ShippedFeature[] = [
  {
    id: "tri-converge",
    title: "TRI majority CONVERGE",
    description:
      "Optional T1→T3 cost ladder for risk paths. Platform Big Brain: Claude + Gemini + Grok majority when enabled. Model splits alone no longer force HITL when majority agrees.",
    accent: "violet",
  },
  {
    id: "signed-hitl",
    title: "Signed HITL audits",
    description:
      "Skip-MSGF and ARBITRATE decisions leave HMAC-signed, hash-chained snapshots — a compliance-ready trail of who approved what on /admin/ops.",
    accent: "amber",
  },
  {
    id: "deploy-gate",
    title: "Deploy gate",
    description:
      "CI checks GET /api/msgf/deploy-gate for your project_origin. Ship only when verify is green for that silo.",
    accent: "emerald",
  },
  {
    id: "tenant-isolation",
    title: "Compound tenant isolation",
    description:
      "Every vector scoped by project_origin + subpath — agencies and monorepos keep client and app memory from bleeding across silos.",
    accent: "cyan",
  },
  {
    id: "hybrid-crypto",
    title: "Quantum-ready security",
    description:
      "Optional hybrid post-quantum envelopes (X25519 + ML-KEM-768) for vault secrets and ML-DSA-65 authorship certificates — future-ready crypto without waiting on platform PQ-TLS.",
    accent: "violet",
  },
  {
    id: "ops-tower",
    title: "Admin ops control tower",
    description:
      "ARBITRATE queue, Vault quarantine, Sentry issues, DocuSign envelopes, strategy matrix, and remediation circuit — one /admin/ops surface for operators.",
    accent: "amber",
  },
];

export const DASHBOARD_QUICK_LINKS = [
  { label: "Workspace & extension", href: "/workspace" },
  { label: "Map a project", href: "/setup/projects" },
  { label: "Features & IDE", href: "/features" },
  { label: "CONVERGE presets", href: "#token-savings" },
  { label: "Token savings", href: "#token-savings" },
  { label: "Reports", href: "/dashboard/daily-reports" },
] as const;
