/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-48a02b8-20260530T050749Z-internal
 */
export type DevStackProbe = {
  id: "author_bff" | "author_client" | "education_client";
  label: string;
  url: string;
  status: "up" | "down";
  hint: string;
};

async function probeUrl(url: string, timeoutMs = 1200): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      cache: "no-store",
    });
    clearTimeout(timer);
    return res.status > 0 && res.status < 500;
  } catch {
    return false;
  }
}

/**
 * Best-effort probes for local monorepo dev servers (admin portal hints).
 */
export async function probeLocalDevStack(): Promise<DevStackProbe[]> {
  const authorBff = process.env.AUTHOR_ECOSYSTEM_URL?.trim() || "http://127.0.0.1:3002";
  const authorClient = process.env.AUTHOR_CLIENT_DEV_URL?.trim() || "http://127.0.0.1:5173";
  const educationClient =
    process.env.EDUCATION_LOCAL_DEV_URL?.trim() || "http://127.0.0.1:5175";

  const probes: Omit<DevStackProbe, "status">[] = [
    {
      id: "author_bff",
      label: "Author BFF",
      url: authorBff,
      hint: "Terminal: npm run dev:author-bff (Supabase keys in packages/msgf/.env.local or repo root .env.local)",
    },
    {
      id: "author_client",
      label: "Author client (Vite)",
      url: authorClient,
      hint: "Terminal: npm run dev:author-client (proxies /api → BFF on 3002)",
    },
    {
      id: "education_client",
      label: "Syntax Educates (Vite)",
      url: educationClient,
      hint: "Terminal: npm run dev:education (port 5175)",
    },
  ];

  const results = await Promise.all(
    probes.map(async (p) => ({
      ...p,
      status: (await probeUrl(p.url)) ? ("up" as const) : ("down" as const),
    }))
  );

  return results;
}
