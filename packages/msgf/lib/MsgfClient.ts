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
 * Distribution Build ID: MSGF-ee924ab-20260518T235305Z-internal
 */
/**
 * Multi-tenant MSGF SDK — delegates Pulse to `POST /api/msgf/pulse` via {@link MsgfBridge}.
 */

import { MsgfBridge, type MsgfBridgeConfig } from "@/lib/connector/MsgfBridge";
import type { P1Standard } from "@/lib/connector/p1-standard";
import { assertTenantId } from "@/lib/errors/sovereign-violation";
import { normalizeConnectorTenantId } from "@/lib/connector/tenant";

export type MsgfPulseResult =
  | { kind: "ok"; body: Record<string, unknown> }
  | { kind: "baseline_required"; body: Record<string, unknown> };

export type MsgfTenantConfig = MsgfBridgeConfig;

/** Pulse body accepted by {@link MsgfClient.pulse} (forwarded to the Pulse API). */
export type MsgfPulseInput = P1Standard;

/**
 * Per-tenant MSGF client — HTTP only; pipeline runs on the MSGF host.
 */
export class MsgfClient {
  readonly tenantId: string;
  private readonly bridge: MsgfBridge;

  constructor(config: MsgfTenantConfig) {
    assertTenantId(config.tenantId, "MsgfClient");
    this.tenantId = normalizeConnectorTenantId(config.tenantId);
    this.bridge = new MsgfBridge({ ...config, tenantId: this.tenantId });
  }

  getTenantId(): string {
    return this.tenantId;
  }

  /** Underlying bridge for ingest, pillar health, and Sentinel reporting. */
  getBridge(): MsgfBridge {
    return this.bridge;
  }

  /**
   * Runs the full pipeline on the MSGF server (`POST /api/msgf/pulse`).
   */
  async pulse(input: MsgfPulseInput): Promise<MsgfPulseResult> {
    assertTenantId(this.tenantId, "MsgfClient.pulse");
    const result = await this.bridge.dispatch(input);
    const body = result.raw;

    if (result.baselineRequired || body.baseline_required === true) {
      return { kind: "baseline_required", body };
    }

    return { kind: "ok", body };
  }
}
