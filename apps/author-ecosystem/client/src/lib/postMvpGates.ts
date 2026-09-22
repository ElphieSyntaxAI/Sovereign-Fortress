/**
 * Features delayed until after Author three-seat MVP (author / editor / publisher).
 * Default OFF. Set the Vite flag to "1" at client build, or AUTHOR_POST_MVP_* on the BFF.
 */

function flagOn(value: string | undefined): boolean {
  const v = value?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function isAuthorFanHubEnabled(): boolean {
  return flagOn(
    (import.meta.env as Record<string, string | undefined>).VITE_AUTHOR_POST_MVP_FAN_HUB
  );
}

export function isAuthorHelperEnabled(): boolean {
  return flagOn(
    (import.meta.env as Record<string, string | undefined>).VITE_AUTHOR_POST_MVP_HELPER
  );
}
