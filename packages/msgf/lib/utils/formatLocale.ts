/**
 * Fixed locale for SSR + client so formatted numbers/dates hydrate consistently.
 * (Browser default locale ≠ Node default locale is a common hydration mismatch.)
 */
export const MSGF_DISPLAY_LOCALE = "en-US" as const;

export function formatDisplayNumber(
  value: number,
  options?: Intl.NumberFormatOptions
): string {
  return value.toLocaleString(MSGF_DISPLAY_LOCALE, options);
}

export function formatDisplayDateTime(value: Date): string {
  if (Number.isNaN(value.getTime())) return "recently";
  return value.toLocaleString(MSGF_DISPLAY_LOCALE);
}
