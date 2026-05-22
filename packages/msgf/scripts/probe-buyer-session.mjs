#!/usr/bin/env node
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
 * Distribution Build ID: MSGF-0265450-20260522T171829Z-internal
 */
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
 * Distribution Build ID: MSGF-0265450-20260522T171536Z-internal
 */
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
 * Distribution Build ID: MSGF-0265450-20260522T171258Z-internal
 */
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
 * Distribution Build ID: MSGF-0265450-20260522T170823Z-internal
 */
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
 * Distribution Build ID: MSGF-0265450-20260522T170607Z-internal
 */
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
 * Distribution Build ID: MSGF-e98bd4c-20260522T053721Z-internal
 */
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
 * Distribution Build ID: MSGF-44d0906-20260522T043912Z-internal
 */
/**
 * MSGF buyer probe — session cookie only (no msgf_live_ license).
 *
 * Prerequisites:
 *   - Dev server running
 *   - Buyer signed in; MSGF_PULSE_COOKIE set in packages/msgf/.env.local
 *   - MSGF_CONTRACT_LICENSE_KEY unset (integrator key must not shadow buyer)
 */
import { randomUUID } from "node:crypto";

const BASE = (process.env.MSGF_APP_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
const COOKIE = process.env.MSGF_PULSE_COOKIE?.trim() || "";

if (process.env.MSGF_CONTRACT_LICENSE_KEY?.trim()?.startsWith("msgf_live_")) {
  console.warn(
    "[probe:buyer] WARN: MSGF_CONTRACT_LICENSE_KEY is set — comment it out to test real buyer Pulse."
  );
}

function sampleKeystrokes() {
  let ts = Date.now();
  const keys = ["h", "e", "l", "l", "o", " ", "b", "u", "y", "e", "r"];
  return keys.map((key, i) => {
    ts += 40 + i * 3;
    return { ts, key, type: "keydown", flightMs: 45 + i * 4, dwellMs: 72 + i * 3, target: "buyer-probe" };
  });
}

async function probe(label, url, init = {}) {
  try {
    const res = await fetch(url, init);
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = text.slice(0, 400);
    }
    return { ok: res.ok, status: res.status, json };
  } catch (e) {
    return { ok: false, status: 0, json: { error: e instanceof Error ? e.message : String(e) } };
  }
}

function logResult(label, r) {
  const mark = r.ok ? "OK" : "FAIL";
  console.log(`[${mark}] ${label} — HTTP ${r.status}`);
  console.log(JSON.stringify(r.json, null, 2).slice(0, 1200));
}

async function main() {
  if (!COOKIE) {
    console.error(
      "[probe:buyer] Set MSGF_PULSE_COOKIE after signing in (Application → Cookies → sb-*-auth-token)."
    );
    process.exit(1);
  }

  console.log(`[probe:buyer] ${BASE} — session cookie probe`);
  const failures = [];

  const health = await probe("GET /health", `${BASE}/health`);
  logResult("GET /health", health);
  if (!health.ok) failures.push("health");

  const pulse = await probe("POST /api/msgf/pulse", `${BASE}/api/msgf/pulse`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: COOKIE },
    body: JSON.stringify({ keystrokes: sampleKeystrokes() }),
  });
  logResult("POST /api/msgf/pulse (session)", pulse);
  if (!pulse.ok && pulse.status !== 202) failures.push("pulse");

  const tenant =
    (typeof pulse.json?.beat?.tenant_id === "string" && pulse.json.beat.tenant_id) ||
    process.env.MSGF_GATED_TENANT_ID?.trim() ||
    "tenant_gated";

  const heal = await probe(
    "GET /api/msgf/heal-queue",
    `${BASE}/api/msgf/heal-queue?tenant_id=${encodeURIComponent(tenant)}`,
    { headers: { Cookie: COOKIE } }
  );
  logResult("GET /api/msgf/heal-queue", heal);
  if (!heal.ok) failures.push("heal-queue");

  if (failures.length) {
    console.error("\n[probe:buyer] FAILED:", failures.join(", "));
    console.error("Open /dashboard once if Pulse says ERR_PROFILE_MISSING.");
    process.exit(1);
  }
  console.log("\n[probe:buyer] Buyer session probes passed.");
}

main();
