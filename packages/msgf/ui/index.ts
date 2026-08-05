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
 * Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
 */
export {
  MsgfSentinel,
  DEFAULT_MSGF_SENTINEL_TENANT,
  SentinelBugButton,
  type MsgfSentinelProps,
  type MsgfSentinelTenantConfig,
  type MsgfSentinelReportSuccess,
  type DiagnosticSnapshotPayload,
  type SentinelBugButtonProps,
  type SentinelReportSuccess,
} from "./MsgfSentinel";

export {
  MSGF_REPORT_ISSUE_PATH,
  MSGF_LEGACY_INCIDENT_REPORT_PATH,
  resolveMsgfReportIssueUrl,
  coerceReportIssueUrl,
} from "@/lib/msgf-report-url";
