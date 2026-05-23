import { resolveAuthorMsgfAppUrl, resolveAuthorMsgfTenantId } from "./authorMsgfMapping.js";

export type AuthorMsgfDashboardLinks = {
  tenant_id: string;
  project_origin: string;
  token_savings: string | null;
  pulse_routing: string | null;
  dashboard: string | null;
  admin_token_savings: string | null;
  admin_big_brain: string | null;
};

/** MSGF dashboard URLs for observing Author stress-test traffic (token savings + routing). */
export function buildAuthorMsgfDashboardLinks(tenantId?: string | null): AuthorMsgfDashboardLinks {
  const base = resolveAuthorMsgfAppUrl();
  const tenant_id = resolveAuthorMsgfTenantId(tenantId);
  const q = `tenant_id=${encodeURIComponent(tenant_id)}`;
  const project_origin = "elphiesyntax/author-ecosystem";

  if (!base) {
    return {
      tenant_id,
      project_origin,
      token_savings: null,
      pulse_routing: null,
      dashboard: null,
      admin_token_savings: null,
      admin_big_brain: null,
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
  };
}
