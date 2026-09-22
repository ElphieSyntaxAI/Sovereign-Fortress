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
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  allowMockTelemetry,
  isProductionDeploy,
  isStagingDeploy,
} from "../lib/deploy-env.ts";
import { dropboxArchiveMockMode } from "../lib/services/dropbox-archive.ts";
import { ecoAggregatorClient } from "../lib/services/EcoAggregatorClient.ts";
import {
  emptyDashboardHealthReport,
  mapHealthReportToTickerEvents,
  mockDashboardHealthReport,
} from "../lib/services/dashboard-orchestration.ts";
import { telemetryService } from "../lib/services/TelemetryService.ts";

function withEnv(vars: Record<string, string | undefined>, fn: () => void | Promise<void>) {
  const prev: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) {
    prev[key] = process.env[key];
    const next = vars[key];
    if (next === undefined) delete process.env[key];
    else process.env[key] = next;
  }
  const restore = () => {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
  const result = fn();
  if (result && typeof (result as Promise<void>).then === "function") {
    return (result as Promise<void>).finally(restore);
  }
  restore();
}

describe("production mock-data gate", () => {
  test("production deploy refuses mock telemetry even if flags ask for it", () => {
    assert.equal(
      isProductionDeploy({ NODE_ENV: "production", DEPLOY_ENV: "production" }),
      true
    );
    assert.equal(isStagingDeploy({ DEPLOY_ENV: "staging", NODE_ENV: "production" }), true);
    assert.equal(
      allowMockTelemetry({ NODE_ENV: "production", DEPLOY_ENV: "production" }),
      false
    );
    assert.equal(allowMockTelemetry({ NODE_ENV: "test" }), true);
    assert.equal(allowMockTelemetry({ NODE_ENV: "production", DEPLOY_ENV: "staging" }), true);
  });

  test("dropbox archive never mocks on production", () => {
    assert.equal(
      dropboxArchiveMockMode({ NODE_ENV: "production", DEPLOY_ENV: "production" }),
      false
    );
    assert.equal(
      dropboxArchiveMockMode({
        NODE_ENV: "production",
        DEPLOY_ENV: "production",
        MSGF_DROPBOX_ARCHIVE_MOCK: "1",
      }),
      false
    );
  });

  test("ticker mapping does not attach fabricated savings", () => {
    const events = mapHealthReportToTickerEvents(mockDashboardHealthReport());
    for (const event of events) {
      assert.equal(event.token_savings_pct, undefined);
      assert.equal(event.eco_metrics, undefined);
      assert.notEqual(event.source, "v32_mock_stream");
    }
    const empty = mapHealthReportToTickerEvents(emptyDashboardHealthReport());
    assert.equal(empty.length, 0);
  });

  test("production Cloud Run returns empty live ticker instead of demo tenants", async () => {
    await withEnv(
      {
        NODE_ENV: "production",
        DEPLOY_ENV: "production",
        REDIS_URL: undefined,
        NEXT_PUBLIC_SUPABASE_URL: undefined,
        SUPABASE_URL: undefined,
        SUPABASE_SERVICE_ROLE_KEY: undefined,
      },
      async () => {
        const stream = await telemetryService.getNotificationStream(undefined);
        assert.equal(stream.mode, "live");
        assert.equal(stream.events.length, 0);
        const digest = await telemetryService.generateDailyDigest(undefined);
        assert.equal(digest.mode, "live");
        assert.equal(digest.report.repository_health_grid.length, 0);
        assert.equal(digest.report.financial_overhead_summary.total_token_compute_saved_by_p5, 0);
      }
    );
  });

  test("production eco leaderboard is empty live, not seeded mock tenants", async () => {
    await withEnv({ NODE_ENV: "production", DEPLOY_ENV: "production" }, async () => {
      const board = await ecoAggregatorClient.getLeaderboard(undefined);
      assert.equal(board.source, "live");
      assert.equal(board.tenants.length, 0);
      assert.equal(board.totals.co2e_prevented_metric_tons, 0);
    });
  });
});
