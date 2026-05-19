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
 * Distribution Build ID: MSGF-b4602b0-20260519T165710Z-internal
 */
/**
 * /products/education — "Find out more" detail page for Syntax Education.
 * Source of truth: docs/syntax-education/ROADMAP.md + syntax_education_pillars.md.
 */
import type { Metadata } from "next";

import { ProductDetailShell } from "@/app/_components/products/ProductDetailShell";

export const metadata: Metadata = {
  title: "Syntax Education · Elphie Syntax",
  description:
    "Socratic sandbox with grade-aware AI Allowance. Layered Workspace Control, Canvas LTI 1.3, Human Effort Certificate, approved curriculum slicing, and reading dependency triggers.",
};

export default function Page() {
  const liveUrl =
    process.env.EDUCATION_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_EDUCATION_APP_URL?.trim() ||
    "https://syntaxeducates.elphiesyntax.com";

  return (
    <ProductDetailShell
      tone="topaz"
      eyebrow="K–12 · LTI 1.3 · Utah-aware"
      title="Syntax Education"
      tagline="Layered Workspace Control: permanent grade-cohort toolbox (Layer A) plus teacher-set AI Allowance regulator (Layer B). District-approved curriculum slicing, Canvas LTI 1.3, and a Human Effort Certificate that survives the SpeedGrader handoff."
      vision="Syntax Education is an MSGF-shaped product under tenant_education. P1 owns AI Allowance + Utah S.B. 149 / H.B. 273 HALTs; P2 sequences Socratic milestones including the reading dependency trigger; P3 handles Canvas LTI 1.3 + the cryptographic privacy gate; P4 captures “The Call” telemetry with degraded modes for sandboxed hosts; P5 hosts the dual-pane sandbox; and P6 stores the genealogical 1.1.1 learning breakdown index, district curriculum shards, and the Citation Hall."
      liveUrl={liveUrl}
      liveLabel="Open Syntax Education"
      roadmapDocPath="docs/syntax-education/ROADMAP.md"
      metrics={[
        { label: "Pillars", value: "6", hint: "Mapped to MSGF P1–P6" },
        { label: "AI Allowance", value: "L0 → L4", hint: "Zero · Resource · Scaffold · Socratic · Sandbox" },
        { label: "Phases", value: "3", hint: "ELA/History · Math/Sci · Scale & compliance" },
        { label: "External hosts", value: "GW + M365", hint: "Google Workspace · Microsoft 365 · MV3" },
      ]}
      phases={[
        {
          label: "Phase 1 — Core MVP",
          status: "Wiring",
          highlights: [
            "Socratic Sandbox dual-pane UI + “The Call” keystroke hook (P4)",
            "Baseline HAL → Human Effort Score with paste / injection defense",
            "Static context RAG (one workbook) over pillar_vectors (P6)",
            "Canvas LTI 1.3 SSO + Human Effort Certificate via AGS passback",
            "Utah S.B. 149 disclosure screen + AI Allowance levels (P1 / P2)",
          ],
        },
        {
          label: "Phase 2 — Cross-curricular",
          status: "In flight",
          highlights: [
            "Math multi-step latency tracker + science lab report RAG",
            "Parent / teacher dashboards (Resilience vs Friction)",
            "Subject-specific model routing + cohort friction heat map",
            "Google Workspace add-on + Microsoft 365 add-in (ecosystem_source)",
            "Active session focus monitor + embedded research portal",
            "Degraded telemetry modes — CELL_MUTATION · FOCUS_DURATION",
          ],
        },
        {
          label: "Phase 3 — Scale & Compliance",
          status: "Planned",
          highlights: [
            "K–3 print worksheets hub (H.B. 273) — offline PDF generation",
            "Admin legal governance dashboard — FERPA / COPPA flags",
            "Citation Hall Engine — 3.0_RESEARCH lineage + trusted-domain registry",
            "Admin curriculum catalog ingestion + friction-gap recommender",
            "Teacher tree picker · resource_context_id slicing · Socratic boundary sync",
            "Reading dependency trigger — un-skippable focus block before composition",
          ],
        },
      ]}
      pillarRows={[
        { pillar: "P1", capability: "AI Allowance Regulator + Utah HALTs", notes: "Cross-tenant catalog guardrail §2.1.4" },
        { pillar: "P2", capability: "Milestone gates + reading dependency", notes: "Verified focus block before composition §2.2.1" },
        { pillar: "P3", capability: "Canvas LTI 1.3 + privacy gate", notes: "De-identified anonymous tokens" },
        { pillar: "P4", capability: "“The Call” telemetry + ecosystem_source", notes: "GOOGLE_EDIT · MS_OFFICE_EDIT · SANDBOX_NATIVE" },
        { pillar: "P5", capability: "Layered Workspace Canvas + Reader pane", notes: "Layer A toolbox · Layer B chat shell" },
        { pillar: "P6", capability: "Curriculum shards + Citation Hall", notes: "match_education_curriculum_shards (resource scope)" },
      ]}
      footnotes={[
        "Source: docs/syntax-education/ROADMAP.md · pillars: syntax_education_pillars.md · masterdoc §4 + §3",
        "Tenant: tenant_education / syntax_education · MSGF brain shared with Author Ecosystem.",
      ]}
    />
  );
}
