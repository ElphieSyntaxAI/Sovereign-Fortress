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
 * Distribution Build ID: MSGF-6d594fa-20260519T162432Z-internal
 */
/**
 * Public SDK types — re-exported from {@link ./index.ts} only (no server engines).
 */

export type {
  MsgfTenantConfig,
  MsgfPulseInput,
  MsgfPulseResult,
} from "@/lib/MsgfClient";

export type {
  MsgfSentinelProps,
  MsgfSentinelTenantConfig,
  MsgfSentinelReportSuccess,
  DiagnosticSnapshotPayload,
} from "../ui";

export { DEFAULT_MSGF_SENTINEL_TENANT } from "../ui";
