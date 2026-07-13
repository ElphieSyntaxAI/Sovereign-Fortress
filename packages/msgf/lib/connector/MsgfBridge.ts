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
 * Distribution Build ID: MSGF-a7aa881-20260620T084430Z-internal
 */
import { throwForMsgfPulseResponse } from "./error-mapper";
import {
  parseIngestApiResponse,
  type IngestPayload,
  type IngestResult,
} from "./ingest-payload";
import {
  notifyAuthorPulseRejected,
  type AuthorPulseRejectedNotifyResult,
  type AuthorPulseRejectedPayload,
} from "./notify-author-pulse-rejected";
import { toPulseRequestBody, type P1Standard } from "./p1-standard";
import {
  MSGF_BRAIN_SENSITIVITY_HEADER,
  resolveBrainSensitivityHeader,
} from "@/lib/connector/brain-sensitivity";
import { assertTenantId } from "@/lib/errors/sovereign-violation";
import { licenseBearerHeaders } from "@/lib/connector/bearer-auth";
import { normalizeConnectorTenantId } from "@/lib/connector/tenant";
import { MSGF_TENANT_ID_HEADER } from "@/lib/msgf-http-headers";
import {
  buildReportSystemIssueBody,
  postReportSystemIssue,
  type ReportSystemIssueParams,
} from "./report-system-issue";
import {
  bundleSentinelTelemetry,
  type SentinelTelemetryBundle,
} from "./sentinel-snapshot-bundle";
import type { SelfHealReportUIResult } from "./self-heal-report-ui";
import {
  resolveVaultSessionStore,
  type VaultSessionStore,
  type VaultSessionStoreOptions,
} from "./session-store";

export type { ReportSystemIssueParams, SelfHealReportUIResult };
export { bundleSentinelTelemetry, buildReportSystemIssueBody, postReportSystemIssue };

export type MsgfBridgeConfig = {
  /** Project silo slug or UUID (sent on ingest + `x-msgf-tenant-id` for Pulse). */
  tenantId: string;
  /** MSGF host origin (e.g. `https://msgf.example.com`). Falls back to `MSGF_APP_URL`. */
  baseUrl?: string;
  /** Contract license (`msgf_live_…`). Falls back to `MSGF_CONTRACT_LICENSE_KEY`. */
  licenseKey?: string;
  /** Service-role or MSGF admin API key — required for {@link MsgfBridge.notifyAuthorPulseRejected}. */
  adminBearer?: string;
  /** When true, caches `vault_narrative_log_id` in `localStorage` (browser) or memory (SSR). */
  sessionPersistence?: boolean | VaultSessionStoreOptions;
  credentials?: RequestCredentials;
  fetchImpl?: typeof fetch;
  /**
   * Default Brain sensitivity for all {@link MsgfBridge.dispatch} calls (0.1 strict → 0.5 relaxed).
   * Overridden per payload via {@link P1Standard.brainSensitivity}.
   */
  brainSensitivity?: number;
};

export type {
  IngestPayload,
  IngestResult,
  IngestFilePayload,
} from "./ingest-payload";
export type {
  AuthorPulseRejectedPayload,
  AuthorPulseRejectedNotifyResult,
} from "./notify-author-pulse-rejected";

export type PulseDispatchResult = {
  ok: boolean;
  vaultNarrativeLogId: string | null;
  hallNarrativeLogId: string | null;
  humanTiebreakerRequired: boolean;
  baselineRequired: boolean;
  ledger: string | null;
  raw: Record<string, unknown>;
};

/**
 * Thin HTTP client for MSGF API routes — pipeline runs on the MSGF host only.
 * Cross-app bridge — instantiate per tenant/product or use {@link MsgfBridge.configure}.
 *
 * ```ts
 * const bridge = new MsgfBridge({
 *   tenantId: "boss-repo-qa",
 *   baseUrl: "https://msgf.example.com",
 *   licenseKey: "msgf_live_…",
 * });
 * await bridge.dispatch({ keystrokes: [...] });
 * ```
 */
export class MsgfBridge {
  private static instance: MsgfBridge | null = null;

  readonly tenantId: string;
  private readonly licenseKey: string;
  private readonly baseUrl: string;
  private readonly adminBearer: string | undefined;
  private readonly credentials: RequestCredentials;
  private readonly fetchImpl: typeof fetch;
  private readonly sessionStore: VaultSessionStore | null;
  private readonly brainSensitivity: number | undefined;

  constructor(config: MsgfBridgeConfig) {
    assertTenantId(config.tenantId, "MsgfBridge");
    const tenantId = normalizeConnectorTenantId(config.tenantId);

    const key =
      config.licenseKey?.trim() ||
      process.env.MSGF_CONTRACT_LICENSE_KEY?.trim() ||
      "";
    const base =
      config.baseUrl?.trim().replace(/\/$/, "") ||
      process.env.MSGF_APP_URL?.trim().replace(/\/$/, "") ||
      "";

    if (!key) {
      throw new Error(
        "MsgfBridge: licenseKey is required (config or MSGF_CONTRACT_LICENSE_KEY)."
      );
    }
    if (!base) {
      throw new Error("MsgfBridge: baseUrl is required (config or MSGF_APP_URL).");
    }

    this.tenantId = tenantId;
    this.licenseKey = key;
    this.baseUrl = base;
    this.adminBearer = config.adminBearer?.trim() || undefined;
    this.credentials = config.credentials ?? "include";
    this.fetchImpl = config.fetchImpl ?? fetch.bind(globalThis);
    this.sessionStore = resolveVaultSessionStore(config.sessionPersistence);
    this.brainSensitivity =
      config.brainSensitivity != null
        ? resolveBrainSensitivityHeader(config.brainSensitivity)
        : undefined;
  }

  /** Initialize (or replace) the process-wide singleton. */
  static configure(config: MsgfBridgeConfig): MsgfBridge {
    MsgfBridge.instance = new MsgfBridge(config);
    return MsgfBridge.instance;
  }

  /** Alias for {@link configure}. */
  static init(config: MsgfBridgeConfig): MsgfBridge {
    return MsgfBridge.configure(config);
  }

  static getInstance(): MsgfBridge {
    if (!MsgfBridge.instance) {
      throw new Error(
        "MsgfBridge is not configured. Call MsgfBridge.configure({ tenantId, baseUrl, licenseKey }) or new MsgfBridge(...)."
      );
    }
    return MsgfBridge.instance;
  }

  /** Test-only reset. */
  static reset(): void {
    MsgfBridge.instance = null;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  getLastVaultNarrativeLogId(): string | null {
    return this.sessionStore?.getVaultNarrativeLogId() ?? null;
  }

  clearVaultSession(): void {
    this.sessionStore?.clear();
  }

  /**
   * SWEEP ingest — seeds P1–P6 governance pillars for a new tenant and returns Brain readiness.
   *
   * - **100%** — six pillars present and biometric baseline training complete.
   * - **&lt;100%** — missing pillars and/or Pulse baseline training still required.
   *
   * Pass `files: []` to run pillar-only bootstrap without codebase shards.
   */
  async ingest(data: IngestPayload = {}): Promise<IngestResult> {
    assertTenantId(this.tenantId, "MsgfBridge.ingest");
    const tenantId = data.tenantId?.trim() || this.tenantId;
    assertTenantId(tenantId, "MsgfBridge.ingest");
    const apiKey = data.apiKey?.trim() || this.licenseKey;
    const url = `${this.baseUrl}/api/msgf/ingest`;
    const files = data.files ?? [];

    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...licenseBearerHeaders(apiKey),
        },
        credentials: this.credentials,
        body: JSON.stringify({
          tenant_id: tenantId,
          project_origin: data.projectOrigin?.trim() || undefined,
          files,
        }),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "MSGF ingest network error.";
      throw new Error(`MsgfBridge ingest failed: ${message}`);
    }

    const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (!res.ok) {
      const detail =
        typeof raw.error === "string" ? raw.error : `MSGF ingest failed (${res.status}).`;
      throw new Error(detail);
    }

    return parseIngestApiResponse(raw);
  }

  /** Run 3-pass document compiler scan (external hookups — Dealstar, etc.). */
  async documentCompilerScan(params: {
    text: string;
    domainProfile?: "author_narrative" | "education_curriculum" | "generic";
    projectOrigin?: string;
    slot?: "world_bible" | "current_draft" | "character_sheet";
    manuscriptId?: string;
    subjectDomain?: "ela" | "history" | "math" | "science" | "general";
    filename?: string;
  }): Promise<Record<string, unknown>> {
    assertTenantId(this.tenantId, "MsgfBridge.documentCompilerScan");
    const url = `${this.baseUrl}/api/msgf/document-compiler/scan`;
    const res = await this.fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...licenseBearerHeaders(this.licenseKey, { [MSGF_TENANT_ID_HEADER]: this.tenantId }),
      },
      credentials: this.credentials,
      body: JSON.stringify({
        text: params.text,
        domain_profile: params.domainProfile ?? "generic",
        tenant_id: this.tenantId,
        project_origin: params.projectOrigin,
        slot: params.slot,
        manuscript_id: params.manuscriptId,
        subject_domain: params.subjectDomain,
        filename: params.filename,
      }),
    });
    const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const detail =
        typeof raw.error === "string" ? raw.error : `Document compiler scan failed (${res.status}).`;
      throw new Error(detail);
    }
    return raw;
  }

  /** DEFEND-guarded document compiler commit for a prior scan session. */
  async documentCompilerCommit(params: {
    sessionId: string;
    proposed?: Array<Record<string, unknown>>;
    outlineBeats?: Array<Record<string, unknown>>;
    forceCommit?: boolean;
  }): Promise<Record<string, unknown>> {
    assertTenantId(this.tenantId, "MsgfBridge.documentCompilerCommit");
    const url = `${this.baseUrl}/api/msgf/document-compiler/commit`;
    const res = await this.fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...licenseBearerHeaders(this.licenseKey, { [MSGF_TENANT_ID_HEADER]: this.tenantId }),
      },
      credentials: this.credentials,
      body: JSON.stringify({
        session_id: params.sessionId,
        proposed: params.proposed,
        outline_beats: params.outlineBeats,
        force_commit: params.forceCommit,
      }),
    });
    const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const detail =
        typeof raw.error === "string"
          ? raw.error
          : typeof raw.reason === "string"
            ? raw.reason
            : `Document compiler commit failed (${res.status}).`;
      throw new Error(detail);
    }
    return raw;
  }

  /** True when {@link IngestResult.readiness_score} is 100 (Brain fully initialized). */
  isBrainReady(result: Pick<IngestResult, "readiness_score" | "brain_fully_initialized">): boolean {
    return result.brain_fully_initialized || result.readiness_score >= 100;
  }

  /**
   * POST universal P1 telemetry to MSGF Pulse.
   * Maps **403** → {@link HaltException}, **429** → {@link EntitlementException}.
   */
  async dispatch(payload: P1Standard): Promise<PulseDispatchResult> {
    assertTenantId(this.tenantId, "MsgfBridge.dispatch");
    const url = `${this.baseUrl}/api/msgf/pulse`;
    const body = toPulseRequestBody(payload);
    const sensitivity = resolveBrainSensitivityHeader(
      payload.brainSensitivity ?? this.brainSensitivity
    );
    const sensitivityHeader =
      payload.brainSensitivity != null || this.brainSensitivity != null
        ? String(sensitivity)
        : undefined;

    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...licenseBearerHeaders(this.licenseKey, {
            [MSGF_TENANT_ID_HEADER]: this.tenantId,
            ...(sensitivityHeader
              ? { [MSGF_BRAIN_SENSITIVITY_HEADER]: sensitivityHeader }
              : {}),
          }),
        },
        credentials: this.credentials,
        body: JSON.stringify(body),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "MSGF Pulse network error.";
      throw new Error(`MsgfBridge dispatch failed: ${message}`);
    }

    const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (!res.ok) {
      throwForMsgfPulseResponse(res.status, raw);
    }

    const vaultId =
      typeof raw.vault_narrative_log_id === "string" ? raw.vault_narrative_log_id : null;
    const hallId =
      typeof raw.hall_narrative_log_id === "string" ? raw.hall_narrative_log_id : null;

    if (vaultId && this.sessionStore) {
      this.sessionStore.setVaultNarrativeLogId(vaultId);
    }

    return {
      ok: raw.ok === true,
      vaultNarrativeLogId: vaultId,
      hallNarrativeLogId: hallId,
      humanTiebreakerRequired: raw.human_tiebreaker_required === true,
      baselineRequired: raw.baseline_required === true,
      ledger: typeof raw.ledger === "string" ? raw.ledger : null,
      raw,
    };
  }

  /**
   * Bundle allowlisted localStorage + biometric keystroke telemetry for Sentinel snapshots.
   */
  bundleSentinelTelemetry(
    keystrokes?: Array<Record<string, unknown>>
  ): SentinelTelemetryBundle {
    const vaultId = this.sessionStore?.getVaultNarrativeLogId() ?? null;
    const bundle = bundleSentinelTelemetry({ keystrokes });
    if (vaultId && !bundle.local_storage.vault_narrative_log_id) {
      bundle.local_storage.vault_narrative_log_id = vaultId;
    }
    return bundle;
  }

  /**
   * GET six-pillar stoplight health (requires admin Bearer or session on MSGF host).
   */
  async fetchPillarHealth(params?: { lookbackHours?: number }): Promise<Record<string, unknown>> {
    const hours = params?.lookbackHours ?? 168;
    const url = `${this.baseUrl}/api/msgf/health/pillars?lookback_hours=${encodeURIComponent(String(hours))}`;
    assertTenantId(this.tenantId, "MsgfBridge.fetchPillarHealth");
    const token = this.adminBearer?.trim() || this.licenseKey;
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...licenseBearerHeaders(token, { [MSGF_TENANT_ID_HEADER]: this.tenantId }),
    };

    const res = await this.fetchImpl(url, {
      method: "GET",
      headers,
      credentials: this.credentials,
    });
    const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const detail =
        typeof raw.error === "string" ? raw.error : `MSGF pillar health failed (${res.status}).`;
      throw new Error(detail);
    }
    return raw;
  }

  /**
   * POST full diagnostic snapshot to admin self-heal report (requires {@link MsgfBridgeConfig.adminBearer}).
   * Prefer {@link reportSystemIssue} for bundled telemetry + UI-mapped responses.
   */
  async submitDiagnosticSnapshot(
    snapshot: Record<string, unknown> & { operator_note: string; author_id?: string }
  ): Promise<Record<string, unknown>> {
    if (!this.adminBearer) {
      throw new Error("MsgfBridge.submitDiagnosticSnapshot: adminBearer is required.");
    }

    const result = await this.reportSystemIssue({
      operatorNote: snapshot.operator_note,
      authorId: typeof snapshot.author_id === "string" ? snapshot.author_id : undefined,
      snapshot,
      reportEndpointUrl: `${this.baseUrl}/api/msgf/admin/self-heal/report`,
      adminBearer: this.adminBearer,
      actAsUserId: typeof snapshot.author_id === "string" ? snapshot.author_id : undefined,
      fetchImpl: this.fetchImpl,
      credentials: this.credentials,
    });
    return result.raw;
  }

  /**
   * Sentinel Report Issue — bundles localStorage + biometric telemetry, posts self-heal report,
   * returns UI copy (e.g. "Pillar Flow Sequence (P2) has been self-healed. Please resume.").
   */
  async reportSystemIssue(params: ReportSystemIssueParams): Promise<SelfHealReportUIResult> {
    const keystrokes =
      params.keystrokes ??
      (Array.isArray(params.snapshot?.keystrokes_last_10)
        ? (params.snapshot!.keystrokes_last_10 as Array<Record<string, unknown>>)
        : undefined);

    const telemetry = this.bundleSentinelTelemetry(keystrokes);

    const reportEndpointUrl =
      params.reportEndpointUrl?.trim() ||
      (this.adminBearer
        ? `${this.baseUrl}/api/msgf/admin/self-heal/report`
        : "");

    if (!reportEndpointUrl) {
      throw new Error(
        "MsgfBridge.reportSystemIssue: reportEndpointUrl or adminBearer + baseUrl required."
      );
    }

    return postReportSystemIssue({
      ...params,
      tenantId: params.tenantId ?? this.tenantId,
      keystrokes: telemetry.biometric_telemetry.keystrokes_last_10,
      snapshot: {
        ...(params.snapshot ?? {}),
        tenant_id: params.tenantId ?? params.snapshot?.tenant_id ?? this.tenantId,
        local_storage: telemetry.local_storage,
        biometric_telemetry: telemetry.biometric_telemetry,
        keystrokes_last_10: telemetry.biometric_telemetry.keystrokes_last_10,
      },
      reportEndpointUrl,
      adminBearer: params.adminBearer ?? this.adminBearer,
      actAsUserId: params.actAsUserId ?? params.entityId ?? params.authorId,
      fetchImpl: params.fetchImpl ?? this.fetchImpl,
      credentials: params.credentials ?? this.credentials,
    });
  }

  async notifyAuthorPulseRejected(
    payload: AuthorPulseRejectedPayload
  ): Promise<AuthorPulseRejectedNotifyResult> {
    if (!this.adminBearer) {
      return {
        notified: false,
        skipped: "MsgfBridge: adminBearer not configured.",
      };
    }

    return notifyAuthorPulseRejected({
      baseUrl: this.baseUrl,
      adminBearer: this.adminBearer,
      payload,
      fetchImpl: this.fetchImpl,
    });
  }
}
