import type { AuthorHalDnaEvent } from "./msgfPulseBridge.js";

export function extractHalDnaEvents(
  keystrokeDna: Record<string, unknown> | null,
  fallbackLatencies: number[]
): AuthorHalDnaEvent[] {
  const raw = keystrokeDna?.events;
  if (Array.isArray(raw)) {
    const out: AuthorHalDnaEvent[] = [];
    for (const e of raw) {
      if (!e || typeof e !== "object") continue;
      const row = e as Record<string, unknown>;
      if (typeof row.key !== "string") continue;
      out.push({
        key: row.key,
        timestamp: row.timestamp as string | number | undefined,
        flightTime: Number(row.flightTime ?? row.flightMs) || undefined,
        dwellTime: Number(row.dwellTime ?? row.dwellMs) || undefined,
        isBackspace: row.isBackspace === true,
        isSystemEvent: row.isSystemEvent === true,
        wordsPasted:
          typeof row.wordsPasted === "number" ? row.wordsPasted : undefined,
      });
    }
    if (out.length > 0) return out;
  }
  return fallbackLatencies.map((n) => ({ key: "AuthorHAL", flightTime: n }));
}
