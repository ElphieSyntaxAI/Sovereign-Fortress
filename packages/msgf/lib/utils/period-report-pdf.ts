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
/**
 * Minimal text PDF builder for period savings reports (no external PDF dependency).
 */

import type { PeriodSavingsReportRow } from "@/lib/services/period-savings-reports";
import type { PeriodSavingsReportsBundle } from "@/lib/services/period-savings-reports";

function escapePdf(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function fmt(n: number): string {
  return Math.floor(n).toLocaleString("en-US");
}

function lineForWeekly(row: PeriodSavingsReportRow): string[] {
  return [
    `${row.period_label} (${row.period_key})`,
    `  Range: ${row.period_start} to ${row.period_end}  [${row.source}]`,
    `  Consumed (metered): ${fmt(row.tokens_consumed_metered)}`,
    `  Saved (proven):     ${fmt(row.tokens_saved_proven)}`,
    `  Ops estimate:       ${fmt(row.tokens_saved_estimated)}  (not used for eco)`,
    `  Provider calls:     ${fmt(row.provider_calls)}`,
    `  Shadow projected $: $${row.shadow_projected_usd.toFixed(4)} (projected — not proven eco)`,
    row.eco_claimable
      ? `  Eco (proven): ${row.eco_metrics.grid_compute_prevented_kwh} kWh · ${row.eco_metrics.co2e_offset_lbs} lbs CO2e · ${row.eco_metrics.freshwater_conserved_gallons} gal`
      : `  Eco: not claimable yet (need proven avoidance)`,
    "",
  ];
}

function lineForMonthly(row: PeriodSavingsReportRow): string[] {
  return [
    `${row.period_label} (${row.period_key})`,
    `  Consumed ${fmt(row.tokens_consumed_metered)} | Proven saved ${fmt(row.tokens_saved_proven)} | Ops est ${fmt(row.tokens_saved_estimated)} | Calls ${fmt(row.provider_calls)}`,
    `  Shadow projected USD $${row.shadow_projected_usd.toFixed(4)} (not proven eco)`,
    row.eco_claimable
      ? `  Eco kWh ${row.eco_metrics.grid_compute_prevented_kwh} | Logged ${row.logged_at}`
      : `  Eco — | Logged ${row.logged_at}`,
    "",
  ];
}

export function buildPeriodSavingsReportLines(
  bundle: PeriodSavingsReportsBundle,
  scope: "all" | "weekly" | "monthly" = "all"
): string[] {
  const generated = new Date().toISOString();
  const lines: string[] = [
    "MSGF — Consumption & Savings Report",
    `Tenant: ${bundle.tenant_id}`,
    `Generated: ${generated}`,
    "",
  ];

  if (scope === "all" || scope === "weekly") {
    lines.push("=== Last 3 weekly reports ===", "");
    if (!bundle.weekly.length) {
      lines.push("(No weekly activity yet.)", "");
    } else {
      for (const row of bundle.weekly) lines.push(...lineForWeekly(row));
    }
  }

  if (scope === "all" || scope === "monthly") {
    lines.push("=== Monthly history ===", "");
    if (!bundle.monthly.length) {
      lines.push("(No monthly rows yet.)", "");
    } else {
      for (const row of bundle.monthly) lines.push(...lineForMonthly(row));
    }
  }

  lines.push("=== Notes ===", "");
  lines.push(bundle.disclaimer || "Proven avoided tokens only feed public eco claims.");
  lines.push("");
  lines.push("External IDE LLM subscriptions are out-of-band and not included in metered totals.");
  return lines;
}

/**
 * Build a multi-page A4-ish PDF (612x792) from plain text lines.
 */
export function buildSimpleTextPdf(lines: string[], title = "MSGF Report"): Uint8Array {
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 48;
  const fontSize = 10;
  const leading = 14;
  const usableHeight = pageHeight - margin * 2;
  const linesPerPage = Math.max(1, Math.floor(usableHeight / leading));

  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage));
  }
  if (!pages.length) pages.push([title]);

  const objects: string[] = [];
  const addObj = (body: string): number => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = addObj(""); // placeholder
  const pagesId = addObj(""); // placeholder
  const fontId = addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  const pageIds: number[] = [];
  const contentIds: number[] = [];

  for (const pageLines of pages) {
    const contentId = addObj(""); // placeholder
    contentIds.push(contentId);
    const pageId = addObj(""); // placeholder
    pageIds.push(pageId);

    let y = pageHeight - margin;
    const ops: string[] = ["BT", `/F1 ${fontSize} Tf`, `${margin} ${y} Td`, `${leading} TL`];
    pageLines.forEach((line, idx) => {
      const safe = escapePdf(line.slice(0, 110));
      if (idx === 0) {
        ops.push(`(${safe}) Tj`);
      } else {
        ops.push(`T* (${safe}) Tj`);
      }
    });
    ops.push("ET");
    const stream = ops.join("\n");
    objects[contentId - 1] =
      `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`;
    objects[pageId - 1] =
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
      `/Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
  }

  objects[pagesId - 1] =
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const push = (s: string) => chunks.push(encoder.encode(s));

  push("%PDF-1.4\n");
  const offsets: number[] = [0];
  let offset = chunks.reduce((n, c) => n + c.length, 0);

  for (let i = 0; i < objects.length; i++) {
    offsets.push(offset);
    const obj = `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
    const bytes = encoder.encode(obj);
    chunks.push(bytes);
    offset += bytes.length;
  }

  const xrefStart = offset;
  push(`xref\n0 ${objects.length + 1}\n`);
  push("0000000000 65535 f \n");
  for (let i = 1; i <= objects.length; i++) {
    push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  }
  push(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\n`);
  push(`startxref\n${xrefStart}\n%%EOF\n`);

  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

export function buildPeriodSavingsReportPdf(
  bundle: PeriodSavingsReportsBundle,
  scope: "all" | "weekly" | "monthly" = "all"
): Uint8Array {
  const lines = buildPeriodSavingsReportLines(bundle, scope);
  return buildSimpleTextPdf(lines, "MSGF Consumption & Savings Report");
}
