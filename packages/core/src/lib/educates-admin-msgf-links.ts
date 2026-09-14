/**
 * MSGF operator URLs scoped to Syntax Educates / education tenant traffic.
 */

export const EDUCATES_MSGF_TENANT_ID = "syntax_education";
export const EDUCATES_MSGF_PROJECT_ORIGIN = "elphiesyntax/syntax-educates";

export type EducatesAdminMsgfLinks = {
  tenant_id: string;
  project_origin: string;
  ops_console: string;
  governance_dashboard: string;
  audit_hub: string;
  session_replay: string;
  model_fitness: string;
  siem_integrations: string;
};

export function buildEducatesAdminMsgfLinks(msgfOrigin: string): EducatesAdminMsgfLinks {
  const base = msgfOrigin.replace(/\/+$/, "");
  const tenantQ = `tenant_id=${encodeURIComponent(EDUCATES_MSGF_TENANT_ID)}`;

  return {
    tenant_id: EDUCATES_MSGF_TENANT_ID,
    project_origin: EDUCATES_MSGF_PROJECT_ORIGIN,
    ops_console: `${base}/admin/ops`,
    governance_dashboard: `${base}/dashboard?${tenantQ}`,
    audit_hub: `${base}/admin/ops#audit-hub`,
    session_replay: `${base}/admin/ops#session-replay`,
    model_fitness: `${base}/admin/ops#model-fitness`,
    siem_integrations: `${base}/admin/ops#siem-integrations`,
  };
}
