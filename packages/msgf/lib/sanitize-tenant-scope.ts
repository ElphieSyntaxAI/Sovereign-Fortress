/** Strip stray wrapping quotes from pasted tenant / project_origin values. */
export function sanitizeTenantScope(value: string): string {
  let t = value.trim();
  while (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }
  return t;
}
