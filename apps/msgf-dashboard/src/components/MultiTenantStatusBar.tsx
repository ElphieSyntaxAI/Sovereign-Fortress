import { useCallback, useEffect, useMemo, useState } from "react";

export type TenantEndpoint = {
  id: string;
  label: string;
  /** Full URL for a lightweight health probe (GET, CORS-friendly when configured). */
  url: string;
};

const DEFAULT_TENANTS: TenantEndpoint[] = [
  {
    id: "authoring",
    label: "elphiesyntax.com",
    url: "https://elphiesyntax.com",
  },
  {
    id: "education",
    label: "syntaxeducates.elphiesyntax.com",
    url: "https://syntaxeducates.elphiesyntax.com",
  },
  {
    id: "gated",
    label: "elphiesgatedai.elphiesyntax.com",
    url: "https://elphiesgatedai.elphiesyntax.com",
  },
  {
    id: "vortex",
    label: "Vortex Client",
    url:
      import.meta.env.VITE_VORTEX_CLIENT_HEALTH_URL?.trim() ||
      "http://localhost:3010/api/health",
  },
];

function parseModularFromEnv(): TenantEndpoint[] {
  const raw = import.meta.env.VITE_MODULAR_TENANTS_JSON as string | undefined;
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as { id: string; label: string; url: string }[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t) => t.id && t.label && t.url);
  } catch {
    return [];
  }
}

/** Env modular list overrides same `id` in defaults (e.g. production Vortex URL). */
function mergeTenants(
  base: TenantEndpoint[],
  overrides: TenantEndpoint[]
): TenantEndpoint[] {
  const map = new Map<string, TenantEndpoint>();
  for (const t of base) map.set(t.id, t);
  for (const t of overrides) map.set(t.id, t);
  return [...map.values()];
}

type Health = "checking" | "up" | "degraded" | "down" | "unknown";

async function probe(url: string): Promise<Health> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: "GET",
      mode: "cors",
      cache: "no-store",
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (res.ok || res.status === 304) return "up";
    if (res.status < 500) return "degraded";
    return "down";
  } catch {
    clearTimeout(t);
    return "unknown";
  }
}

const dot: Record<Health, string> = {
  checking: "bg-zinc-500 animate-pulse",
  up: "bg-emerald-500",
  degraded: "bg-amber-500",
  down: "bg-red-500",
  unknown: "bg-zinc-600",
};

export function MultiTenantStatusBar() {
  const tenants = useMemo(
    () => mergeTenants(DEFAULT_TENANTS, parseModularFromEnv()),
    []
  );
  const [health, setHealth] = useState<Record<string, Health>>(() =>
    Object.fromEntries(tenants.map((t) => [t.id, "checking" as Health]))
  );

  const run = useCallback(async () => {
    setHealth((h) => ({
      ...h,
      ...Object.fromEntries(tenants.map((t) => [t.id, "checking" as Health])),
    }));
    const next: Record<string, Health> = {};
    await Promise.all(
      tenants.map(async (t) => {
        next[t.id] = await probe(t.url);
      })
    );
    setHealth(next);
  }, [tenants]);

  useEffect(() => {
    void run();
    const id = setInterval(() => void run(), 60_000);
    return () => clearInterval(id);
  }, [run]);

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            Multi-tenant status
          </div>
          <p className="text-xs text-zinc-400">
            Live probe (CORS). Vortex Client uses{" "}
            <code className="text-zinc-300">VITE_VORTEX_CLIENT_HEALTH_URL</code> or
            localhost. Optional{" "}
            <code className="text-zinc-300">VITE_MODULAR_TENANTS_JSON</code> overrides
            same <code className="text-zinc-300">id</code> (e.g.{" "}
            <code className="text-zinc-300">vortex</code>) or adds Decks and other
            modular hosts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {tenants.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => void run()}
              className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-1.5 text-left text-xs text-zinc-200 transition hover:border-zinc-600"
              title={t.url}
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${dot[health[t.id] ?? "unknown"]}`}
              />
              <span className="max-w-[10rem] truncate font-medium">{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
