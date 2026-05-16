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
 * Distribution Build ID: MSGF-51d39b5-20260516T031044Z-internal
 */
/**
 * Thin MSGF connector — HTTP only. Safe for browser / Vite client bundles.
 *
 * Pulse, remediation, and LOM run on `packages/msgf/app/api/*` only.
 * Server-side engines: `msgf/connector/server` or `msgf/remediation`.
 */

export {
  SovereignViolationError,
  assertTenantId,
} from "@/lib/errors/sovereign-violation";
export { formatBearerAuthorization, licenseBearerHeaders } from "@/lib/connector/bearer-auth";
export {
  MsgfBridge,
  type MsgfBridgeConfig,
  type PulseDispatchResult,
  type IngestPayload,
  type IngestResult,
  type IngestFilePayload,
} from "./MsgfBridge";
export { parseIngestApiResponse } from "./ingest-payload";
export {
  EntitlementException,
  HaltException,
  MsgfBridgeException,
  type MsgfErrorDetails,
} from "./exceptions";
export { throwForMsgfPulseResponse } from "./error-mapper";
export { toPulseRequestBody } from "./p1-standard";
export type { P1Standard, P1KeystrokeEvent } from "./p1-standard";
export {
  notifyAuthorPulseRejected,
  type AuthorPulseRejectedPayload,
  type AuthorPulseRejectedNotifyResult,
} from "./notify-author-pulse-rejected";
export {
  createLocalVaultSessionStore,
  createMemoryVaultSessionStore,
  DEFAULT_VAULT_SESSION_KEY,
  resolveVaultSessionStore,
  type VaultSessionStore,
  type VaultSessionStoreOptions,
} from "./session-store";
export {
  bundleSentinelTelemetry,
  SENTINEL_LOCAL_STORAGE_ALLOWLIST,
  type BiometricTelemetry,
  type LocalStorageBundle,
  type SentinelTelemetryBundle,
} from "./sentinel-snapshot-bundle";
export {
  buildReportSystemIssueBody,
  postReportSystemIssue,
  type ReportSystemIssueParams,
  type ReportSystemIssueSnapshotBody,
} from "./report-system-issue";
export {
  formatSentinelResumeMessage,
  parseSelfHealReportResponse,
  pillarLabelForId,
  type HealedPillarSummary,
  type SelfHealReportApiResponse,
  type SelfHealReportUIResult,
} from "./self-heal-report-ui";
export {
  LOGIC_DRIFT_ESCALATION_THRESHOLD,
  LOGIC_DRIFT_THRESHOLD_MIN,
  LOGIC_DRIFT_THRESHOLD_MAX,
  MSGF_BRAIN_SENSITIVITY_HEADER,
  resolveBrainSensitivityHeader,
} from "./brain-sensitivity";
export { normalizeConnectorTenantId } from "./tenant";
export {
  IdeConnector,
  createIdeConnector,
  type IdeConnectorConfig,
  type IdePulseBufferOptions,
  type IdeStatusBarSnapshot,
  type IdeBufferedPulseResult,
  type IdeStatusRouting,
} from "@/lib/ide-connector";
