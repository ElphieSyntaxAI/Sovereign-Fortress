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
 * /products/msgf — "Find out more" detail page for the MSGF (Gated AI) surface.
 * Source of truth: docs/msgf/MSGF_V1_ROADMAP.md (V3.2-ULTRA master directive).
 */
import type { Metadata } from "next";

import { ProductDetailShell } from "@/app/_components/products/ProductDetailShell";

export const metadata: Metadata = {
  title: "MSGF — AI gateway · Elphie Syntax",
  description:
    "MSGF is an AI gateway: six policy domains, IDE verify, model routing and consensus, audit console, Session Replay, Sentry quarantine, Workspace SSO, SIEM, and defensible token-cost reporting.",
};

export default function Page() {
  const liveUrl =
    process.env.MSGF_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_MSGF_APP_URL?.trim() ||
    "https://elphiesgatedai.elphiesyntax.com";

  return (
    <ProductDetailShell
      tone="emerald"
      platformId="msgf"
      eyebrow="AI gateway"
      title="MSGF"
      tagline="AI gateway with context governance. Six policy domains, IDE verify, model routing and consensus, signed human-in-the-loop review, Session Replay, SIEM, Sentry quarantine, Workspace SSO, and optional post-quantum Vault envelopes."
      vision="MSGF 1.0 is an AI gateway any application can adopt. For Elphie Syntax products it is the shared governance layer behind Author Ecosystem and Syntax Education. For the market, MSGF is a standalone product: subscribe, send code or logic deltas through governed requests, ingest knowledge into isolated domains, and receive tiered audits without running your own consensus stack."
      liveUrl={liveUrl}
      liveLabel="Open MSGF console"
      roadmapDocPath="docs/msgf/MSGF_V1_ROADMAP.md"
      metrics={[
        { label: "Pipeline", value: "Seven steps", hint: "SWEEP → PERSIST" },
        { label: "Consensus", value: "TRI + Grok", hint: "Claude · Gemini · Grok" },
        { label: "Ops glue", value: "Audit · SIEM", hint: "Replay · budgets · SSO" },
        { label: "Crypto", value: "Hybrid PQ", hint: "ML-KEM + ML-DSA when enabled" },
      ]}
      phases={[
        {
          label: "Policy-domain persistence",
          status: "In flight",
          highlights: [
            "P1 Static Ledger (msgf-legal) — immutable laws, HALT on violation",
            "P4 State Ledger (state_beats, p4_hal_ledger) — flight recorder + hot slices",
            "P6 Constraint Ledger (pillar_vectors) — Vault / Hall via pgvector 1536",
          ],
        },
        {
          label: "IDE extension — Pulse Guard",
          status: "Shipped",
          highlights: [
            "0-token prompt optimizer (SOLO_FAST) + Run Scripts + Safe Build",
            "verify-result → Vault; repeated fail → Hall; deploy-gate for CI",
            "Token savings dashboard + CONVERGE model preset picker",
          ],
        },
        {
          label: "Routing + three-model consensus",
          status: "Active",
          highlights: [
            "Cost-efficient dual presets: Claude+Gemini, Claude+Grok, Gemini+Grok",
            "Frontier three-model consensus (Claude + Gemini + Grok) on high drift",
            "Human notify on high original drift (≥0.45), no majority, or non-human flags",
          ],
        },
        {
          label: "Integrations — Sentry · SSO · SIEM",
          status: "Shipped (configure to go live)",
          highlights: [
            "Sentry issues → Vault quarantine on /admin/ops (no silent auto-Hall)",
            "Google Workspace SSO + company domains + signed ARBITRATE audits",
            "OTel JSON SIEM webhook + heartbeat batch drain",
          ],
        },
        {
          label: "Governance audit platform",
          status: "Shipped",
          highlights: [
            "Audit hub timeline · Session Replay / harm ledger · most-used resources",
            "Model fitness + prompt templates · diff impact · tenant budgets / circuit breaker",
            "SIEM OTel webhook export · trusted-OSS bulk ARBITRATE · human-proof RED/harm HITL",
          ],
        },
        {
          label: "Security — post-quantum envelopes",
          status: "Shipped (flagged)",
          highlights: [
            "Hybrid KEM (X25519 + ML-KEM-768) vault envelopes when MSGF_HYBRID_KEM_ENABLED=1",
            "HAL v2 ML-DSA-65 authorship certificates",
            "Platform PQ-TLS remains an infra checklist — complementary, not replaced",
          ],
        },
        {
          label: "PERSIST + lifecycle — Vault writes, Hall purge",
          status: "Hardening",
          highlights: [
            "Approved deltas persisted to Vault; redundant hot state trimmed",
            "Hall LOW-tier entries auto-purged after 30 days for fast vector search",
            "Stripe entitlements for paid go-live after identity + smoke",
          ],
        },
      ]}
      pillarRows={[
        { pillar: "P1", capability: "Static Ledger · immutable laws", notes: "msgf-legal, security migrations" },
        { pillar: "P2", capability: "Flow Sequence · build / dependency", notes: "Pulse + TRI CONVERGE" },
        { pillar: "P3", capability: "Entity Profiles · roles + tenants", notes: "SSO, Stripe, signing invites" },
        { pillar: "P4", capability: "State Ledger · hot + cold beats", notes: "Redis active slice, p4_state_ledger" },
        { pillar: "P5", capability: "Local Variables · per-tenant config", notes: "consensus presets, BYOK keys" },
        { pillar: "P6", capability: "Constraint Ledger · Vault vs Hall", notes: "Sentry quarantine, hybrid PQ envelopes" },
      ]}
      footnotes={[
        "Source: docs/msgf/MSGF_V1_ROADMAP.md · docs/integrations/technical-specs/MSGF_SENTRY.md · docs/integrations/technical-specs/MSGF_SIGNING.md · docs/msgf/technical-specs/MSGF_PQC_CRYPTO_AUDIT.md",
        "Primary spec: docs/msgf/MSGF_V1_ROADMAP.md",
      ]}
    />
  );
}
