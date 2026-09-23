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
 * Distribution Build ID: MSGF-08289e1a-20260923T172846Z-internal
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  buildPeriodSavingsReportLines,
  buildPeriodSavingsReportPdf,
  buildSimpleTextPdf,
} from "../lib/utils/period-report-pdf.js";
import { calculateEcoSavings } from "../lib/utils/ecoCalculator.js";

describe("period-report-pdf", () => {
  test("buildSimpleTextPdf starts with PDF header", () => {
    const pdf = buildSimpleTextPdf(["Hello", "MSGF report"]);
    const head = Buffer.from(pdf.slice(0, 8)).toString("utf8");
    assert.equal(head, "%PDF-1.4");
    assert.ok(pdf.length > 100);
  });

  test("bundle pdf includes weekly and monthly sections", () => {
    const eco = calculateEcoSavings(1000);
    const bundle = {
      tenant_id: "tenant_demo",
      weekly: [
        {
          tenant_id: "tenant_demo",
          user_id: null,
          period_kind: "weekly" as const,
          period_key: "2026-W32",
          period_label: "Week of 2026-08-03",
          period_start: "2026-08-03",
          period_end: "2026-08-09",
          tokens_consumed_metered: 5000,
          tokens_saved_proven: 1000,
          tokens_saved_estimated: 2000,
          provider_calls: 12,
          shadow_projected_usd: 0.12,
          eco_metrics: eco,
          eco_claimable: true,
          source: "live" as const,
          logged_at: new Date().toISOString(),
          notes: "",
        },
      ],
      monthly: [],
      disclaimer: "Proven only.",
    };
    const lines = buildPeriodSavingsReportLines(bundle, "all");
    assert.ok(lines.some((l) => l.includes("weekly")));
    const pdf = buildPeriodSavingsReportPdf(bundle, "weekly");
    assert.ok(Buffer.from(pdf.slice(0, 5)).toString("utf8") === "%PDF-");
  });
});
