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
 * Distribution Build ID: MSGF-48a02b8-20260530T050749Z-internal
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
 * Distribution Build ID: MSGF-48a02b8-20260530T050211Z-internal
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
 * Distribution Build ID: MSGF-48a02b8-20260530T045550Z-internal
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
 * Distribution Build ID: MSGF-48a02b8-20260530T045125Z-internal
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
 * Distribution Build ID: MSGF-48a02b8-20260530T044603Z-internal
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
 * Distribution Build ID: MSGF-3a4c1de-20260529T200349Z-internal
 */
/**
 * Staging smoke — exercise Pulse global CONVERGE + ARBITRATE path once.
 *
 * Uses approvedDelta to set forceGlobal (gate-phase) plus strict brain sensitivity.
 * Requires MSGF_CONTRACT_LICENSE_KEY or MSGF_PULSE_COOKIE + tenant env (see probe:solo).
 *
 * Usage:
 *   npm run smoke:pulse-converge -w msgf
 *   MSGF_APP_URL=https://elphiesgatedai.elphiesyntax.com npm run smoke:pulse-converge -w msgf
 */

import { randomUUID } from "node:crypto";

const BASE = (process.env.MSGF_APP_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const TENANT =
  process.env.MSGF_SOLO_TENANT_KEY?.trim() ||
  process.env.MSGF_TENANT_KEY?.trim() ||
  "integration_sandbox";
const ENTITY = process.env.MSGF_SOLO_ENTITY_ID?.trim() || "";
const LICENSE =
  process.env.MSGF_CONTRACT_LICENSE_KEY?.trim() ||
  process.env.MSGF_AUTHOR_PULSE_LICENSE_KEY?.trim() ||
  "";
const COOKIE = process.env.MSGF_PULSE_COOKIE?.trim() || "";

function highDriftKeystrokes() {
  const paste =
    "STAGING_CONVERGE_SMOKE refactor monolithic route rollback architecture revert to v2 " +
    "express-only pre-refactor pulse legacy express dual rag stack ".repeat(8);
  let ts = Date.now();
  const keys = paste.split("");
  return keys.slice(0, 80).map((key, i) => {
    ts += 12;
    return {
      ts,
      key,
      type: "keydown",
      flightMs: 8,
      dwellMs: 20,
      target: "converge-smoke",
      wordsPasted: i === 0 ? 40 : 0,
    };
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
      json = { raw: text.slice(0, 800) };
    }
    return { ok: res.ok, status: res.status, json };
  } catch (e) {
    return { ok: false, status: 0, json: { error: e instanceof Error ? e.message : String(e) } };
  }
}

function detectGlobalPath(json) {
  if (!json || typeof json !== "object") return { hit: false, hints: [] };
  const s = JSON.stringify(json).toLowerCase();
  const hints = [];
  const markers = [
    "global_converge",
    "pulse_global_converge",
    "requirestiebreaker",
    "requires_tie_breaker",
    "dual_model",
    "converge_routing",
    "gemini",
    "claude",
    "converge_bypass",
    "converge_timeout_degraded",
    "logic_drift",
  ];
  for (const m of markers) {
    if (s.includes(m)) hints.push(m);
  }
  const globalish = hints.some((h) =>
    ["global_converge", "pulse_global_converge", "requirestiebreaker", "requires_tie_breaker", "dual_model"].includes(h)
  );
  const bypass = hints.some((h) =>
    ["converge_bypass", "converge_timeout_degraded"].includes(h)
  );
  return { hit: globalish || bypass, globalish, bypass, hints };
}

async function main() {
  console.log(`[smoke:pulse-converge] ${BASE} tenant=${TENANT}`);

  if (!COOKIE && !LICENSE) {
    console.error(
      "[smoke:pulse-converge] Set MSGF_CONTRACT_LICENSE_KEY (bootstrap:solo) or MSGF_PULSE_COOKIE"
    );
    process.exit(1);
  }

  const entityId = ENTITY || randomUUID();
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "x-msgf-brain-sensitivity": "0.1",
    "x-msgf-tenant-id": TENANT,
    "X-MSGF-Tenant-Key": TENANT,
    "x-msgf-entity-id": entityId,
    "x-msgf-ide-pulse": "1",
  };

  if (COOKIE) {
    headers.Cookie = COOKIE;
  } else {
    headers.Authorization = `Bearer ${LICENSE}`;
    headers["x-msgf-license-key"] = LICENSE;
  }

  const pulse = await probe("POST /api/msgf/pulse (force global)", `${BASE}/api/msgf/pulse`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      keystrokes: highDriftKeystrokes(),
      approvedDelta:
        "STAGING_SMOKE: intentional approvedDelta to verify CONVERGE+ARBITRATE wiring (not production logic).",
    }),
  });

  console.log(`[pulse] HTTP ${pulse.status} ok=${pulse.ok}`);
  console.log(JSON.stringify(pulse.json, null, 2).slice(0, 2000));

  const detection = detectGlobalPath(pulse.json);
  if (detection.hints.length) {
    console.log("\n[markers]", detection.hints.join(", "));
  }

  const routing = await probe(
    "GET pulse-routing",
    `${BASE}/api/msgf/dashboard/pulse-routing?tenant_id=${encodeURIComponent(TENANT)}`,
    { headers: COOKIE ? { Cookie: COOKIE } : { Authorization: `Bearer ${LICENSE}` } }
  );
  if (routing.ok && routing.json?.mix) {
    console.log("\n[pulse-routing 24h]", JSON.stringify(routing.json.mix, null, 2));
  }

  if (!pulse.ok && pulse.status !== 202) {
    console.error("\n[smoke:pulse-converge] FAIL — Pulse HTTP error");
    process.exit(1);
  }

  if (!detection.hit) {
    console.warn(
      "\n[smoke:pulse-converge] WARN — no obvious global/bypass markers in public JSON."
    );
    console.warn(
      "  Check admin forensic vault or Cloud Run logs. Routing may have blocked (402, BYOK, baseline)."
    );
    process.exit(2);
  }

  console.log(
    `\n[smoke:pulse-converge] PASS — global path evidence (${detection.globalish ? "converge" : "bypass/degraded"})`
  );
}

main();
