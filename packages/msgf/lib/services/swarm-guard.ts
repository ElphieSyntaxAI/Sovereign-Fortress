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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
/**
 * Secondary-agent swarm monitor — cheap Redis graph + mandate binding.
 * Extra agents are allowed; drifting / fan-out children are aborted per wave.
 */

import { createHash } from "node:crypto";

import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  MSGF_AGENT_ID_HEADER,
  MSGF_AGENT_ROLE_HEADER,
  MSGF_ENTITY_ID_HEADER,
  MSGF_MANDATE_HASH_HEADER,
  MSGF_PARENT_AGENT_ID_HEADER,
} from "@/lib/msgf-http-headers";
import {
  isRedisConfigured,
  msgfRedisKey,
  redisDel,
  redisGet,
  redisSet,
  redisSetNx,
} from "@/lib/redis";
import { emitPlatformAudit } from "@/lib/services/emit-platform-audit";
import { emitResourceUsage } from "@/lib/services/emit-resource-usage";
import { persistToHall } from "@/lib/services/constraint-ledger";
import { PULSE_BUG_INDEX } from "@/lib/schemas/vault-hall-metadata";
import type { GlobalBrainSwarmTelemetry } from "@/lib/schemas/global-brain-swarm-telemetry";
import { tripRemediationCircuitBreaker } from "@/lib/services/remediation-retry-circuit";
import { insertMsgfArbitrateIncident } from "@/lib/services/msgf-incidents";
import { PulseHttpError } from "@/lib/services/pulse-http-error";
import {
  buildGlobalBrainSwarmTelemetry,
  hashOpaqueIdPrefix,
  swarmSpawnDepth,
} from "@/lib/services/global-brain-swarm-telemetry";
import {
  primaryFixForCauses,
  swarmFixesToHitlStrategies,
  type SwarmCauseCode,
  type SwarmSuggestedFix,
} from "@/lib/services/swarm-fix-catalog";
import type { LogicDriftAssessment } from "@/lib/services/logic-drift";
import { REPUTATION_PRUNE_THRESHOLD, resourceKeyForMandateHash } from "@/lib/schemas/source-audit";
import { loadReputationMap, p7AuditKeyLists } from "@/lib/services/source-audit";
import { swarmDetectedP7Hits, writeLiveP7 } from "@/lib/services/p7-observe";

export const BOT_SWARM_ERROR = "BOT_SWARM_DETECTED" as const;
export const SWARM_GRAPH_TTL_SEC = 15 * 60;
export const SWARM_WINDOW_SEC = 60;
export const DEFAULT_SWARM_FANOUT_MAX = 6;
export const DEFAULT_SWARM_ENTITY_MAX = 8;
export const DEFAULT_SWARM_INFLIGHT_MAX = 4;
export const DEFAULT_SWARM_MAX_DEPTH = 2;
export const SWARM_SECONDARY_LOCK_TTL_SEC = 45;

export type AgentRole = "primary" | "secondary" | "system_heal";

export type SwarmAgentIdentity = {
  agentId: string;
  parentAgentId: string | null;
  role: AgentRole;
  mandateHash: string | null;
  entityId: string;
  tenantId: string;
};

export type SwarmEdge = {
  from: string;
  to: string;
  kind: "spawn" | "tool" | "peer";
};

export type SwarmGraphSnapshot = {
  children: string[];
  entities: string[];
  edges: SwarmEdge[];
  parentOf: Record<string, string>;
  mandateByParent: Record<string, string>;
  inflight: number;
  locks: string[];
};

export type SwarmStore = {
  available: boolean;
  load(tenantId: string, parentAgentId: string): Promise<SwarmGraphSnapshot>;
  save(tenantId: string, parentAgentId: string, graph: SwarmGraphSnapshot): Promise<void>;
  tryLockSecondary(tenantId: string, entityId: string): Promise<boolean>;
};

export type SwarmEvaluateInput = {
  identity: SwarmAgentIdentity;
  toolNameHash?: string | null;
  peerAgentId?: string | null;
  sessionTokens?: number;
  maxSessionTokens?: number;
  store?: SwarmStore;
  admin?: SupabaseClient | null;
  /** Test/synthetic hook — skip DB and treat this child as P7-pruned. */
  reputationPrune?: boolean;
};

export type SwarmEvaluateOk = {
  ok: true;
  identity: SwarmAgentIdentity;
  graph: SwarmGraphSnapshot;
};

export type SwarmEvaluateTrip = {
  ok: false;
  identity: SwarmAgentIdentity;
  cause_codes: SwarmCauseCode[];
  suggested_fix: SwarmSuggestedFix;
  graph: SwarmGraphSnapshot;
};

export type SwarmEvaluateResult = SwarmEvaluateOk | SwarmEvaluateTrip;

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]?.trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function swarmFanoutMax(): number {
  return envInt("MSGF_SWARM_FANOUT_MAX", DEFAULT_SWARM_FANOUT_MAX);
}
export function swarmEntityMax(): number {
  return envInt("MSGF_SWARM_ENTITY_MAX", DEFAULT_SWARM_ENTITY_MAX);
}
export function swarmInflightMax(): number {
  return envInt("MSGF_SWARM_MAX_INFLIGHT", DEFAULT_SWARM_INFLIGHT_MAX);
}

export function hashMandate(text: string): string {
  return createHash("sha256").update(text.trim(), "utf8").digest("hex");
}

export function normalizeMandateHash(raw: string | null | undefined): string | null {
  const t = raw?.trim().toLowerCase() ?? "";
  if (!t) return null;
  if (/^[0-9a-f]{64}$/.test(t)) return t;
  return hashMandate(t);
}

export function parseAgentRole(raw: string | null | undefined, hasParent: boolean): AgentRole {
  const v = raw?.trim().toLowerCase() ?? "";
  if (v === "secondary" || v === "system_heal" || v === "primary") return v;
  return hasParent ? "secondary" : "primary";
}

export function parseAgentIdentityFromHeaders(params: {
  headers: Headers;
  tenantId: string;
  entityId: string;
  mandateSeed?: string | null;
}): SwarmAgentIdentity {
  const h = params.headers;
  const parent = h.get(MSGF_PARENT_AGENT_ID_HEADER)?.trim() || null;
  const role = parseAgentRole(h.get(MSGF_AGENT_ROLE_HEADER), Boolean(parent));
  const agentId =
    h.get(MSGF_AGENT_ID_HEADER)?.trim() ||
    h.get(MSGF_ENTITY_ID_HEADER)?.trim() ||
    params.entityId.trim();
  let mandateHash = normalizeMandateHash(h.get(MSGF_MANDATE_HASH_HEADER));
  if (!mandateHash && role === "primary" && params.mandateSeed?.trim()) {
    mandateHash = hashMandate(params.mandateSeed);
  }
  return {
    agentId: agentId || params.entityId.trim() || "unknown",
    parentAgentId: parent,
    role,
    mandateHash,
    entityId: params.entityId.trim(),
    tenantId: params.tenantId.trim(),
  };
}

export function parseAgentIdentityFromRequest(
  req: NextRequest,
  tenantId: string,
  entityId: string,
  mandateSeed?: string | null
): SwarmAgentIdentity {
  return parseAgentIdentityFromHeaders({
    headers: req.headers,
    tenantId,
    entityId,
    mandateSeed,
  });
}

export function emptySwarmGraph(): SwarmGraphSnapshot {
  return {
    children: [],
    entities: [],
    edges: [],
    parentOf: {},
    mandateByParent: {},
    inflight: 0,
    locks: [],
  };
}

export function spawnDepth(parentOf: Record<string, string>, agentId: string): number {
  return swarmSpawnDepth(parentOf, agentId, DEFAULT_SWARM_MAX_DEPTH + 2);
}

export function detectSwarmCauses(params: {
  identity: SwarmAgentIdentity;
  graph: SwarmGraphSnapshot;
  redisAvailable: boolean;
  peerAgentId?: string | null;
  sessionTokens?: number;
  maxSessionTokens?: number;
  fanoutMax?: number;
  entityMax?: number;
  inflightMax?: number;
}): SwarmCauseCode[] {
  const causes: SwarmCauseCode[] = [];
  const { identity, graph } = params;
  if (identity.role !== "secondary") return causes;

  if (!params.redisAvailable) {
    causes.push("redis_unavailable");
    return causes;
  }
  if (!identity.mandateHash) {
    causes.push("mandate_missing");
    return causes;
  }
  const parent = identity.parentAgentId;
  if (!parent) {
    causes.push("graph_anomaly");
    return causes;
  }
  const stored = graph.mandateByParent[parent];
  if (!stored) {
    causes.push("mandate_unbound");
  } else if (stored !== identity.mandateHash) {
    causes.push("mandate_mismatch");
  }

  const uniqueChildren = new Set(graph.children);
  uniqueChildren.add(identity.agentId);
  if (uniqueChildren.size > (params.fanoutMax ?? swarmFanoutMax())) {
    causes.push("fanout_exceeded");
  }

  const uniqueEntities = new Set(graph.entities);
  uniqueEntities.add(identity.entityId);
  if (uniqueEntities.size > (params.entityMax ?? swarmEntityMax())) {
    causes.push("entity_swarm");
  }

  if (graph.inflight + 1 > (params.inflightMax ?? swarmInflightMax())) {
    causes.push("inflight_exceeded");
  }

  const parentOf = { ...graph.parentOf, [identity.agentId]: parent };
  if (spawnDepth(parentOf, identity.agentId) > DEFAULT_SWARM_MAX_DEPTH) {
    causes.push("spawn_depth");
  }
  if (graph.children.includes(parent) && graph.parentOf[parent]) {
    causes.push("graph_anomaly");
  }

  const peer = params.peerAgentId?.trim();
  if (peer && peer !== parent && peer !== identity.agentId) {
    const sameParent = graph.parentOf[peer] === parent || graph.children.includes(peer);
    if (sameParent) causes.push("graph_anomaly");
  }

  const maxTok = params.maxSessionTokens ?? 0;
  if (maxTok > 0 && (params.sessionTokens ?? 0) > maxTok) {
    causes.push("resource_spike");
  }

  return [...new Set(causes)];
}

const memoryGraphs = new Map<string, SwarmGraphSnapshot>();
const memoryLocks = new Set<string>();

function memoryKey(tenantId: string, parentAgentId: string): string {
  return `${tenantId}::${parentAgentId || "_root"}`;
}

export function createMemorySwarmStore(): SwarmStore {
  return {
    available: true,
    async load(tenantId, parentAgentId) {
      const g = memoryGraphs.get(memoryKey(tenantId, parentAgentId));
      return g ? structuredClone(g) : emptySwarmGraph();
    },
    async save(tenantId, parentAgentId, graph) {
      memoryGraphs.set(memoryKey(tenantId, parentAgentId), structuredClone(graph));
    },
    async tryLockSecondary(tenantId, entityId) {
      const k = `${tenantId}::${entityId}`;
      if (memoryLocks.has(k)) return false;
      memoryLocks.add(k);
      return true;
    },
  };
}

export function resetMemorySwarmStore(): void {
  memoryGraphs.clear();
  memoryLocks.clear();
}

function redisParentKey(tenantId: string, parent: string): string {
  return msgfRedisKey("swarm", "g", tenantId, parent || "_root");
}

export function createRedisSwarmStore(): SwarmStore {
  return {
    available: isRedisConfigured(),
    async load(tenantId, parentAgentId) {
      if (!isRedisConfigured()) return emptySwarmGraph();
      const raw = await redisGet(redisParentKey(tenantId, parentAgentId));
      if (!raw) return emptySwarmGraph();
      try {
        const parsed = JSON.parse(raw) as SwarmGraphSnapshot;
        return {
          ...emptySwarmGraph(),
          ...parsed,
          children: Array.isArray(parsed.children) ? parsed.children : [],
          entities: Array.isArray(parsed.entities) ? parsed.entities : [],
          edges: Array.isArray(parsed.edges) ? parsed.edges : [],
          parentOf: parsed.parentOf && typeof parsed.parentOf === "object" ? parsed.parentOf : {},
          mandateByParent:
            parsed.mandateByParent && typeof parsed.mandateByParent === "object"
              ? parsed.mandateByParent
              : {},
          inflight: Number(parsed.inflight ?? 0),
          locks: Array.isArray(parsed.locks) ? parsed.locks : [],
        };
      } catch {
        return emptySwarmGraph();
      }
    },
    async save(tenantId, parentAgentId, graph) {
      if (!isRedisConfigured()) return;
      await redisSet(
        redisParentKey(tenantId, parentAgentId),
        JSON.stringify(graph),
        SWARM_GRAPH_TTL_SEC
      );
    },
    async tryLockSecondary(tenantId, entityId) {
      if (!isRedisConfigured()) return false;
      return redisSetNx(
        msgfRedisKey("swarm", "lock", tenantId, entityId),
        "1",
        SWARM_SECONDARY_LOCK_TTL_SEC
      );
    },
  };
}

function defaultStore(): SwarmStore {
  if (isRedisConfigured()) return createRedisSwarmStore();
  return {
    available: false,
    async load() {
      return emptySwarmGraph();
    },
    async save() {
      /* fail-closed: no graph without Redis */
    },
    async tryLockSecondary() {
      return false;
    },
  };
}

function tripFrom(
  identity: SwarmAgentIdentity,
  graph: SwarmGraphSnapshot,
  causes: SwarmCauseCode[]
): SwarmEvaluateTrip {
  return {
    ok: false,
    identity,
    cause_codes: causes,
    suggested_fix: primaryFixForCauses(causes),
    graph,
  };
}

export function buildSwarmTrip(
  identity: SwarmAgentIdentity,
  causes: SwarmCauseCode[],
  graph: SwarmGraphSnapshot = emptySwarmGraph()
): SwarmEvaluateTrip {
  return tripFrom(identity, graph, causes);
}

export async function evaluateSwarmAdmission(input: SwarmEvaluateInput): Promise<SwarmEvaluateResult> {
  const identity = input.identity;
  const store = input.store ?? defaultStore();
  const parentKey = identity.parentAgentId ?? identity.agentId;
  const graph = await store.load(identity.tenantId, parentKey);
  const tenantGraph = await store.load(identity.tenantId, "__tenant__");
  graph.entities = [...new Set([...graph.entities, ...tenantGraph.entities])];
  graph.inflight = Math.max(graph.inflight, tenantGraph.inflight);

  if (identity.role === "system_heal") {
    return { ok: true, identity, graph };
  }

  if (identity.role === "primary") {
    if (identity.mandateHash) {
      graph.mandateByParent[identity.agentId] = identity.mandateHash;
    }
    if (identity.entityId && !graph.entities.includes(identity.entityId)) {
      graph.entities.push(identity.entityId);
    }
    await store.save(identity.tenantId, identity.agentId, graph);
    await store.save(identity.tenantId, "__tenant__", {
      ...emptySwarmGraph(),
      entities: graph.entities,
      inflight: graph.inflight,
    });
    return { ok: true, identity, graph };
  }

  let agentOrMandatePruned = input.reputationPrune === true;
  let parentPruned = false;
  if (!agentOrMandatePruned && input.admin) {
    try {
      const agentKey = hashOpaqueIdPrefix(identity.agentId);
      const keys = [agentKey];
      if (identity.mandateHash) keys.push(resourceKeyForMandateHash(identity.mandateHash));
      if (identity.parentAgentId) keys.push(hashOpaqueIdPrefix(identity.parentAgentId));
      const map = await loadReputationMap(input.admin, identity.tenantId, keys);
      const agentScore = map.get(agentKey);
      const mandateScore = identity.mandateHash
        ? map.get(resourceKeyForMandateHash(identity.mandateHash))
        : undefined;
      const parentScore = identity.parentAgentId
        ? map.get(hashOpaqueIdPrefix(identity.parentAgentId))
        : undefined;
      if (
        (typeof agentScore === "number" && agentScore < REPUTATION_PRUNE_THRESHOLD) ||
        (typeof mandateScore === "number" && mandateScore < REPUTATION_PRUNE_THRESHOLD)
      ) {
        agentOrMandatePruned = true;
      }
      if (typeof parentScore === "number" && parentScore < REPUTATION_PRUNE_THRESHOLD) {
        parentPruned = true;
      }
    } catch (e) {
      console.warn("[swarm-guard] reputation read failed:", e instanceof Error ? e.message : e);
    }
  }

  const causes = detectSwarmCauses({
    identity,
    graph,
    redisAvailable: store.available,
    peerAgentId: input.peerAgentId,
    sessionTokens: input.sessionTokens,
    maxSessionTokens: input.maxSessionTokens,
    inflightMax: parentPruned ? 1 : undefined,
  });
  if (agentOrMandatePruned) causes.push("reputation_prune");
  if (causes.length) return tripFrom(identity, graph, [...new Set(causes)]);

  const locked = await store.tryLockSecondary(identity.tenantId, identity.entityId);
  if (!locked) {
    return tripFrom(identity, graph, ["session_lock"]);
  }

  const parent = identity.parentAgentId!;
  if (!graph.children.includes(identity.agentId)) graph.children.push(identity.agentId);
  if (identity.entityId && !graph.entities.includes(identity.entityId)) {
    graph.entities.push(identity.entityId);
  }
  graph.parentOf[identity.agentId] = parent;
  graph.edges.push({ from: parent, to: identity.agentId, kind: "spawn" });
  if (input.toolNameHash) {
    graph.edges.push({ from: identity.agentId, to: input.toolNameHash, kind: "tool" });
  }
  graph.inflight += 1;
  await store.save(identity.tenantId, parent, graph);
  await store.save(identity.tenantId, "__tenant__", {
    ...emptySwarmGraph(),
    entities: graph.entities,
    inflight: graph.inflight,
  });
  return { ok: true, identity, graph };
}

export function swarmHttpBody(trip: SwarmEvaluateTrip): Record<string, unknown> {
  return {
    error: BOT_SWARM_ERROR,
    cause_codes: trip.cause_codes,
    suggested_fix: trip.suggested_fix,
    hitl: true,
    agent_id: trip.identity.agentId,
    parent_agent_id: trip.identity.parentAgentId,
  };
}

export function swarmPulseHttpError(trip: SwarmEvaluateTrip): PulseHttpError {
  return new PulseHttpError(409, swarmHttpBody(trip), BOT_SWARM_ERROR);
}

export async function persistSwarmDetection(params: {
  admin: SupabaseClient;
  trip: SwarmEvaluateTrip;
  traceId: string;
  product?: string;
  promptSessionId?: string | null;
  filePath?: string;
  tokensIn?: number;
  tokensOut?: number;
  logicDrift?: Pick<
    LogicDriftAssessment,
    "score" | "escalateToGlobalBrain" | "factors"
  > | null;
  kind?: "bot_swarm_detected" | "bot_swarm_observed";
}): Promise<GlobalBrainSwarmTelemetry> {
  const { trip, admin } = params;
  const { identity, cause_codes } = trip;
  const strategies = swarmFixesToHitlStrategies(cause_codes);
  const reason = `bot_swarm_detected: ${cause_codes.join(",")}`;
  const kind = params.kind ?? "bot_swarm_detected";
  const telemetry = buildGlobalBrainSwarmTelemetry({
    trip,
    kind,
    tokensIn: params.tokensIn,
    tokensOut: params.tokensOut,
    logicDrift: params.logicDrift,
  });
  const agentHash = hashOpaqueIdPrefix(identity.agentId);
  const entityHash = hashOpaqueIdPrefix(identity.entityId);
  const parentHash = identity.parentAgentId
    ? hashOpaqueIdPrefix(identity.parentAgentId)
    : null;
  const p7Hits = swarmDetectedP7Hits(trip);
  const p7Lists = p7AuditKeyLists([], p7Hits);

  emitPlatformAudit(admin, {
    product: params.product ?? "msgf",
    tenant_id: identity.tenantId,
    entity_id: identity.entityId,
    kind,
    severity: kind === "bot_swarm_detected" ? "critical" : "warn",
    trace_id: params.traceId,
    summary: reason,
    metadata: {
      ...telemetry,
      suggested_fix_id: telemetry.primary_fix_id,
      prompt_session_id: params.promptSessionId ?? null,
      ...p7Lists,
    },
  });

  emitResourceUsage(admin, {
    tenant_id: identity.tenantId,
    product: "msgf",
    kind: "agent",
    resource_key: agentHash,
    trace_id: params.traceId,
    content_hash: identity.mandateHash,
  });

  if (kind === "bot_swarm_observed") {
    return telemetry;
  }

  writeLiveP7({
    admin,
    tenantId: identity.tenantId,
    entityId: identity.entityId,
    traceId: params.traceId,
    blockHits: p7Hits,
    outcome: "block",
    decisionKind: "arbitrate",
    routing: "swarm_abort",
    highDrift: true,
    defendTier: "RED",
    defendReason: reason,
  });

  try {
    await persistToHall({
      supabase: admin,
      entityId: identity.entityId,
      tenantId: identity.tenantId,
      content: reason,
      bugIndex: PULSE_BUG_INDEX.hallBotSwarm,
      reason,
      actionType: "BOT_SWARM_DETECTED",
      severity: "Violation",
      narrativeExtra: {
        ...telemetry,
        agent_id_hash: agentHash,
        parent_agent_id_hash: parentHash,
        entity_id_hash: entityHash,
      },
    });
  } catch (e) {
    console.warn("[swarm-guard] hall persist failed:", e instanceof Error ? e.message : e);
  }

  const filePath =
    params.filePath?.trim() ||
    `swarm://${telemetry.silo_ref}/${entityHash}/${agentHash}`;
  try {
    await tripRemediationCircuitBreaker({
      admin,
      tenantId: identity.tenantId,
      filePath,
      bugIndex: PULSE_BUG_INDEX.hallBotSwarm,
      reason,
      source: "swarm_guard",
    });
  } catch (e) {
    console.warn("[swarm-guard] circuit trip failed:", e instanceof Error ? e.message : e);
  }

  try {
    await insertMsgfArbitrateIncident({
      adminSupabase: admin,
      userId: identity.entityId,
      bugIndex: PULSE_BUG_INDEX.hallBotSwarm,
      strategies,
      scope: { tenantId: identity.tenantId, entityId: identity.entityId },
      metadataExtra: {
        ...telemetry,
        agent_id_hash: agentHash,
        parent_agent_id_hash: parentHash,
        suggested_fix_id: telemetry.primary_fix_id,
      },
    });
  } catch (e) {
    console.warn("[swarm-guard] HITL insert failed:", e instanceof Error ? e.message : e);
  }

  return telemetry;
}

export async function evaluateAndMaybeAbortSwarm(params: {
  admin: SupabaseClient | null;
  identity: SwarmAgentIdentity;
  traceId: string;
  store?: SwarmStore;
  peerAgentId?: string | null;
  toolNameHash?: string | null;
  sessionTokens?: number;
  maxSessionTokens?: number;
  product?: string;
  logicDrift?: Pick<
    LogicDriftAssessment,
    "score" | "escalateToGlobalBrain" | "factors"
  > | null;
}): Promise<SwarmEvaluateOk> {
  const result = await evaluateSwarmAdmission({
    identity: params.identity,
    store: params.store,
    peerAgentId: params.peerAgentId,
    toolNameHash: params.toolNameHash,
    sessionTokens: params.sessionTokens,
    maxSessionTokens: params.maxSessionTokens,
    admin: params.admin,
  });
  if (result.ok) {
    if (params.admin && params.identity.role === "secondary") {
      emitResourceUsage(params.admin, {
        tenant_id: params.identity.tenantId,
        product: (params.product as "msgf" | "ide" | "gateway") ?? "msgf",
        kind: "agent",
        resource_key: hashOpaqueIdPrefix(params.identity.agentId),
        trace_id: params.traceId,
        content_hash: params.identity.mandateHash,
      });
      if (params.toolNameHash) {
        emitResourceUsage(params.admin, {
          tenant_id: params.identity.tenantId,
          product: (params.product as "msgf" | "ide" | "gateway") ?? "msgf",
          kind: "tool",
          resource_key: params.toolNameHash,
          trace_id: params.traceId,
        });
      }
    }
    return result;
  }
  if (params.admin) {
    await persistSwarmDetection({
      admin: params.admin,
      trip: result,
      traceId: params.traceId,
      product: params.product,
      logicDrift: params.logicDrift,
    });
  }
  throw swarmPulseHttpError(result);
}

export async function releaseSecondaryLock(tenantId: string, entityId: string): Promise<void> {
  await redisDel(msgfRedisKey("swarm", "lock", tenantId, entityId));
}
