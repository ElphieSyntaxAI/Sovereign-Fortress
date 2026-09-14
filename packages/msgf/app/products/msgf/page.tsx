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
 * /products/msgf — "Find out more" detail page for the MSGF (Gated AI) surface.
 * Source of truth: docs/MSGF_V1_ROADMAP.md (V3.2-ULTRA master directive).
 */
import type { Metadata } from "next";

import { ProductDetailShell } from "@/app/_components/products/ProductDetailShell";

export const metadata: Metadata = {
  title: "MSGF — Gated AI · Elphie Syntax",
  description:
    "MSGF V3.2: six pillars, IDE Command Center, Grok-aware TRI consensus, Sentry→Vault quarantine, DocuSign/Dropbox Sign, Workspace SSO, and defensible token savings.",
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
      eyebrow="Brain · Engine"
      title="MSGF — Gated AI"
      tagline="Stateful, self-defending AI orchestration. Six pillars, IDE verify, Grok-aware TRI CONVERGE, Sentry quarantine, DocuSign / Dropbox Sign, and quantum-ready hybrid vault crypto."
      vision="MSGF 1.0 delivers a stateful, self-defending AI orchestration layer that any application can adopt. For Elphie Syntax products it is the brain behind the Author Ecosystem and Syntax Education. For the market, MSGF at elphiesgatedai.elphiesyntax.com is a standalone gated-AI product — subscribe, send keystroke or logic deltas through Pulse, ingest knowledge into pillars, and receive tiered audits without running your own consensus stack."
      liveUrl={liveUrl}
      liveLabel="Open MSGF console"
      roadmapDocPath="docs/MSGF_V1_ROADMAP.md"
      metrics={[
        { label: "Master directive", value: "V3.2-ULTRA", hint: "SWEEP → PERSIST (7 steps)" },
        { label: "Consensus", value: "TRI + Grok", hint: "Claude · Gemini · Grok" },
        { label: "Ops glue", value: "Sentry · Sign", hint: "Quarantine · e-sign invites" },
        { label: "Crypto", value: "Hybrid PQ", hint: "ML-KEM + ML-DSA when enabled" },
      ]}
      phases={[
        {
          label: "SHARD — six-pillar persistence",
          status: "In flight",
          highlights: [
            "P1 Static Ledger (msgf-legal) — immutable laws, HALT on violation",
            "P4 State Ledger (state_beats, p4_hal_ledger) — flight recorder + hot slices",
            "P6 Constraint Ledger (pillar_vectors) — Vault / Hall via pgvector 1536",
          ],
        },
        {
          label: "IDE Command Center — Pulse Guard",
          status: "Shipped",
          highlights: [
            "0-token prompt optimizer (SOLO_FAST) + Run Scripts + Safe Build",
            "verify-result → Vault; repeated fail → Hall; deploy-gate for CI",
            "Token savings dashboard + CONVERGE model preset picker",
          ],
        },
        {
          label: "CONVERGE + ARBITRATE — TRI majority",
          status: "Active",
          highlights: [
            "Small Brain dual presets: Claude+Gemini, Claude+Grok, Gemini+Grok",
            "Big Brain TRI majority (Claude + Gemini + Grok) on high drift",
            "Human notify on high original drift (≥0.45), no majority, or NON_HUMAN",
          ],
        },
        {
          label: "Integrations — Sentry · e-sign · SSO",
          status: "Shipped (configure to go live)",
          highlights: [
            "Sentry issues → Vault quarantine on /admin/ops (no silent auto-Hall)",
            "DocuSign or Dropbox Sign for team invites + webhook queue",
            "Google Workspace SSO, company domains, signed ARBITRATE audits",
          ],
        },
        {
          label: "Security — quantum-ready envelopes",
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
        "Source: docs/MSGF_V1_ROADMAP.md · MSGF_SENTRY.md · MSGF_SIGNING.md · MSGF_PQC_CRYPTO_AUDIT.md",
        "Primary spec: docs/references/MSGF_v3_2_masterdoc.pdf (V3.2-ULTRA)",
      ]}
    />
  );
}
