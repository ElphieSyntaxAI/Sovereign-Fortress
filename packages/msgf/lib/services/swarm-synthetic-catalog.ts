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
 * Synthetic swarm stress cases — fake mandates we own, never user prompts.
 * Replay against swarm-guard to confirm the same cause_codes trip.
 */

import { buildGlobalBrainSwarmTelemetry } from "@/lib/services/global-brain-swarm-telemetry";
import type { GlobalBrainSwarmTelemetry } from "@/lib/schemas/global-brain-swarm-telemetry";
import {
  SWARM_CAUSE_CODES,
  type SwarmCauseCode,
} from "@/lib/services/swarm-fix-catalog";
import {
  buildSwarmTrip,
  createMemorySwarmStore,
  DEFAULT_SWARM_FANOUT_MAX,
  DEFAULT_SWARM_INFLIGHT_MAX,
  emptySwarmGraph,
  evaluateSwarmAdmission,
  hashMandate,
  resetMemorySwarmStore,
  type SwarmAgentIdentity,
  type SwarmEvaluateTrip,
  type SwarmStore,
} from "@/lib/services/swarm-guard";

export const SYNTHETIC_MANDATE_PREFIX = "SYNTHETIC_MSGF_STRESS";

export type SyntheticSwarmDatasetRow = {
  synthetic_id: string;
  synthetic_mandate: string;
  telemetry: GlobalBrainSwarmTelemetry;
};

export function syntheticMandateForCause(cause: SwarmCauseCode): string {
  return `${SYNTHETIC_MANDATE_PREFIX} ${cause} graph-loop-alpha`;
}

function failClosedStore(): SwarmStore {
  return {
    available: false,
    async load() {
      return emptySwarmGraph();
    },
    async save() {
      /* fail-closed */
    },
    async tryLockSecondary() {
      return false;
    },
  };
}

function childIdentity(
  tenantId: string,
  parentId: string,
  agentId: string,
  mandate: string,
  extra?: Partial<SwarmAgentIdentity>
): SwarmAgentIdentity {
  return {
    agentId,
    parentAgentId: parentId,
    role: "secondary",
    mandateHash: hashMandate(mandate),
    entityId: extra?.entityId ?? `${agentId}-e`,
    tenantId,
    ...extra,
  };
}

async function bindParent(
  store: SwarmStore,
  tenantId: string,
  parentId: string,
  mandate: string
): Promise<void> {
  const result = await evaluateSwarmAdmission({
    identity: {
      agentId: parentId,
      parentAgentId: null,
      role: "primary",
      mandateHash: hashMandate(mandate),
      entityId: `${parentId}-e`,
      tenantId,
    },
    store,
  });
  if (!result.ok) {
    throw new Error(`synthetic parent bind failed: ${result.cause_codes.join(",")}`);
  }
}

function withEnv(vars: Record<string, string>, fn: () => Promise<SwarmEvaluateTrip>): Promise<SwarmEvaluateTrip> {
  const prior: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    prior[k] = process.env[k];
    process.env[k] = v;
  }
  return fn().finally(() => {
    for (const [k, old] of Object.entries(prior)) {
      if (old === undefined) delete process.env[k];
      else process.env[k] = old;
    }
  });
}

async function tripFromAdmission(
  store: SwarmStore,
  identity: SwarmAgentIdentity,
    extra?: {
    peerAgentId?: string;
    sessionTokens?: number;
    maxSessionTokens?: number;
    reputationPrune?: boolean;
  }
): Promise<SwarmEvaluateTrip> {
  const result = await evaluateSwarmAdmission({
    identity,
    store,
    peerAgentId: extra?.peerAgentId,
    sessionTokens: extra?.sessionTokens,
    maxSessionTokens: extra?.maxSessionTokens,
    reputationPrune: extra?.reputationPrune,
  });
  if (result.ok) {
    throw new Error(`synthetic expected trip for ${identity.agentId}, admission allowed`);
  }
  return result;
}

export async function replaySyntheticSwarmCase(
  cause: SwarmCauseCode
): Promise<SyntheticSwarmDatasetRow> {
  resetMemorySwarmStore();
  const store = createMemorySwarmStore();
  const tenantId = `synth_${cause}`;
  const parentId = "synth-parent";
  const mandate = syntheticMandateForCause(cause);
  let trip: SwarmEvaluateTrip;

  switch (cause) {
    case "redis_unavailable":
      trip = await tripFromAdmission(
        failClosedStore(),
        childIdentity(tenantId, parentId, "synth-child", mandate)
      );
      break;
    case "mandate_missing":
      await bindParent(store, tenantId, parentId, mandate);
      trip = await tripFromAdmission(
        store,
        childIdentity(tenantId, parentId, "synth-child", mandate, {
          mandateHash: null,
        })
      );
      break;
    case "mandate_mismatch":
      await bindParent(store, tenantId, parentId, mandate);
      trip = await tripFromAdmission(
        store,
        childIdentity(tenantId, parentId, "synth-child", `${mandate} DRIFT`)
      );
      break;
    case "mandate_unbound":
      trip = await tripFromAdmission(
        store,
        childIdentity(tenantId, parentId, "synth-child", mandate)
      );
      break;
    case "graph_anomaly":
      await bindParent(store, tenantId, parentId, mandate);
      await evaluateSwarmAdmission({
        identity: childIdentity(tenantId, parentId, "synth-sib", mandate, {
          entityId: "synth-sib-e",
        }),
        store,
      });
      trip = await tripFromAdmission(
        store,
        childIdentity(tenantId, parentId, "synth-child", mandate, {
          entityId: "synth-child-e",
        }),
        { peerAgentId: "synth-sib" }
      );
      break;
    case "spawn_depth": {
      const midId = "synth-mid";
      await bindParent(store, tenantId, parentId, mandate);
      const g = await store.load(tenantId, midId);
      g.mandateByParent[midId] = hashMandate(mandate);
      g.parentOf[midId] = parentId;
      g.parentOf[parentId] = "synth-root";
      await store.save(tenantId, midId, g);
      trip = await tripFromAdmission(
        store,
        childIdentity(tenantId, midId, "synth-child", mandate)
      );
      break;
    }
    case "fanout_exceeded":
      trip = await withEnv({ MSGF_SWARM_MAX_INFLIGHT: "20", MSGF_SWARM_ENTITY_MAX: "20" }, async () => {
        await bindParent(store, tenantId, parentId, mandate);
        for (let i = 0; i < DEFAULT_SWARM_FANOUT_MAX; i += 1) {
          const allowed = await evaluateSwarmAdmission({
            identity: childIdentity(tenantId, parentId, `synth-c${i}`, mandate, {
              entityId: `synth-e${i}`,
            }),
            store,
          });
          if (!allowed.ok) {
            throw new Error(`fanout fixture child ${i} tripped early: ${allowed.cause_codes.join(",")}`);
          }
        }
        return tripFromAdmission(
          store,
          childIdentity(tenantId, parentId, "synth-overflow", mandate, {
            entityId: "synth-overflow-e",
          })
        );
      });
      break;
    case "entity_swarm":
      trip = await withEnv({ MSGF_SWARM_MAX_INFLIGHT: "20", MSGF_SWARM_FANOUT_MAX: "20" }, async () => {
        await bindParent(store, tenantId, parentId, mandate);
        const g = await store.load(tenantId, parentId);
        for (let i = 0; i < 8; i += 1) {
          g.entities.push(`pre-e${i}`);
        }
        await store.save(tenantId, parentId, g);
        await store.save(tenantId, "__tenant__", {
          ...emptySwarmGraph(),
          entities: g.entities,
        });
        return tripFromAdmission(
          store,
          childIdentity(tenantId, parentId, "synth-child", mandate, {
            entityId: "synth-new-entity",
          })
        );
      });
      break;
    case "inflight_exceeded":
      await bindParent(store, tenantId, parentId, mandate);
      {
        const g = await store.load(tenantId, parentId);
        g.inflight = DEFAULT_SWARM_INFLIGHT_MAX;
        await store.save(tenantId, parentId, g);
        await store.save(tenantId, "__tenant__", {
          ...emptySwarmGraph(),
          inflight: DEFAULT_SWARM_INFLIGHT_MAX,
          entities: g.entities,
        });
      }
      trip = await tripFromAdmission(
        store,
        childIdentity(tenantId, parentId, "synth-child", mandate)
      );
      break;
    case "session_lock":
      await bindParent(store, tenantId, parentId, mandate);
      {
        const first = await evaluateSwarmAdmission({
          identity: childIdentity(tenantId, parentId, "synth-first", mandate, {
            entityId: "locked-e",
          }),
          store,
        });
        if (!first.ok) {
          throw new Error(`session_lock fixture first child tripped: ${first.cause_codes.join(",")}`);
        }
      }
      trip = await tripFromAdmission(
        store,
        childIdentity(tenantId, parentId, "synth-second", mandate, {
          entityId: "locked-e",
        })
      );
      break;
    case "resource_spike":
      await bindParent(store, tenantId, parentId, mandate);
      trip = await tripFromAdmission(
        store,
        childIdentity(tenantId, parentId, "synth-child", mandate),
        { sessionTokens: 9_000, maxSessionTokens: 100 }
      );
      break;
    case "non_human_secondary":
      await bindParent(store, tenantId, parentId, mandate);
      trip = buildSwarmTrip(
        childIdentity(tenantId, parentId, "synth-child", mandate),
        ["non_human_secondary"]
      );
      break;
    case "reputation_prune":
      await bindParent(store, tenantId, parentId, mandate);
      trip = await tripFromAdmission(
        store,
        childIdentity(tenantId, parentId, "synth-child", mandate),
        { reputationPrune: true }
      );
      break;
    default: {
      const _exhaustive: never = cause;
      throw new Error(`unhandled synthetic cause: ${_exhaustive}`);
    }
  }

  if (!trip.cause_codes.includes(cause)) {
    throw new Error(
      `synthetic ${cause} produced ${trip.cause_codes.join(",") || "(none)"}`
    );
  }

  return {
    synthetic_id: `synth_${cause}`,
    synthetic_mandate: mandate,
    telemetry: buildGlobalBrainSwarmTelemetry({
      trip,
      kind: "bot_swarm_detected",
      tokensIn: cause === "resource_spike" ? 4200 : 40,
      tokensOut: 20,
    }),
  };
}

export async function collectSyntheticSwarmDataset(): Promise<SyntheticSwarmDatasetRow[]> {
  const rows: SyntheticSwarmDatasetRow[] = [];
  for (const cause of SWARM_CAUSE_CODES) {
    rows.push(await replaySyntheticSwarmCase(cause));
  }
  return rows;
}
