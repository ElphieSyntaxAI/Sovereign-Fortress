/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
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
    "MSGF V3.2-ULTRA: stateful, self-defending AI orchestration with six isolated pillars, hot/cold storage, dual-model consensus, and mandatory human tie-breaker on RED disagreement.",
};

export default function Page() {
  return (
    <ProductDetailShell
      tone="emerald"
      eyebrow="Brain · Engine"
      title="MSGF — Gated AI"
      tagline="Stateful, self-defending AI orchestration. Six isolated pillars, 1.1.1 genealogical lineage, Redis hot + Postgres cold, dual-model consensus, and human tie-breaker on RED disagreement."
      vision="MSGF 1.0 delivers a stateful, self-defending AI orchestration layer that any application can adopt. For Elphie Syntax products it is the brain behind the Author Ecosystem and Syntax Education. For the market, MSGF at elphiesgatedai.elphiesyntax.com is a standalone gated-AI product — subscribe, send keystroke or logic deltas through Pulse, ingest knowledge into pillars, and receive tiered audits without running your own consensus stack."
      liveUrl="https://elphiesgatedai.elphiesyntax.com"
      liveLabel="Open MSGF console"
      roadmapDocPath="docs/MSGF_V1_ROADMAP.md"
      metrics={[
        { label: "Master directive", value: "V3.2-ULTRA", hint: "SWEEP → PERSIST (7 steps)" },
        { label: "Pillars", value: "6", hint: "P1 Static · P6 Constraint" },
        { label: "Storage", value: "Hot + Cold", hint: "Redis · Postgres (pgvector 1536)" },
        { label: "Tiers", value: "RED / YEL / GRN", hint: "Immediate · 6h · 24h" },
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
          label: "DEFEND + CROSS-REF — shadow preflight",
          status: "Wired",
          highlights: [
            "msgf-shadow preFlightCheck against Vault + Hall before consensus",
            "1.1.1 genealogical lineage on every Fix Delta",
            "LOM disagreement test gating the Pulse path",
          ],
        },
        {
          label: "CONVERGE + ARBITRATE — dual-model consensus",
          status: "Active",
          highlights: [
            "Claude / Gemini consensus on RED critical deltas",
            "Human tie-breaker mandatory on disagreement or retry > 3",
            "ERR_RECURSION_LIMIT surfaced into the operations dashboard",
          ],
        },
        {
          label: "PERSIST + lifecycle — Vault writes, Hall purge",
          status: "Hardening",
          highlights: [
            "Approved deltas persisted to Vault; redundant hot state trimmed",
            "Hall LOW-tier entries auto-purged after 30 days for fast vector search",
            "Stripe entitlements + multi-tenant API for 1.0 standalone GA",
          ],
        },
      ]}
      pillarRows={[
        { pillar: "P1", capability: "Static Ledger · immutable laws", notes: "msgf-legal, security migrations" },
        { pillar: "P2", capability: "Flow Sequence · build / dependency", notes: "Pulse orchestration" },
        { pillar: "P3", capability: "Entity Profiles · roles + tenants", notes: "Supabase auth, Stripe entitlements" },
        { pillar: "P4", capability: "State Ledger · hot + cold beats", notes: "Redis active slice, p4_state_ledger" },
        { pillar: "P5", capability: "Local Variables · per-tenant config", notes: "tenant-manifest.json, UI shells" },
        { pillar: "P6", capability: "Constraint Ledger · Vault vs Hall", notes: "pgvector 1.1.1, 30d LOW purge" },
      ]}
      footnotes={[
        "Source: docs/MSGF_V1_ROADMAP.md · companion: docs/MONOREPO_PRODUCTS.md",
        "Primary spec: docs/references/MSGF_v3_2_masterdoc.pdf (V3.2-ULTRA)",
      ]}
    />
  );
}
