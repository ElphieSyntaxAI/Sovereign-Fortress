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
 * MSGF public SDK — {@link MsgfClient}, {@link MsgfSentinel}, and tenant-scoped types only.
 *
 * Internal engines (LOM recursion, pillar baseline, Pulse pipeline) are not exported.
 * Host apps use `msgf/connector` (HTTP client) in browsers and `msgf/connector/server`
 * or `msgf/onboarding` only on the server / BFF.
 *
 * @example
 * ```ts
 * import { MsgfClient, MsgfSentinel, SovereignViolationError } from "msgf";
 *
 * const brain = new MsgfClient({ tenantId: "my-repo", baseUrl, licenseKey });
 * ```
 */

export { MsgfClient } from "@/lib/MsgfClient";

export {
  MsgfSentinel,
  DEFAULT_MSGF_SENTINEL_TENANT,
} from "../ui";

export type {
  MsgfTenantConfig,
  MsgfPulseInput,
  MsgfPulseResult,
  MsgfSentinelProps,
  MsgfSentinelTenantConfig,
  MsgfSentinelReportSuccess,
  DiagnosticSnapshotPayload,
} from "@/lib/public-types";

export {
  SovereignViolationError,
  assertTenantId,
} from "@/lib/errors/sovereign-violation";
