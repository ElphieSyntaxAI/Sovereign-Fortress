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
 * Distribution Build ID: MSGF-48a02b8-20260530T050749Z-internal
 */
/**
 * Canonical MSGF issue report endpoint paths.
 */

export const MSGF_REPORT_ISSUE_PATH = "/api/msgf/report-issue";

/** @deprecated Use {@link MSGF_REPORT_ISSUE_PATH} — kept for redirects and docs. */
export const MSGF_LEGACY_INCIDENT_REPORT_PATH = "/api/msgf/incidents/report";

export function resolveMsgfReportIssueUrl(baseUrl?: string | null): string {
  const trimmed = baseUrl?.trim().replace(/\/$/, "");
  if (trimmed) return `${trimmed}${MSGF_REPORT_ISSUE_PATH}`;
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${MSGF_REPORT_ISSUE_PATH}`;
  }
  return MSGF_REPORT_ISSUE_PATH;
}

export function isLegacyIncidentReportUrl(url: string): boolean {
  return url.includes(MSGF_LEGACY_INCIDENT_REPORT_PATH);
}

export function coerceReportIssueUrl(url: string, baseUrl?: string | null): string {
  if (isLegacyIncidentReportUrl(url)) {
    return resolveMsgfReportIssueUrl(baseUrl ?? url.split(MSGF_LEGACY_INCIDENT_REPORT_PATH)[0]);
  }
  return url;
}
