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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
/**
 * Integration check: LOM recursion guard + p4_state_ledger (forced disagreement).
 *
 * Prerequisites:
 * - Next dev/server running with MSGF_ENABLE_LOM_TEST=1 (or "true")
 * - SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL for DB assertions
 * - MSGF_PULSE_COOKIE: browser Cookie header for a signed-in user who has completed
 *   pledge (state_beats) and biometric baseline so Pulse reaches the LOM gate
 *
 * Run from packages/msgf:
 *   npm run test:lom-disagreement
 * (loads .env.local / .env via npm script; do not rely on broken dotenv/config.)
 */

import { createClient } from "@supabase/supabase-js";

const BASE =
  process.env.MSGF_BASE_URL?.replace(/\/$/, "") || "http://127.0.0.1:3000";
const COOKIE = process.env.MSGF_PULSE_COOKIE?.trim();
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const P6_LINEAGE = "MSGF_V3_STRICT.constraint_ledger.1.1.1";

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

function decodeJwtSub(token: string): string | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8")
    ) as { sub?: string };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

/** Resolve author_id from Supabase SSR-style cookie JSON or bare JWT. */
function authorIdFromCookie(cookieHeader: string): string | null {
  const segments = cookieHeader.split(";").map((s) => s.trim());
  for (const seg of segments) {
    const eq = seg.indexOf("=");
    if (eq === -1) continue;
    const name = seg.slice(0, eq).toLowerCase();
    if (!name.includes("auth-token")) continue;
    const raw = seg.slice(eq + 1);
    let decoded: string;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      decoded = raw;
    }
    try {
      const j = JSON.parse(decoded) as {
        user?: { id?: string };
        access_token?: string;
      };
      if (j.user?.id) return j.user.id;
      if (j.access_token) return decodeJwtSub(j.access_token);
    } catch {
      if (decoded.startsWith("eyJ")) return decodeJwtSub(decoded);
    }
  }
  return null;
}

async function main() {
  if (!COOKIE) {
    fail("Missing MSGF_PULSE_COOKIE (full Cookie header from an authenticated browser session).");
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    fail("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  const authorId = authorIdFromCookie(COOKIE);
  if (!authorId) {
    fail("Could not parse author id from MSGF_PULSE_COOKIE (expected Supabase auth-token JSON).");
  }

  const keystrokes = [
    { ts: Date.now(), key: "t", type: "keydown" as const },
    { ts: Date.now() + 10, key: "e", type: "keydown" as const },
    { ts: Date.now() + 20, key: "s", type: "keydown" as const },
    { ts: Date.now() + 30, key: "t", type: "keydown" as const },
  ];

  const res = await fetch(`${BASE}/api/msgf/pulse`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: COOKIE,
      "x-msgf-test-force-mismatch": "true",
    },
    body: JSON.stringify({ keystrokes }),
  });

  const body = (await res.json()) as Record<string, unknown>;

  if (body.err !== "ERR_RECURSION_LIMIT") {
    fail(
      `Expected err ERR_RECURSION_LIMIT, got ${JSON.stringify(body)} (status ${res.status})`
    );
  }
  if (body.lom_attempts !== 3) {
    fail(`Expected lom_attempts 3, got ${String(body.lom_attempts)}`);
  }
  if (res.status !== 403) {
    fail(`Expected HTTP 403, got ${res.status}`);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: rows, error } = await admin
    .from("p4_state_ledger")
    .select("id, consensus_status, state_blob, created_at")
    .eq("author_id", authorId)
    .eq("consensus_status", "rejected")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    fail(`p4_state_ledger query failed: ${error.message}`);
  }

  const match = (rows ?? []).find((r) => {
    const blob = r.state_blob as Record<string, unknown> | null;
    return (
      blob?.lineage_label === P6_LINEAGE &&
      blob?.test_force_mismatch === true &&
      blob?.lom_attempts === 3
    );
  });

  if (!match) {
    fail(
      `No matching p4_state_ledger row (rejected, lineage ${P6_LINEAGE}, lom_attempts 3). Rows: ${JSON.stringify(rows)}`
    );
  }

  console.log("OK: LOM halted after 3 attempts with ERR_RECURSION_LIMIT.");
  console.log("OK: p4_state_ledger rejected row:", match.id);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
