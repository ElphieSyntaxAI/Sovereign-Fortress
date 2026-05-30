/**
 * Monorepo app silos — keep in sync with packages/msgf/lib/services/monorepo-workspace-presets.ts
 */
export type MonorepoProductPreset = {
  id: string;
  label: string;
  projectOrigin: string;
  productPath: string;
};

export const MONOREPO_PRODUCT_PRESETS: readonly MonorepoProductPreset[] = [
  {
    id: "msgf-gated-ai",
    label: "MSGF Gated AI",
    projectOrigin: "elphiesyntax/msgf",
    productPath: "packages/msgf",
  },
  {
    id: "author-ecosystem",
    label: "Author Ecosystem",
    projectOrigin: "elphiesyntax/author-ecosystem",
    productPath: "apps/author-ecosystem",
  },
  {
    id: "syntax-educates",
    label: "Syntax Educates",
    projectOrigin: "elphiesyntax/syntax-educates",
    productPath: "apps/syntax-educates",
  },
  {
    id: "client-vortex",
    label: "Vortex Client",
    projectOrigin: "elphiesyntax/client-vortex",
    productPath: "apps/client-vortex",
  },
] as const;

export function presetForProjectOrigin(origin: string): MonorepoProductPreset | undefined {
  const key = origin.trim();
  return MONOREPO_PRODUCT_PRESETS.find((p) => p.projectOrigin === key);
}

export function presetForProductPath(productPath: string): MonorepoProductPreset | undefined {
  const normalized = productPath.trim().replace(/\\/g, "/").replace(/\/$/, "");
  return MONOREPO_PRODUCT_PRESETS.find(
    (p) => p.productPath === normalized || normalized.endsWith(`/${p.productPath}`)
  );
}
