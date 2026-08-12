/**
 * MSGF operator URLs scoped to Author Ecosystem stress-test traffic.
 * Shared by MSGF admin portal and Author `/admin` surfaces.
 */

import { buildMsgfAuthorHandoffUrl } from "./operator-handoff-url.js";

export const AUTHOR_MSGF_TENANT_ID = "author_ecosystem";
export const AUTHOR_MSGF_PROJECT_ORIGIN = "elphiesyntax/author-ecosystem";

export type AuthorAdminMsgfLinks = {
  tenant_id: string;
  project_origin: string;
  portal: string;
  ops_console: string;
  pillar_health: string;
  token_savings: string;
  big_brain: string;
  governance_dashboard: string;
  period_reports: string;
  vault_quarantine: string;
  shadow_proxy: string;
  heal_queue: string;
};

export function buildAuthorAdminMsgfLinks(msgfOrigin: string): AuthorAdminMsgfLinks {
  const base = msgfOrigin.replace(/\/+$/, "");
  const tenantQ = `tenant_id=${encodeURIComponent(AUTHOR_MSGF_TENANT_ID)}`;

  return {
    tenant_id: AUTHOR_MSGF_TENANT_ID,
    project_origin: AUTHOR_MSGF_PROJECT_ORIGIN,
    portal: `${base}/admin/portal`,
    ops_console: `${base}/admin/ops`,
    pillar_health: `${base}/admin/dashboard`,
    token_savings: `${base}/admin/dashboard#token-savings?${tenantQ}`,
    big_brain: `${base}/admin/dashboard#big-brain-issues?${tenantQ}`,
    governance_dashboard: `${base}/dashboard?${tenantQ}`,
    period_reports: `${base}/dashboard/daily-reports?${tenantQ}`,
    vault_quarantine: `${base}/admin/ops#vault-quarantine`,
    shadow_proxy: `${base}/dashboard#token-savings?${tenantQ}`,
    heal_queue: `${base}/admin/ops#heal-queue`,
  };
}

export function buildMsgfToAuthorHandoffUrl(
  msgfOrigin: string,
  authorReturnTo: string
): string {
  return buildMsgfAuthorHandoffUrl(msgfOrigin, authorReturnTo);
}
