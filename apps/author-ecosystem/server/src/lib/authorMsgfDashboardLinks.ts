import {
  AUTHOR_MSGF_PROJECT_ORIGIN,
  resolveAuthorMsgfAppUrl,
  resolveAuthorMsgfTenantId,
} from "./authorMsgfEnv.js";

export type AuthorMsgfDashboardLinks = {
  tenant_id: string;
  project_origin: string;
  token_savings: string | null;
  pulse_routing: string | null;
  dashboard: string | null;
  admin_token_savings: string | null;
  admin_big_brain: string | null;
  period_reports: string | null;
  period_reports_pdf: string | null;
  shadow_proxy: string | null;
  vault_quarantine: string | null;
  deploy_gate: string | null;
  heal_queue: string | null;
};

export function buildAuthorGovernanceDashboardLinks(tenantId?: string | null): Pick<
  AuthorMsgfDashboardLinks,
  | "period_reports"
  | "period_reports_pdf"
  | "shadow_proxy"
  | "vault_quarantine"
  | "deploy_gate"
  | "heal_queue"
> {
  const base = resolveAuthorMsgfAppUrl();
  const tenant = resolveAuthorMsgfTenantId(tenantId);
  const q = `tenant_id=${encodeURIComponent(tenant)}`;
  if (!base) {
    return {
      period_reports: null,
      period_reports_pdf: null,
      shadow_proxy: null,
      vault_quarantine: null,
      deploy_gate: null,
      heal_queue: null,
    };
  }
  const originQ = `project_origin=${encodeURIComponent(AUTHOR_MSGF_PROJECT_ORIGIN)}`;
  return {
    period_reports: `${base}/dashboard/daily-reports?${q}`,
    period_reports_pdf: `${base}/api/msgf/dashboard/period-reports/pdf?${q}&scope=all`,
    shadow_proxy: `${base}/dashboard#token-savings?${q}`,
    vault_quarantine: `${base}/admin/ops#vault-quarantine`,
    deploy_gate: `${base}/api/msgf/deploy-gate?${originQ}`,
    heal_queue: `${base}/admin/ops#heal-queue`,
  };
}

/** MSGF dashboard URLs for observing Author stress-test traffic (token savings + routing). */
export function buildAuthorMsgfDashboardLinks(tenantId?: string | null): AuthorMsgfDashboardLinks {
  const base = resolveAuthorMsgfAppUrl();
  const tenant_id = resolveAuthorMsgfTenantId(tenantId);
  const q = `tenant_id=${encodeURIComponent(tenant_id)}`;
  const project_origin = AUTHOR_MSGF_PROJECT_ORIGIN;
  const governance = buildAuthorGovernanceDashboardLinks(tenant_id);

  if (!base) {
    return {
      tenant_id,
      project_origin,
      token_savings: null,
      pulse_routing: null,
      dashboard: null,
      admin_token_savings: null,
      admin_big_brain: null,
      ...governance,
    };
  }

  return {
    tenant_id,
    project_origin,
    token_savings: `${base}/dashboard#token-savings?${q}`,
    pulse_routing: `${base}/dashboard?${q}#pulse-routing`,
    dashboard: `${base}/dashboard?${q}`,
    admin_token_savings: `${base}/admin/dashboard#token-savings?${q}`,
    admin_big_brain: `${base}/admin/dashboard#big-brain-issues?${q}`,
    ...governance,
  };
}
