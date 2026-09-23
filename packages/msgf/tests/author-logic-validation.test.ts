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
 * Distribution Build ID: MSGF-fca2d532-20260923T201750Z-internal
 */
/**
 * Author Ecosystem — chapter constraint integration verification suite.
 *
 * Validates the POST /api/msgf/author/chapter-validation pipeline end-to-end:
 *   • Test 1 (Constraint Check) — chapter violates a read-only physical law
 *     from RAG READY WORLD BIBLE §1.1. The server must return 422 with at
 *     least one matching `structural_exceptions[]` entry.
 *   • Test 2 (State Mutation Check) — chapter breaks a cultural taboo from the
 *     Trope/Sensitivity Sheet. The server must (a) return 200, (b) UPSERT
 *     `author_tension_ledger` with a strictly-greater `tension_level`, and
 *     (c) APPEND one `author_cultural_omens` row per taboo breach.
 *
 * -----------------------------------------------------------------------------
 *  How to run
 * -----------------------------------------------------------------------------
 * Local (dev server on http://127.0.0.1:3000):
 *   1. In one terminal:   npm run dev -w msgf
 *   2. In another:        npm run test:author-validation -w msgf
 *
 * Against a deployed Cloud Run URL (no local stack required):
 *   $env:MSGF_BASE_URL = "https://msgf-api-xxxxx.run.app"
 *   $env:MSGF_INTEGRATION_TEST_TOKEN = "<value matching Cloud Run env>"
 *   $env:NEXT_PUBLIC_SUPABASE_URL    = "https://<project>.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY   = "<service-role-jwt>"
 *   npm run test:author-validation -w msgf
 *
 * -----------------------------------------------------------------------------
 *  Required env
 * -----------------------------------------------------------------------------
 *   MSGF_BASE_URL                  — base URL of the Next.js / Cloud Run host
 *                                    (defaults to http://127.0.0.1:3000)
 *   MSGF_INTEGRATION_TEST_TOKEN    — shared secret matching the server env var
 *                                    of the same name (required)
 *   NEXT_PUBLIC_SUPABASE_URL       — Supabase project URL (required for Test 2
 *                                    DB assertions)
 *   SUPABASE_SERVICE_ROLE_KEY      — service-role JWT (required for Test 2)
 *
 *   MSGF_TEST_TENANT_ID            — tenant slug to use for both tests
 *                                    (default: "author_ecosystem")
 *   MSGF_TEST_MANUSCRIPT_PREFIX    — prefix for the synthetic manuscript IDs
 *                                    (default: "author-logic-validation-test")
 *
 * Exit codes:
 *   0 — every test passed
 *   1 — at least one test failed (full diff printed to stderr)
 *   2 — required env missing (suite skipped, not a real failure)
 */

import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  CulturalTaboo,
  WorldBibleConstraint,
} from "../lib/author/chapter-constraint-engine";

// -----------------------------------------------------------------------------
// Environment + fixtures
// -----------------------------------------------------------------------------

const BASE = (process.env.MSGF_BASE_URL ?? "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);
const TEST_TOKEN = process.env.MSGF_INTEGRATION_TEST_TOKEN?.trim();
const TENANT_ID = process.env.MSGF_TEST_TENANT_ID?.trim() || "author_ecosystem";
const MANUSCRIPT_PREFIX =
  process.env.MSGF_TEST_MANUSCRIPT_PREFIX?.trim() ||
  "author-logic-validation-test";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

const TEST_RUN_ID = randomUUID();
const TEST_1_MANUSCRIPT_ID = `${MANUSCRIPT_PREFIX}-test1-${TEST_RUN_ID}`;
const TEST_2_MANUSCRIPT_ID = `${MANUSCRIPT_PREFIX}-test2-${TEST_RUN_ID}`;

const VALIDATION_PATH = "/api/msgf/author/chapter-validation";

// -----------------------------------------------------------------------------
// Test 1 — physics violation from RAG READY WORLD BIBLE §1.1.1 / §1.3.1
// -----------------------------------------------------------------------------
//
// World Bible says: on a planet with Gravity > 1.2g, atmosphere must be
// breathable (Nitrogen-Oxygen) — anything else requires a respirator.
// The chapter sets gravity = 2.5g (Crushing) AND atmosphere = "thin_no_respirator"
// AND no internal heat source past the frost line. THREE separate Static Ledger
// laws are violated — the engine must return ALL three exceptions.
const TEST_1_WORLD_BIBLE_RULES: WorldBibleConstraint[] = [
  {
    ruleId: "Planet_Phys:Gravity_Requires_Respirator",
    category: "planetary",
    description:
      "World Bible §1.3.1 — on a >1.2g planet without breathable atmosphere, characters require respirators.",
    detector: {
      field: "location.atmosphere",
      operator: "in",
      expected: ["breathable", "nitrogen_oxygen"],
      requirePresent: true,
      violationMessage:
        "Chapter places a character on a Crushing (>1.2g) planet without a respirator or breathable atmosphere — World Bible §1.3.1 forbids this.",
    },
  },
  {
    ruleId: "Physics:Frost_Line",
    category: "physics",
    description:
      "World Bible §1.2.1 — any planet beyond the Frost Line must have an internal heat source or be Icy by default.",
    detector: {
      field: "location.has_internal_heat_source",
      operator: "must_be_true",
      expected: true,
      requirePresent: true,
      violationMessage:
        "Chapter describes a tropical climate beyond the Frost Line without defining an internal heat source — World Bible §1.2.1.",
    },
  },
  {
    ruleId: "Planet_Phys:Solar_Input_Override",
    category: "physics",
    description:
      "World Bible §1.3.1 — Solar Influence past the Frost Line overrides any 'tropical' descriptor unless an internal heat source is defined.",
    detector: {
      field: "environment.descriptors",
      operator: "not_in",
      expected: ["tropical", "humid", "balmy"],
      requirePresent: false,
      violationMessage:
        "Environment description uses warm-climate descriptors (tropical/humid/balmy) without justification past the Frost Line — World Bible §1.3.1.",
    },
  },
];

const TEST_1_CHAPTER = {
  scene: {
    location: {
      planet: "Korr-7",
      distance_from_sun_au: 8,
      gravity_g: 2.5,
      atmosphere: "thin_no_respirator",
      has_internal_heat_source: false,
    },
    environment: {
      descriptors: ["tropical", "humid"],
    },
  },
  actions: [],
};

// -----------------------------------------------------------------------------
// Test 2 — cultural taboo from Trope/Sensitivity Sheet §1.2 / §2.1
// -----------------------------------------------------------------------------
//
// Cultural rule: "Showing soles of feet" is a major taboo (severity 8).
// Trigger should: (a) increment author_tension_ledger.tension_level by 8,
// (b) insert one author_cultural_omens row with omen_pattern "raven_circles_overhead".
const TEST_2_CULTURAL_TABOOS: CulturalTaboo[] = [
  {
    tabooId: "show_soles_of_feet_to_elder",
    description:
      "Trope/Sensitivity Sheet §1.2 — showing the soles of the feet to an elder is a high-severity insult in this culture.",
    severity: 8,
    detector: { actionType: "show_soles_of_feet" },
    omenPattern: "raven_circles_overhead",
  },
];

const TEST_2_CHAPTER = {
  scene: {
    location: { planet: "Korr-7", culture: "Kethari" },
  },
  actions: [
    { actor: "Mira", action: "enter_room" },
    { actor: "Mira", action: "show_soles_of_feet" },
  ],
};

// -----------------------------------------------------------------------------
// HTTP + Supabase helpers
// -----------------------------------------------------------------------------

type ValidationResponse = {
  ok: boolean;
  trace_id: string;
  validation_id: string;
  mode: "user_session" | "integration_test";
  tenant_id: string;
  structural_exceptions: Array<{
    ruleId: string;
    ruleCategory: string;
    message: string;
    offendingField: string;
    expected: unknown;
    actual: unknown;
  }>;
  omens: Array<{
    tabooId: string;
    severity: number;
    omenPattern: string;
    offendingActor: string;
  }>;
  tension_before: number;
  tension_after: number;
  tension_delta: number;
};

async function postValidation(body: Record<string, unknown>): Promise<{
  status: number;
  json: ValidationResponse | { error?: string; details?: unknown };
}> {
  const res = await fetch(`${BASE}${VALIDATION_PATH}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-msgf-integration-test-token": TEST_TOKEN ?? "",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { error: `Non-JSON response: ${text.slice(0, 500)}` };
  }
  return {
    status: res.status,
    json: parsed as ValidationResponse | { error?: string; details?: unknown },
  };
}

function buildSupabaseAdmin(): SupabaseClient {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error(
      "Test 2 requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to verify DB mutations."
    );
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function cleanupTestRows(admin: SupabaseClient): Promise<void> {
  for (const manuscriptId of [TEST_1_MANUSCRIPT_ID, TEST_2_MANUSCRIPT_ID]) {
    await admin
      .from("author_cultural_omens")
      .delete()
      .eq("tenant_id", TENANT_ID)
      .eq("manuscript_id", manuscriptId);
    await admin
      .from("author_chapter_validations")
      .delete()
      .eq("tenant_id", TENANT_ID)
      .eq("manuscript_id", manuscriptId);
    await admin
      .from("author_tension_ledger")
      .delete()
      .eq("tenant_id", TENANT_ID)
      .eq("manuscript_id", manuscriptId);
  }
}

// -----------------------------------------------------------------------------
// Test 1 — The Constraint Check
// -----------------------------------------------------------------------------

async function runTest1(): Promise<void> {
  const { status, json } = await postValidation({
    manuscriptId: TEST_1_MANUSCRIPT_ID,
    chapterId: "ch01",
    tenantId: TENANT_ID,
    worldBibleRules: TEST_1_WORLD_BIBLE_RULES,
    culturalTaboos: [],
    chapter: TEST_1_CHAPTER,
    requestMetadata: { suite: "author-logic-validation", test: 1 },
  });

  if (status !== 422) {
    throw new Error(
      `Test 1 expected HTTP 422 (structural layout exception), got ${status}. Body: ${JSON.stringify(
        json
      ).slice(0, 800)}`
    );
  }

  if (!isValidationResponse(json)) {
    throw new Error(
      `Test 1 response missing structural_exceptions[]: ${JSON.stringify(json).slice(0, 800)}`
    );
  }

  const expectedRuleIds = new Set(
    TEST_1_WORLD_BIBLE_RULES.map((r) => r.ruleId)
  );
  const actualRuleIds = new Set(json.structural_exceptions.map((e) => e.ruleId));

  for (const id of expectedRuleIds) {
    if (!actualRuleIds.has(id)) {
      throw new Error(
        `Test 1 expected structural exception for rule "${id}" — got ${JSON.stringify(
          [...actualRuleIds]
        )}`
      );
    }
  }

  if (json.tension_after !== json.tension_before) {
    throw new Error(
      `Test 1 must not mutate tension_level on Static Ledger failure. before=${json.tension_before} after=${json.tension_after}`
    );
  }
}

// -----------------------------------------------------------------------------
// Test 2 — The State Mutation Check
// -----------------------------------------------------------------------------

async function runTest2(admin: SupabaseClient): Promise<void> {
  const { status, json } = await postValidation({
    manuscriptId: TEST_2_MANUSCRIPT_ID,
    chapterId: "ch07",
    tenantId: TENANT_ID,
    worldBibleRules: [],
    culturalTaboos: TEST_2_CULTURAL_TABOOS,
    chapter: TEST_2_CHAPTER,
    requestMetadata: { suite: "author-logic-validation", test: 2 },
  });

  if (status !== 200) {
    throw new Error(
      `Test 2 expected HTTP 200 (taboo-only path), got ${status}. Body: ${JSON.stringify(
        json
      ).slice(0, 800)}`
    );
  }

  if (!isValidationResponse(json)) {
    throw new Error(
      `Test 2 response shape invalid: ${JSON.stringify(json).slice(0, 800)}`
    );
  }

  if (json.omens.length !== 1) {
    throw new Error(
      `Test 2 expected exactly 1 cultural omen, got ${json.omens.length}: ${JSON.stringify(json.omens)}`
    );
  }
  const omen = json.omens[0];
  if (
    omen.tabooId !== "show_soles_of_feet_to_elder" ||
    omen.omenPattern !== "raven_circles_overhead" ||
    omen.severity !== 8 ||
    omen.offendingActor !== "Mira"
  ) {
    throw new Error(`Test 2 omen payload mismatch: ${JSON.stringify(omen)}`);
  }

  // Response-level tension_after must be strictly greater than tension_before.
  if (json.tension_after <= json.tension_before) {
    throw new Error(
      `Test 2 expected tension_after > tension_before, got ${json.tension_after} <= ${json.tension_before}`
    );
  }
  if (json.tension_after - json.tension_before !== 8) {
    throw new Error(
      `Test 2 expected tension delta of exactly 8, got ${json.tension_after - json.tension_before}`
    );
  }

  // Database-level mutation must be observable to the service role.
  const { data: ledgerRow, error: ledgerErr } = await admin
    .from("author_tension_ledger")
    .select("manuscript_id, tension_level, cultural_omen_count, last_chapter_id")
    .eq("tenant_id", TENANT_ID)
    .eq("manuscript_id", TEST_2_MANUSCRIPT_ID)
    .maybeSingle();
  if (ledgerErr) {
    throw new Error(`Test 2 ledger read failed: ${ledgerErr.message}`);
  }
  if (!ledgerRow) {
    throw new Error(
      `Test 2 expected author_tension_ledger row for manuscript ${TEST_2_MANUSCRIPT_ID}, found none.`
    );
  }
  if (ledgerRow.tension_level !== 8) {
    throw new Error(
      `Test 2 expected author_tension_ledger.tension_level=8, got ${ledgerRow.tension_level}`
    );
  }
  if (ledgerRow.last_chapter_id !== "ch07") {
    throw new Error(
      `Test 2 expected last_chapter_id="ch07", got "${ledgerRow.last_chapter_id}"`
    );
  }

  const { data: omenRows, error: omenErr } = await admin
    .from("author_cultural_omens")
    .select("taboo_id, omen_pattern, severity, offending_actor")
    .eq("tenant_id", TENANT_ID)
    .eq("manuscript_id", TEST_2_MANUSCRIPT_ID);
  if (omenErr) {
    throw new Error(`Test 2 omen read failed: ${omenErr.message}`);
  }
  if (!omenRows || omenRows.length !== 1) {
    throw new Error(
      `Test 2 expected exactly 1 author_cultural_omens row, got ${omenRows?.length ?? 0}`
    );
  }
  const dbOmen = omenRows[0];
  if (
    dbOmen.taboo_id !== "show_soles_of_feet_to_elder" ||
    dbOmen.omen_pattern !== "raven_circles_overhead" ||
    dbOmen.severity !== 8 ||
    dbOmen.offending_actor !== "Mira"
  ) {
    throw new Error(
      `Test 2 DB omen mismatch: ${JSON.stringify(dbOmen)}`
    );
  }
}

function isValidationResponse(v: unknown): v is ValidationResponse {
  return (
    typeof v === "object" &&
    v !== null &&
    "structural_exceptions" in v &&
    "omens" in v &&
    "tension_after" in v
  );
}

// -----------------------------------------------------------------------------
// Runner
// -----------------------------------------------------------------------------

type TestOutcome = { name: string; ok: boolean; error?: string };

async function main(): Promise<void> {
  if (!TEST_TOKEN) {
    console.error(
      "[author-logic-validation] MSGF_INTEGRATION_TEST_TOKEN is not set — suite skipped."
    );
    console.error(
      "  Set it on the server (Cloud Run env) AND on the test client (this process)."
    );
    process.exit(2);
  }

  console.log(`[author-logic-validation] BASE=${BASE}`);
  console.log(`[author-logic-validation] tenant=${TENANT_ID}`);
  console.log(`[author-logic-validation] run_id=${TEST_RUN_ID}`);

  const admin = buildSupabaseAdmin();
  const outcomes: TestOutcome[] = [];

  // Defensive cleanup in case a previous run aborted mid-way.
  try {
    await cleanupTestRows(admin);
  } catch (e) {
    console.warn(
      `[author-logic-validation] Pre-test cleanup warning: ${(e as Error).message}`
    );
  }

  try {
    await runTest1();
    outcomes.push({ name: "Test 1 (Constraint Check)", ok: true });
    console.log("  ✓ Test 1 (Constraint Check)");
  } catch (e) {
    outcomes.push({
      name: "Test 1 (Constraint Check)",
      ok: false,
      error: (e as Error).message,
    });
    console.error("  ✗ Test 1 (Constraint Check)");
    console.error(`    ${(e as Error).message}`);
  }

  try {
    await runTest2(admin);
    outcomes.push({ name: "Test 2 (State Mutation Check)", ok: true });
    console.log("  ✓ Test 2 (State Mutation Check)");
  } catch (e) {
    outcomes.push({
      name: "Test 2 (State Mutation Check)",
      ok: false,
      error: (e as Error).message,
    });
    console.error("  ✗ Test 2 (State Mutation Check)");
    console.error(`    ${(e as Error).message}`);
  }

  // Always clean up test data so reruns are idempotent.
  try {
    await cleanupTestRows(admin);
  } catch (e) {
    console.warn(
      `[author-logic-validation] Post-test cleanup warning: ${(e as Error).message}`
    );
  }

  const failed = outcomes.filter((o) => !o.ok);
  if (failed.length === 0) {
    console.log(`\n[author-logic-validation] ${outcomes.length}/${outcomes.length} passed.`);
    process.exit(0);
  }
  console.error(
    `\n[author-logic-validation] ${failed.length}/${outcomes.length} failed.`
  );
  process.exit(1);
}

void main().catch((e) => {
  console.error("[author-logic-validation] unexpected fatal error:", e);
  process.exit(1);
});
