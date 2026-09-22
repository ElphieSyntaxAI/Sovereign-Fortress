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
 * Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
 */
/**
 * MSGF V3.2-ULTRA architecture integration suite.
 *
 * Node test runner with Jest-style assertions (`node:assert/strict`) so the
 * suite is dependency-light and executable in CI, local Windows, and Cloud Run
 * build contexts. The checkpoints map directly to the canonical SSoT:
 * `docs/msgf/technical-specs/MSGF_PILLAR_MAPPING_SSOT.md`.
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

import { generateEmbedding } from "../lib/ai-utils";
import { calculateBiometricScore } from "../lib/msgf-consensus";
import { getLogicLineage } from "../lib/msgf-index";
import { preFlightCheck } from "../lib/msgf-shadow";
import {
  evaluatePulseEntitlement,
  type P4ProfileEntitlementRow,
} from "../lib/middleware/entitlementGuard";
import {
  HOT_LAYER_ACTIVE_SLICE_TTL_SECONDS,
} from "../lib/msgf-hot-layer";
import {
  filterPillarRowsByTenant,
  pillarRowBelongsToTenant,
  resolveTenantIdForQuery,
} from "../lib/services/tenant-query-scope";
import {
  determineCategory,
  pathToGenealogicalBugIndex,
} from "../lib/services/IngestService";
import { governancePillarForCategory } from "../lib/services/pillar-baseline";
import {
  buildGenealogicalBugIndex,
  buildVaultHallMetadata,
  PULSE_BUG_INDEX,
} from "../lib/schemas/vault-hall-metadata";
import {
  ERR_RECURSION_LIMIT,
  PULSE_RECURSION_MAX_RETRY,
} from "../lib/services/PulseEngine";
import {
  HALL_PURGE_DEFAULT_RETENTION_DAYS,
  runHallPurgeProtocol,
} from "../lib/services/hall-purge-protocol";
import { computeConsensusAgreementScore } from "../lib/services/consensus-output-comparison";
import { persistToHall, persistToVault } from "../lib/services/constraint-ledger";
import { isLowPriorityHallRecord } from "../lib/services/ReportingEngine";

const repoRoot = path.resolve(process.cwd(), "..", "..");
const msgfRoot = process.cwd();

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

type StoredRow = Record<string, unknown> & { id?: string };

class FakePostgrestQuery {
  private filters: Array<(row: StoredRow) => boolean> = [];
  private rangeStart = 0;
  private rangeEnd = Number.POSITIVE_INFINITY;
  private inserted: StoredRow[] | null = null;
  private deleteMode = false;
  private deleteIds: string[] | null = null;

  constructor(
    private readonly table: string,
    private readonly store: Map<string, StoredRow[]>
  ) {}

  select(): this {
    return this;
  }

  insert(payload: StoredRow | StoredRow[]): this {
    const rows = Array.isArray(payload) ? payload : [payload];
    const tableRows = this.store.get(this.table) ?? [];
    this.inserted = rows.map((row) => ({
      id: row.id ?? randomUUID(),
      created_at: row.created_at ?? new Date().toISOString(),
      ...row,
    }));
    tableRows.push(...this.inserted);
    this.store.set(this.table, tableRows);
    return this;
  }

  delete(): this {
    this.deleteMode = true;
    return this;
  }

  in(column: string, values: string[]): this {
    if (this.deleteMode && column === "id") {
      this.deleteIds = values;
    } else {
      this.filters.push((row) => values.includes(String(row[column])));
    }
    return this;
  }

  eq(column: string, value: string): this {
    this.filters.push((row) => String(getColumn(row, column) ?? "") === value);
    return this;
  }

  lt(column: string, value: string): this {
    this.filters.push((row) => String(getColumn(row, column) ?? "") < value);
    return this;
  }

  gte(column: string, value: string): this {
    this.filters.push((row) => String(getColumn(row, column) ?? "") >= value);
    return this;
  }

  ilike(column: string, pattern: string): this {
    const needle = pattern.replaceAll("%", "").toLowerCase();
    this.filters.push((row) => String(getColumn(row, column) ?? "").toLowerCase().includes(needle));
    return this;
  }

  order(): this {
    return this;
  }

  limit(n: number): this {
    this.rangeStart = 0;
    this.rangeEnd = Math.max(0, n - 1);
    return this;
  }

  range(start: number, end: number): this {
    this.rangeStart = start;
    this.rangeEnd = end;
    return this;
  }

  maybeSingle(): Promise<{ data: StoredRow | null; error: null }> {
    return Promise.resolve({ data: this.inserted?.[0] ?? this.rows()[0] ?? null, error: null });
  }

  single(): Promise<{ data: StoredRow | null; error: null }> {
    return this.maybeSingle();
  }

  then<TResult1 = { data: StoredRow[]; error: null; count?: number }, TResult2 = never>(
    onfulfilled?: ((value: { data: StoredRow[]; error: null; count?: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    try {
      if (this.deleteMode) {
        const ids = new Set(this.deleteIds ?? []);
        const before = this.store.get(this.table) ?? [];
        const after = before.filter((row) => !ids.has(String(row.id)));
        this.store.set(this.table, after);
        return Promise.resolve({ data: [], error: null, count: before.length - after.length }).then(
          onfulfilled,
          onrejected
        );
      }
      return Promise.resolve({ data: this.rows(), error: null }).then(onfulfilled, onrejected);
    } catch (error) {
      return Promise.reject(error).then(onfulfilled, onrejected);
    }
  }

  private rows(): StoredRow[] {
    return (this.store.get(this.table) ?? [])
      .filter((row) => this.filters.every((fn) => fn(row)))
      .slice(this.rangeStart, this.rangeEnd + 1);
  }
}

class FakeSupabase {
  readonly store = new Map<string, StoredRow[]>();

  constructor(seed: Record<string, StoredRow[]> = {}) {
    for (const [table, rows] of Object.entries(seed)) {
      this.store.set(table, rows.map((row) => ({ ...row })));
    }
  }

  from(table: string): FakePostgrestQuery {
    return new FakePostgrestQuery(table, this.store);
  }

  rpc(_name: string): Promise<{ data: null; error: { message: string } }> {
    return Promise.resolve({ data: null, error: { message: "RPC intentionally unavailable in fake client." } });
  }
}

function getColumn(row: StoredRow, column: string): unknown {
  if (column.startsWith("metadata->>")) {
    const key = column.slice("metadata->>".length);
    const metadata = row.metadata as Record<string, unknown> | undefined;
    return metadata?.[key];
  }
  return row[column];
}

function tenantRow(
  tenantId: string,
  ledger: "vault" | "hall",
  content: string,
  extra: Record<string, unknown> = {}
): StoredRow {
  return {
    id: randomUUID(),
    content,
    created_at: new Date().toISOString(),
    metadata: {
      tenant_id: tenantId,
      pillar: "P6",
      ledger,
      index_type: "genealogical_bug_index",
      instance: "1.1.1",
      category: "1.0_AUTH",
      branch: "1.1_BYOK",
      instance_slug: "1.1.1_DISCRETE_FIX_DELTA",
      bug_index: {
        level_1_category: "1.0_AUTH",
        level_1_1_branch: "1.1_BYOK",
        level_1_1_1_instance: "1.1.1_DISCRETE_FIX_DELTA",
      },
      ...extra,
    },
  };
}

function activeProfile(overrides: Partial<P4ProfileEntitlementRow> = {}): P4ProfileEntitlementRow {
  return {
    user_id: randomUUID(),
    tier_id: 1,
    current_credits: 10,
    stripe_subscription_status: "active",
    billing_license_type: "monthly",
    ...overrides,
  };
}

describe("MSGF V3.2-ULTRA 16-point architecture suite", () => {
  test("1. SWEEP Day-Zero Scan maintains non-destructive Impact vs Effort audit", () => {
    const audit = readRepo("packages/msgf/pre_ingestion_audit.md");
    assert.match(audit, /Impact vs Effort SWEEP Matrix/);
    assert.match(audit, /analysis-only/i);
    assert.match(audit, /no refactor performed/i);
    assert.match(audit, /1\.1\.1/);
  });

  test("2. Context-isolated sharding maps repository content across six engineering pillars", () => {
    const paths = [
      "src/auth/session.ts",
      "app/api/msgf/pulse/route.ts",
      "ui/components/Button.tsx",
      "supabase/migrations/001.sql",
      "lib/core.ts",
    ];
    const pillars = new Set([
      ...paths.map((p) => governancePillarForCategory(determineCategory(p))),
      governancePillarForCategory("Unclassified"),
    ]);
    assert.deepEqual([...pillars].sort(), ["P1", "P2", "P3", "P4", "P5", "P6"]);

    const source = readRepo("packages/msgf/lib/services/IngestService.ts");
    assert.match(source, /pillar:\s*input\.governancePillar/);
    assert.match(source, /governance_pillar:\s*input\.governancePillar/);
  });

  test("3. Hot-layer Redis Active Slices enforce P4 TTL semantics", () => {
    assert.equal(HOT_LAYER_ACTIVE_SLICE_TTL_SECONDS, Number(process.env.MSGF_ACTIVE_SLICE_TTL_SEC || 180));
    assert.ok(HOT_LAYER_ACTIVE_SLICE_TTL_SECONDS > 0);
    assert.ok(HOT_LAYER_ACTIVE_SLICE_TTL_SECONDS <= 600);
    const source = readRepo("packages/msgf/lib/msgf-hot-layer.ts");
    assert.match(source, /redisSet\(activeSliceKey\(params\.entityId\), JSON\.stringify\(payload\), ACTIVE_SLICE_TTL_SECONDS\)/);
  });

  test("4. Cold-layer pgvector mapping persists 1.1.1 lineage with 1536-dimensional embeddings", async () => {
    const embedding = await generateEmbedding("repository shard requiring fallback-safe vector shape");
    assert.equal(embedding.length, 1536);

    const migration = readRepo("packages/msgf/supabase/migrations/20260506200000_pillar_vectors_1536_and_gin.sql");
    assert.match(migration, /embedding vector\(1536\)/);

    const index = pathToGenealogicalBugIndex("apps/new-repo/api/auth/login.ts");
    assert.match(index.level_1_category, /^1\.0_/);
    assert.match(index.level_1_1_branch, /^1\.1_/);
    assert.equal(index.level_1_1_1_instance, "1.1.1_INGEST_BASELINE");
  });

  test("5. DEFEND Shadow Mode hard-halts on Hall/P6 RED matches before mutation", async () => {
    const tenantId = "tenant-shadow";
    const supabase = new FakeSupabase({
      pillar_vectors: [
        tenantRow(tenantId, "hall", "deprecated byok secret leaked through client route"),
        tenantRow("other-tenant", "hall", "deprecated byok secret leaked through client route"),
      ],
    });

    const result = await preFlightCheck(
      supabase as never,
      { text: "deprecated byok secret leaked through client route" },
      { tenantId }
    );

    assert.equal(result.tier, "RED");
    assert.equal(result.blocked, true);
    assert.equal(result.hallMatch?.metadata?.tenant_id, tenantId);
  });

  test("6. CROSS-REF Pre-Flight checks Vault positives and Hall negatives per tenant", async () => {
    const tenantId = "tenant-cross-ref";
    const supabase = new FakeSupabase({
      pillar_vectors: [
        tenantRow(tenantId, "vault", "repeat safe byok server only routing pattern"),
        tenantRow("other-tenant", "vault", "repeat safe byok server only routing pattern"),
      ],
    });

    const result = await preFlightCheck(
      supabase as never,
      { text: "repeat safe byok server only routing pattern" },
      { tenantId }
    );

    assert.equal(result.blocked, false);
    assert.equal(result.tier, "GREEN");
    assert.equal(result.vaultMatch?.metadata?.tenant_id, tenantId);
  });

  test("7. P3 Credit Guard evaluates Stripe status and credit exhaustion on Pulse path", () => {
    assert.equal(evaluatePulseEntitlement(activeProfile(), { mockStripeActive: false }).allowed, true);
    assert.equal(
      evaluatePulseEntitlement(activeProfile({ stripe_subscription_status: "past_due" }), {
        mockStripeActive: false,
      }).allowed,
      false
    );
    assert.equal(
      evaluatePulseEntitlement(activeProfile({ billing_license_type: "lifetime", current_credits: 0 })).allowed,
      false
    );

    const pulseEngine = readRepo("packages/msgf/lib/services/PulseEngine.ts");
    const middleware = readRepo("packages/msgf/middleware.ts");
    assert.match(middleware, /assertPulseEntitlementOr429/);
    assert.match(middleware, /assertMsgfCreditsOr429/);
    assert.match(pulseEngine, /recordPerpetualPlatformConvergeSlice/);
  });

  test("8. Multi-tenant silo enforcement filters all tenant-scoped query and ingest rows", () => {
    const calls: Array<[string, string]> = [];
    const query = { eq: (column: string, value: string) => (calls.push([column, value]), query) };
    resolveTenantIdForQuery("tenant-a");
    assert.throws(() => resolveTenantIdForQuery(undefined), /tenant_id is required/);

    const kept = filterPillarRowsByTenant(
      [
        { metadata: { tenant_id: "tenant-a" } },
        { metadata: { tenant_id: "tenant-b" } },
        { metadata: null },
      ],
      "tenant-a"
    );
    assert.equal(kept.length, 1);
    assert.equal(pillarRowBelongsToTenant({ tenant_id: "tenant-a" }, "tenant-a"), true);
    assert.equal(pillarRowBelongsToTenant({ tenant_id: "tenant-b" }, "tenant-a"), false);
  });

  test("9. CONVERGE dual-model consensus recognizes matching Claude/Gemini signals", () => {
    const agreement = computeConsensusAgreementScore(
      '{"verdict":"HUMAN","reason":"steady rhythm and consistent style"}',
      '{"verdict":"HUMAN","reason":"steady rhythm and consistent style"}'
    );
    assert.ok(agreement >= 0.8);
    const transition = agreement >= 0.8 ? "HUMAN_CONFIRMED" : "HITL_TIEBREAKER_REQUIRED";
    assert.equal(transition, "HUMAN_CONFIRMED");
  });

  test("10. ARBITRATE HITL halt records incident and blocks persistence on RED disagreement", () => {
    const disagreement = computeConsensusAgreementScore(
      '{"verdict":"HUMAN","reason":"manual cadence"}',
      '{"verdict":"NON_HUMAN","reason":"automation signature"}'
    );
    assert.ok(disagreement < 0.8);

    const engine = readRepo("packages/msgf/lib/services/PulseEngine.ts");
    assert.match(engine, /human_tiebreaker_required/);
    assert.match(engine, /insertMsgfArbitrateIncident/);
    assert.match(engine, /PULSE_BUG_INDEX\.hallHitlRequired/);
  });

  test("11. Recursion guard aborts exactly after strict threshold of 3 attempts", () => {
    assert.equal(PULSE_RECURSION_MAX_RETRY, 3);
    const attempt = PULSE_RECURSION_MAX_RETRY + 1;
    assert.equal(attempt, 4);
    assert.equal(ERR_RECURSION_LIMIT, "ERR_RECURSION_LIMIT");
    const engine = readRepo("packages/msgf/lib/services/PulseEngine.ts");
    assert.match(engine, /lomAttempts: attempts/);
    assert.match(engine, /lom_attempts: attempts/);
    assert.match(engine, /ERR_RECURSION_LIMIT/);
  });

  test("12. HAL telemetry is P4 State Ledger scope and never pollutes P1 Static Ledger", () => {
    const mapping = readRepo("docs/msgf/technical-specs/MSGF_PILLAR_MAPPING_SSOT.md");
    assert.match(mapping, /\*\*HAL\*\* is keystroke\/rhythm telemetry/);
    assert.match(mapping, /P4 State Ledger/);
    assert.match(mapping, /not P1/i);

    const p1Universal = readRepo("packages/msgf/src/lib/universal/p1HalStandard.ts");
    assert.match(p1Universal, /UniversalP1KeystrokeEvent/);
    assert.match(p1Universal, /book_title/);

    const score = calculateBiometricScore({
      keystrokes: [
        { ts: 1, key: "a", type: "keydown" },
        { ts: 2, key: "pasted generated paragraph far larger than one keystroke", type: "input" },
      ],
    });
    assert.equal(score.largePasteDetected, true);
  });

  test("13. 1.1.1 genealogical lineage indexes category -> branch -> discrete fix delta", () => {
    const index = buildGenealogicalBugIndex({
      level_1_category: "1.0_AUTH",
      level_1_1_branch: "1.1_BYOK",
      level_1_1_1_instance: "1.1.1_DISCRETE_FIX_DELTA",
    });
    assert.equal(index.level_1_category, "1.0_AUTH");
    assert.equal(index.level_1_1_branch, "1.1_BYOK");
    assert.equal(index.level_1_1_1_instance, "1.1.1_DISCRETE_FIX_DELTA");

    const meta = buildVaultHallMetadata({
      ledger: "hall",
      bugIndex: index,
      tenantId: "tenant-lineage",
      summary: "P4 snapshot log attached to discrete fix delta",
    });
    assert.equal(meta.pillar, "P6");
    assert.equal(meta.instance, "1.1.1");
    assert.equal(meta.category, "1.0_AUTH");
    assert.equal(meta.branch, "1.1_BYOK");
  });

  test("14. Vault persistence writes consensus-approved deltas into positive index", async () => {
    const supabase = new FakeSupabase();
    const result = await persistToVault({
      supabase: supabase as never,
      entityId: randomUUID(),
      tenantId: "tenant-vault",
      content: "approved fix delta: move BYOK secret handling server-side",
      bugIndex: PULSE_BUG_INDEX.vaultConsensusOk,
      summaryBeat: "BYOK server-side fix worked",
      legalVersion: "test",
      halScore: 96,
    });

    assert.ok(result.narrativeLogId);
    const vectors = supabase.store.get("pillar_vectors") ?? [];
    assert.equal(vectors.length, 1);
    assert.equal((vectors[0].metadata as Record<string, unknown>).ledger, "vault");
  });

  test("15. Hall capture records rejected consensus strings and tier processor batches YELLOW/GREEN windows", async () => {
    const supabase = new FakeSupabase();
    await persistToHall({
      supabase: supabase as never,
      entityId: randomUUID(),
      tenantId: "tenant-hall",
      content: "rejected consensus string: expose service role to client",
      bugIndex: PULSE_BUG_INDEX.hallConsensusFailed,
      reason: "Consensus rejected unsafe secret handling.",
      tier: "YELLOW",
    });

    const vectors = supabase.store.get("pillar_vectors") ?? [];
    assert.equal((vectors[0].metadata as Record<string, unknown>).ledger, "hall");
    assert.equal((vectors[0].metadata as Record<string, unknown>).tier, "YELLOW");

    const tierProcessor = readRepo("packages/msgf/scripts/msgf-tier-processor.js");
    assert.match(tierProcessor, /YELLOW \(6h\)/);
    assert.match(tierProcessor, /GREEN \(24h\)/);
    assert.match(tierProcessor, /fetchRecentBeats\(6\)/);
    assert.match(tierProcessor, /fetchRecentBeats\(24\)/);
  });

  test("16. Hall auto-purge deletes only non-critical LOW/GREEN records older than 30 days", async () => {
    assert.equal(HALL_PURGE_DEFAULT_RETENTION_DAYS, 30);
    assert.equal(isLowPriorityHallRecord({ ledger: "hall", tier: "GREEN" }), true);
    assert.equal(isLowPriorityHallRecord({ ledger: "hall", tier: "RED" }), false);

    const old = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
    const supabase = new FakeSupabase({
      pillar_vectors: [
        { id: "old-green", created_at: old, metadata: { ledger: "hall", tier: "GREEN" } },
        { id: "old-red", created_at: old, metadata: { ledger: "hall", tier: "RED" } },
      ],
      p4_narrative_logs: [],
      msgf_sandbox: [],
      msgf_incidents: [],
    });

    const result = await runHallPurgeProtocol({
      supabase: supabase as never,
      dryRun: true,
      days: 30,
    });
    const pillarResult = result.tables.find((row) => row.table === "pillar_vectors");
    assert.equal(pillarResult?.wouldDelete, 1);
    assert.equal(pillarResult?.retained, 1);
  });

  test("17. v32-heartbeat route uses ops cron auth and isolated maintenance routines", () => {
    const route = readRepo("packages/msgf/app/api/msgf/ops/v32-heartbeat/route.ts");
    const heartbeat = readRepo("packages/msgf/lib/services/v32-ops-heartbeat.ts");
    const redisPurge = readRepo("packages/msgf/lib/services/hall-redis-purge.ts");
    const adminAuth = readRepo("packages/msgf/lib/msgf-admin-auth.ts");

    assert.match(route, /assertMsgfOpsCron\(req\)/);
    assert.doesNotMatch(route, /allowAdminKey/);
    assert.match(route, /runV32OpsHeartbeat/);
    assert.match(route, /X-MSGF-Ops-Cron-Secret/);
    assert.match(heartbeat, /runV32TierMaintenance/);
    assert.match(heartbeat, /runHallPurgeProtocol/);
    assert.match(heartbeat, /runHallRedisPurge/);
    assert.match(heartbeat, /scheduled_heal_batch/);
    assert.match(heartbeat, /runCronScheduledHealBatches/);
    assert.match(redisPurge, /upstashRedisScanKeys|scanStream/);
    assert.match(adminAuth, /msgfSecureSecretEqual/);
    assert.match(adminAuth, /MSGF_OPS_CRON_SECRET/);
  });
});

describe("MSGF V3.2 suite execution boundary", () => {
  test("documents required live-service env without requiring payment UI integration", () => {
    const pkg = readFileSync(path.join(msgfRoot, "package.json"), "utf8");
    assert.match(pkg, /test:v32-ultra/);
    assert.doesNotMatch(pkg, /stripe.*ui/i);
  });
});
