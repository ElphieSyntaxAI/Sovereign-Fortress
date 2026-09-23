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
 * Sustainable Compute Layer telemetry service.
 *
 * Live streams read Supabase. Fabricated demo tenants/events are local/staging
 * only (`allowMockTelemetry`). Production returns empty live data instead.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { allowMockTelemetry } from "@/lib/deploy-env";
import {
  emptyDashboardHealthReport,
  emptyTenantTelemetry24h,
  fetchTenantTelemetry24hFromSupabase,
  hasLiveDashboardDatabaseEnv,
  mapHealthReportToTickerEvents,
  mockDashboardHealthReport,
  mockTenantTelemetry24h,
  transformDailyNetworkReport,
  type DailyNetworkReport,
  type GlobalNotificationTickerEvent,
  type TenantTelemetry24h,
} from "@/lib/services/dashboard-orchestration";
import { healthService } from "@/lib/services/HealthService";
import { calculateEcoSavings, type EcoMetrics } from "@/lib/utils/ecoCalculator";

export type TelemetryServiceMode = "live" | "mock";

export type NotificationStreamResult = {
  mode: TelemetryServiceMode;
  generated_at: string;
  events: GlobalNotificationTickerEvent[];
};

export type DailyDigestResult = {
  mode: TelemetryServiceMode;
  report: DailyNetworkReport;
};

export class TelemetryService {
  private shouldUseMockData(): boolean {
    return allowMockTelemetry() && !hasLiveDashboardDatabaseEnv();
  }

  private mode(): TelemetryServiceMode {
    return this.shouldUseMockData() ? "mock" : "live";
  }

  async getNotificationStream(adminSupabase?: SupabaseClient): Promise<NotificationStreamResult> {
    const useMock = this.shouldUseMockData() || (allowMockTelemetry() && !adminSupabase);
    const report = useMock
      ? mockDashboardHealthReport()
      : adminSupabase
        ? await healthService.getPillarHealth(adminSupabase, { userId: null, lookbackHours: 24 })
        : emptyDashboardHealthReport();

    return {
      mode: useMock ? "mock" : "live",
      generated_at: report.generated_at,
      events: mapHealthReportToTickerEvents(report),
    };
  }

  async generateDailyDigest(adminSupabase?: SupabaseClient): Promise<DailyDigestResult> {
    const useMock = this.shouldUseMockData() || (allowMockTelemetry() && !adminSupabase);
    const telemetry = useMock
      ? mockTenantTelemetry24h()
      : adminSupabase
        ? await fetchTenantTelemetry24hFromSupabase(adminSupabase)
        : emptyTenantTelemetry24h();
    const report = transformDailyNetworkReport(telemetry);

    if (!useMock && adminSupabase) {
      await this.persistEcoMetrics(adminSupabase, report);
    }

    return {
      mode: useMock ? "mock" : "live",
      report,
    };
  }

  private async persistEcoMetrics(
    adminSupabase: SupabaseClient,
    report: DailyNetworkReport
  ): Promise<void> {
    const { error } = await adminSupabase.from("p4_narrative_logs").insert({
      tenant_id: "global_dashboard",
      actor_id: null,
      action_type: "P5_ECO_DAILY_DIGEST",
      message: "Sustainable Compute Layer daily eco metrics persisted.",
      severity: "Info",
      metadata: {
        pillar: "P5",
        ledger: "vault",
        index_type: "sustainable_compute_layer",
        eco_metrics: report.financial_overhead_summary.eco_metrics,
        environmental_footprint_series: report.environmental_footprint_series,
        token_compute_processed:
          report.financial_overhead_summary.total_token_compute_processed,
        token_compute_saved_by_p5:
          report.financial_overhead_summary.total_token_compute_saved_by_p5,
        p5_context_savings_pct:
          report.financial_overhead_summary.p5_context_savings_pct,
        generated_at: report.generated_at,
      },
    });

    if (error) {
      console.error("[TelemetryService] Failed to persist eco metrics.", {
        message: error.message,
      });
    }
  }

  enrichTenantTelemetry(telemetry: TenantTelemetry24h[]): Array<TenantTelemetry24h & { eco_metrics: EcoMetrics }> {
    return telemetry.map((tenant) => ({
      ...tenant,
      eco_metrics: calculateEcoSavings(tenant.token_compute_saved_by_p5),
    }));
  }
}

export const telemetryService = new TelemetryService();
