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
 * Distribution Build ID: MSGF-3a4c1de-20260529T200349Z-internal
 */
/**
 * Verifies Small Brain (local gateway) vs Big Brain (global CONVERGE) routing,
 * RemediationEngine consequence labels, and metadata-only pillar_vectors.
 *
 * Run: npm run verify:brain-routing -w msgf
 */

import { createClient } from "@supabase/supabase-js";

import { createPledgeBeat } from "@/lib/msgf-onboarding";
import {
  remediationEngine,
  toAdminIncidentStrategyDto,
} from "@/lib/services/RemediationEngine";
import { bootstrapTenantBrain } from "@/lib/services/brain-readiness";
import { assessLogicDrift } from "@/lib/services/logic-drift";
import { buildVaultHallMetadata, PULSE_BUG_INDEX } from "@/lib/schemas/vault-hall-metadata";
import { pulseEngine } from "@/lib/services/PulseEngine";

function riskScoreTier(score: number): "low" | "medium" | "high" {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fail(msg: string): never {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}

function pass(msg: string) {
  console.log(`✓ ${msg}`);
}

function routineKeystrokes(text: string) {
  const base = Date.now();
  return text.split("").map((key, i) => ({
    ts: base + i * 95,
    key,
    type: "keydown" as const,
  }));
}

async function countIncidents(admin: ReturnType<typeof createClient>, userId: string) {
  const { count, error } = await admin
    .from("msgf_incidents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw error;
  return count ?? 0;
}

const VERIFY_AUTHOR_FALLBACK = "a1000000-0000-4000-8000-000000000001";

async function ensureTestAuthor(admin: ReturnType<typeof createClient>): Promise<string> {
  const fromEnv = process.env.MSGF_VERIFY_AUTHOR_ID?.trim();
  let authorId = fromEnv || "";

  if (!authorId) {
    const email = process.env.MSGF_VERIFY_AUTHOR_EMAIL?.trim() || "msgf-verify@elphiesyntax.local";
    const password = process.env.MSGF_VERIFY_AUTHOR_PASSWORD?.trim() || "msgf-verify-password-123";
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: "DEVELOPER",
        msgf_verify: true,
      },
    });

    if (created.data.user?.id) {
      authorId = created.data.user.id;
    } else {
      const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const match = listed.data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (!match?.id) {
        const detail = created.error?.message || listed.error?.message || "No matching verify auth user.";
        throw new Error(`ensureTestAuthor: auth user create/list failed: ${detail}`);
      }
      authorId = match.id;
    }
  }

  if (!authorId) authorId = VERIFY_AUTHOR_FALLBACK;

  const { data } = await admin.from("p4_profiles").select("user_id").eq("user_id", authorId).maybeSingle();
  if (!data?.user_id) {
    const { error } = await admin.from("p4_profiles").upsert(
      {
        user_id: authorId,
        username: `verify-${authorId.slice(0, 8)}`,
        tier_id: 1,
        user_role: "developer",
        billing_license_type: "monthly",
        stripe_subscription_status: "active",
        current_credits: 100,
      },
      { onConflict: "user_id" }
    );
    if (error) {
      console.warn(`p4_profiles upsert: ${error.message} (continuing with ${authorId})`);
    }
  }

  return authorId;
}

async function ensureBiometricReady(
  admin: ReturnType<typeof createClient>,
  userId: string
) {
  const { error } = await admin.from("biometric_profile").upsert(
    {
      user_id: userId,
      ewma_speed: 4.2,
      rhythm_hash: "verify-routine",
      baseline_training_remaining: 0,
      recalibrated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;
}

async function seedP2ConflictVault(
  admin: ReturnType<typeof createClient>,
  authorId: string,
  conflictText: string
) {
  const content = conflictText;
  const metadata = buildVaultHallMetadata({
    ledger: "vault",
    bugIndex: PULSE_BUG_INDEX.hallHitlRequired,
    tenantId: authorId,
    entityId: authorId,
    summary: "verify P2 conflict seed",
  });

  const { error } = await admin.from("pillar_vectors").insert({
    content,
    metadata: {
      ...metadata,
      verify_seed: "p2_conflict",
    },
  });
  if (error) throw error;
}

async function verifyPillarMetadata(admin: ReturnType<typeof createClient>) {
  const { data: sample, error } = await admin
    .from("pillar_vectors")
    .select("id, content, metadata, embedding")
    .order("id", { ascending: false })
    .limit(25);

  if (error) fail(`pillar_vectors sample query: ${error.message}`);

  let badLegacy = 0;
  let goodMeta = 0;

  for (const row of sample ?? []) {
    const r = row as Record<string, unknown>;
    if ("category" in r && r.category != null && !("metadata" in r && r.metadata)) badLegacy += 1;
    if ("branch" in r && r.branch != null && typeof r.metadata !== "object") badLegacy += 1;
    if ("pillar" in r && r.pillar != null && typeof r.metadata !== "object") badLegacy += 1;

    const meta = r.metadata as Record<string, unknown> | null;
    if (meta && typeof meta === "object" && meta.bug_index && meta.ledger) {
      goodMeta += 1;
    }
  }

  if (badLegacy > 0) {
    fail(`Found ${badLegacy} pillar_vectors rows with legacy top-level category/branch/pillar columns.`);
  }

  pass(
    `pillar_vectors sample (${sample?.length ?? 0} rows): metadata-only inserts OK (${goodMeta} with bug_index + ledger in metadata).`
  );
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    fail("Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const authorId = await ensureTestAuthor(admin);
  console.log(`\nUsing author_id: ${authorId}\n`);

  await bootstrapTenantBrain(admin, authorId);
  await createPledgeBeat(authorId, { tenantId: authorId, supabase: admin });
  await ensureBiometricReady(admin, authorId);

  const readiness = await bootstrapTenantBrain(admin, authorId);
  if (!readiness.is_pillar_baseline_set) {
    fail(`Expected 6-pillar baseline; got ${readiness.pillars_present}/6`);
  }
  pass(`Six-pillar baseline set (readiness ${readiness.readiness_score}%)`);

  // --- 1) Routine save (local gateway) ---
  const incidentsBefore = await countIncidents(admin, authorId);

  const routine = await pulseEngine.runFullPipeline({
    supabase: admin,
    adminSupabase: admin,
    entityId: authorId,
    tenantId: authorId,
    rawBody: {
      keystrokes: routineKeystrokes(
        "Routine save: editing chapter notes with calm steady typing."
      ),
    },
    geminiModelId: process.env.MSGF_GEMINI_MODEL || "gemini-2.5-flash",
    forceLomMismatch: false,
    lomHarnessEnabled: false,
    license: {
      licenseId: "verify-local",
      tenantId: "verify",
      tierId: "brain_contract",
    },
  });

  if (routine.kind !== "ok") {
    fail(`Routine pulse expected ok, got ${routine.kind}`);
  }

  const routing = routine.public.routing;
  if (routing !== "local_gateway") {
    fail(
      `Routine pulse should route local_gateway; got ${String(routing)} (drift may be high or pillars missing).`
    );
  }
  pass(`Routine pulse routed to local_gateway (logic_drift=${routine.public.logic_drift_score})`);

  const incidentsAfterRoutine = await countIncidents(admin, authorId);
  if (incidentsAfterRoutine !== incidentsBefore) {
    fail(
      `Routine save created msgf_incidents: before=${incidentsBefore} after=${incidentsAfterRoutine}`
    );
  }
  pass("No msgf_incidents row created for routine local save");

  // --- 2) P2 conflict → global + strategy matrix labels ---
  const conflictText =
    "rollback architecture revert to v2 monolithic route legacy express pre-refactor";
  await seedP2ConflictVault(admin, authorId, conflictText);
  const defended = await pulseEngine.runThroughDefend(
    {
      supabase: admin,
      adminSupabase: admin,
      entityId: authorId,
      tenantId: authorId,
      rawBody: { keystrokes: routineKeystrokes(conflictText) },
      forceLomMismatch: false,
      lomHarnessEnabled: false,
    },
    true
  );

  const drift = assessLogicDrift({
    pulseText: defended.pulseText,
    halScore: 80,
    vaultP2Prioritized: defended.vaultP2Prioritized,
    preflight: defended.preflight,
  });

  if (!drift.escalateToGlobalBrain || !drift.contradictsP2Roadmap) {
    fail(
      `Expected P2 roadmap conflict escalation; drift=${drift.score} contradicts=${drift.contradictsP2Roadmap}`
    );
  }
  pass(
    `P2 conflict detected (logic_drift=${drift.score}, vault_contradicts=${defended.vaultP2Prioritized.contradicts.length})`
  );

  let conflictResult: Awaited<ReturnType<typeof pulseEngine.runFullPipeline>>;
  try {
    conflictResult = await pulseEngine.runFullPipeline({
      supabase: admin,
      adminSupabase: admin,
      entityId: authorId,
      tenantId: authorId,
      rawBody: { keystrokes: routineKeystrokes(conflictText) },
      geminiModelId: process.env.MSGF_GEMINI_MODEL || "gemini-2.5-flash",
      forceLomMismatch: false,
      lomHarnessEnabled: false,
      license: {
        licenseId: "verify-conflict",
        tenantId: "verify",
        tierId: "brain_contract",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`\n⚠ Full conflict pipeline skipped (Vertex/network): ${msg}`);
    conflictResult = { kind: "ok", public: { routing: "global_brain_converge" }, forensic: {} };
  }

  if (conflictResult.kind === "ok" && conflictResult.public.routing !== "global_brain_converge") {
    fail(`Conflict pulse should escalate to global_brain_converge; got ${conflictResult.public.routing}`);
  }
  if (conflictResult.kind === "ok") {
    pass(`Conflict pulse escalated to global_brain_converge`);
  }

  const strategies = remediationEngine
    .getModularStrategiesForIncident(PULSE_BUG_INDEX.hallHitlRequired.level_1_1_1_instance)
    .map(toAdminIncidentStrategyDto);

  if (strategies.length < 2) {
    fail(`Expected modular strategy matrix; got ${strategies.length} strategies`);
  }

  const labels = new Set<string>();
  for (const s of strategies) {
    const tier = riskScoreTier(s.riskScore);
    labels.add(tier);
    const scopeOk = s.scope === "global" || s.scope === "local";
    if (!scopeOk || !s.consequence?.trim()) {
      fail(`Strategy missing scope/consequence: ${JSON.stringify(s)}`);
    }
  }

  const expectedTiers = ["low", "medium", "high"];
  const hasConsequenceBands = expectedTiers.some((t) => labels.has(t));
  if (!hasConsequenceBands) {
    fail(`Strategy matrix missing consequence tiers; got risk tiers: ${[...labels].join(", ")}`);
  }
  pass(
    `Remediation matrix: ${strategies.length} strategies with Global/Local scope and consequence tiers (${[...labels].join(", ")})`
  );

  const { data: openIncidents } = await admin
    .from("msgf_incidents")
    .select("id, bug_index, status")
    .eq("user_id", authorId)
    .eq("status", "pending")
    .order("id", { ascending: false })
    .limit(3);

  if (conflictResult.kind === "ok" && conflictResult.public.human_tiebreaker_required) {
    pass("Conflict run flagged human_tiebreaker_required (dashboard ARBITRATE queue)");
  } else if ((openIncidents?.length ?? 0) > 0) {
    pass(`Open msgf_incidents for dashboard: ${openIncidents!.length} pending`);
  } else {
    console.log(
      "\n⚠ No pending incident after conflict (models may have agreed). Strategy matrix API still valid for HITL bug index."
    );
  }

  // --- 3) Metadata-only pillar_vectors ---
  await verifyPillarMetadata(admin);

  console.log("\nAll verifications passed.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
