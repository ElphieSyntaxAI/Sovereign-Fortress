/**
 * Mapped repo branch for MSGF tracking (`msgf_user_projects.project_origin`).
 * Only `org/repo`-style tenant keys are sent as project_origin — never folder names.
 */

export const MSGF_PROJECT_ORIGIN_HEADER = "x-msgf-project-origin";

export function tenantKeyLooksLikeProjectOrigin(key: string | null | undefined): boolean {
  const k = key?.trim();
  if (!k || k.length > 256) return false;
  if (k.includes(" ")) return false;
  return k.includes("/");
}

/** Returns mapped `project_origin` when `msgf.tenantKey` is set to `org/repo`. */
export function resolveMappedProjectOrigin(tenantKey: string): string | undefined {
  const k = tenantKey.trim();
  if (!tenantKeyLooksLikeProjectOrigin(k)) return undefined;
  return k.slice(0, 256);
}
