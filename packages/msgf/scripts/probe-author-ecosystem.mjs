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
 * Cross-stack smoke probe: Author Ecosystem (Express) + MSGF (Next).
 *
 * Author ecosystem default: http://127.0.0.1:3002 (see apps/author-ecosystem/server/index.js)
 * MSGF default: http://127.0.0.1:3000
 *
 * Usage (from packages/msgf):
 *   node scripts/probe-author-ecosystem.mjs
 *   node --env-file=.env.local scripts/probe-author-ecosystem.mjs   (JWT / Pulse cookie)
 *
 * Optional:
 *   AUTHOR_ECOSYSTEM_JWT — Bearer for Author BFF authenticated probes
 *   AUTHOR_TENANT_ID — Author tenant UUID/slug for BFF -> MSGF proxy (default author_ecosystem)
 *   MSGF_PULSE_COOKIE — Supabase session Cookie header for POST /api/msgf/pulse
 */

const AUTHOR_BASE = (
  process.env.AUTHOR_ECOSYSTEM_URL || "http://127.0.0.1:3002"
).replace(/\/$/, "");
const MSGF_BASE = (process.env.MSGF_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);
const HAL_JWT = process.env.AUTHOR_ECOSYSTEM_JWT?.trim();
const AUTHOR_TENANT_ID = process.env.AUTHOR_TENANT_ID?.trim() || "author_ecosystem";
const PULSE_COOKIE = process.env.MSGF_PULSE_COOKIE?.trim();

/** Minimal HAL-style events (see halRoutes.js) */
function sampleHalKeystrokes() {
  const t0 = Date.now();
  return [
    {
      dwellTime: 95,
      flightTime: 120,
      isBackspace: false,
      isSystemEvent: false,
    },
    {
      dwellTime: 88,
      flightTime: 140,
      isBackspace: false,
      isSystemEvent: false,
    },
    {
      dwellTime: 102,
      flightTime: 200,
      isBackspace: true,
      isSystemEvent: false,
    },
  ];
}

/** Map HAL rhythm rows → MSGF Pulse keystroke shape (approximate; for comparison runs only). */
function halLikeToMsgfKeystrokes(halRows) {
  let ts = Date.now();
  return halRows.map((k, i) => {
    const gap = typeof k.flightTime === "number" ? k.flightTime : 50;
    ts += i === 0 ? 0 : gap;
    const key = k.isBackspace ? "Backspace" : String.fromCharCode(97 + (i % 26));
    return { ts, key, type: "keydown", target: "probe-script" };
  });
}

async function main() {
  console.log("--- Author Ecosystem ---\n");

  const ping = await fetch(`${AUTHOR_BASE}/api/ping`).catch((e) => ({
    ok: false,
    error: e.message,
  }));
  if (ping.ok) {
    console.log("GET /api/ping:", await ping.json());
  } else {
    console.error(
      "GET /api/ping failed (is the server running on",
      AUTHOR_BASE,
      "?):",
      ping.error || ping.status
    );
  }

  const status = await fetch(`${AUTHOR_BASE}/api/status`).catch((e) => ({
    ok: false,
    error: e.message,
  }));
  if (status.ok) {
    const statusJson = await status.json();
    console.log("GET /api/status:", statusJson);
    const map = statusJson?.msgf_mapping;
    if (map) {
      console.log(
        "\nMSGF mapping:",
        map.ready ? "ready" : "incomplete",
        map.ready ? "" : `(missing: ${(map.missing || []).join(", ")})`,
        `tenant=${map.tenant_id}`
      );
    }
  } else {
    console.error(
      "GET /api/status failed:",
      status.error || status.status
    );
  }

  if (HAL_JWT) {
    const keystrokes = halLikeToMsgfKeystrokes(sampleHalKeystrokes());
    const bridgedPulseRes = await fetch(`${AUTHOR_BASE}/api/msgf/pulse`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${HAL_JWT}`,
      },
      body: JSON.stringify({
        tenantId: AUTHOR_TENANT_ID,
        keystrokes,
      }),
    });
    const bridgedPulseJson = await bridgedPulseRes.json().catch(() => ({}));
    console.log(
      "\nPOST /api/msgf/pulse through Author BFF:",
      bridgedPulseRes.status,
      bridgedPulseJson
    );
  } else {
    console.log(
      "\n(skip) POST /api/msgf/pulse through Author BFF — set AUTHOR_ECOSYSTEM_JWT."
    );
  }

  console.log("\n--- MSGF ---\n");

  const msgfRoot = await fetch(MSGF_BASE, { redirect: "manual" }).catch((e) => ({
    ok: false,
    error: e.message,
  }));
  if (msgfRoot.ok || msgfRoot.status === 307 || msgfRoot.status === 308) {
    console.log("GET / (MSGF):", msgfRoot.status, msgfRoot.headers.get("location") || "");
  } else {
    console.error(
      "GET / (MSGF) failed (is Next dev running on",
      MSGF_BASE,
      "?):",
      msgfRoot.error || msgfRoot.status
    );
  }

  if (PULSE_COOKIE) {
    const keystrokes = halLikeToMsgfKeystrokes(sampleHalKeystrokes());
    const pulseRes = await fetch(`${MSGF_BASE}/api/msgf/pulse`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: PULSE_COOKIE,
      },
      body: JSON.stringify({ keystrokes }),
    });
    const pulseJson = await pulseRes.json().catch(() => ({}));
    console.log(
      "\nPOST /api/msgf/pulse (same rhythm mapped to MSGF shape):",
      pulseRes.status,
      pulseJson
    );
  } else {
    console.log(
      "\n(skip) POST /api/msgf/pulse — set MSGF_PULSE_COOKIE (Supabase session) to exercise Pulse."
    );
  }

  console.log(
    "\nNote: Author BFF proxies /api/msgf/pulse → MSGF (tenant author_ecosystem). HAL sessions include msgf_pulse when MSGF_APP_URL + MSGF_AUTHOR_PULSE_LICENSE_KEY are set."
  );
  console.log(
    "Token savings report: npm run track:author-tokens -w msgf  (or track:author-tokens:live with BFF + JWT running)"
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
