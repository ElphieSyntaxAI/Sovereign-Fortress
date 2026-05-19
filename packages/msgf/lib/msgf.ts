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
 * Distribution Build ID: MSGF-2790974-20260519T053954Z-internal
 */
/**
 * MSGF runtime — `Msgf.init()` registers host plug-ins (P2 roadmap, entitlements).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { MsgfBridge, type MsgfBridgeConfig } from "@/lib/connector/MsgfBridge";
import {
  DEFAULT_P2_ROADMAP,
  loadP2RoadmapFromRules,
  type P2RoadmapConfig,
} from "@/lib/services/p2-flow-roadmap";
import type {
  EntitlementPlugin,
  MsgfPluginRegistry,
  P2RoadmapPlugin,
} from "@/lib/msgf-plugins";

export type MsgfInitConfig = MsgfPluginRegistry & {
  /**
   * Optional default HTTP bridge for this process (`MsgfBridge.configure`).
   * Frontends may also call `new MsgfBridge({ tenantId, baseUrl, licenseKey })` directly.
   */
  bridge?: MsgfBridgeConfig;
};

let registry: MsgfPluginRegistry = {};
let initialized = false;

function normalizeP2Plugin(
  plugin?: P2RoadmapConfig | P2RoadmapPlugin
): P2RoadmapPlugin | undefined {
  if (!plugin) return undefined;
  if (typeof plugin === "function") return plugin;
  const staticRoadmap = plugin as P2RoadmapConfig;
  return async () => staticRoadmap;
}

export class MsgfRuntime {
  readonly defaultTenantId?: string;
  readonly p2Roadmap: P2RoadmapPlugin;
  readonly entitlement?: EntitlementPlugin;

  constructor(config: MsgfPluginRegistry = {}) {
    this.defaultTenantId = config.defaultTenantId?.trim() || undefined;
    this.p2Roadmap =
      normalizeP2Plugin(config.p2Roadmap) ??
      ((supabase, tenantId) => loadP2RoadmapFromRules(supabase, tenantId));
    this.entitlement = config.entitlement;
  }

  async loadP2Roadmap(
    supabase?: SupabaseClient,
    tenantId?: string
  ): Promise<P2RoadmapConfig> {
    const tid = tenantId?.trim() || this.defaultTenantId?.trim();
    if (!tid) {
      return DEFAULT_P2_ROADMAP;
    }
    const loaded = await this.p2Roadmap(supabase, tid);
    return loaded ?? DEFAULT_P2_ROADMAP;
  }

  getEntitlementPlugin(): EntitlementPlugin | undefined {
    return this.entitlement;
  }
}

function mergeRegistry(config: MsgfInitConfig): MsgfPluginRegistry {
  return {
    defaultTenantId: config.defaultTenantId ?? registry.defaultTenantId,
    p2Roadmap: config.p2Roadmap ?? registry.p2Roadmap,
    entitlement: config.entitlement ?? registry.entitlement,
  };
}

let runtime = new MsgfRuntime();

export const Msgf = {
  /**
   * Register host plug-ins once per process (P2 roadmap, Stripe/entitlement, default tenant).
   *
   * @example
   * ```ts
   * Msgf.init({
   *   defaultTenantId: "boss-repo-qa",
   *   p2Roadmap: async () => ({ ...customSteps }),
   *   entitlement: {
   *     evaluatePulse: ({ profile }) =>
   *       profile.current_credits > 0 ? { allowed: true } : { allowed: false, reason: "No credits" },
   *   },
   *   bridge: { tenantId: "boss-repo-qa", baseUrl: "https://msgf.example.com", licenseKey: "msgf_live_…" },
   * });
   * ```
   */
  init(config: MsgfInitConfig = {}): MsgfRuntime {
    const { bridge, ...plugins } = config;
    registry = mergeRegistry(plugins);
    runtime = new MsgfRuntime(registry);
    initialized = true;

    if (bridge) {
      const tenantId = bridge.tenantId?.trim() || registry.defaultTenantId?.trim();
      if (!tenantId) {
        throw new Error("Msgf.init: bridge.tenantId or defaultTenantId is required when bridge is set.");
      }
      MsgfBridge.configure({ ...bridge, tenantId });
    }

    return runtime;
  },

  /** Active runtime (defaults when {@link init} was not called). */
  getRuntime(): MsgfRuntime {
    return runtime;
  },

  isInitialized(): boolean {
    return initialized;
  },

  /** Resolves P2 roadmap via registered plug-in or built-in `msgf_rules` loader. */
  async loadP2Roadmap(
    supabase?: SupabaseClient,
    tenantId?: string
  ): Promise<P2RoadmapConfig> {
    return runtime.loadP2Roadmap(supabase, tenantId);
  },
};

export function getMsgfRuntime(): MsgfRuntime {
  return runtime;
}
