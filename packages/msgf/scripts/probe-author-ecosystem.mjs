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
 * Distribution Build ID: MSGF-753c05a-20260519T050509Z-internal
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
 *   AUTHOR_ECOSYSTEM_JWT — Bearer for POST /api/hal/session (same shape as extension would send)
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
    console.log("GET /api/status:", await status.json());
  } else {
    console.error(
      "GET /api/status failed:",
      status.error || status.status
    );
  }

  if (HAL_JWT) {
    const halBody = {
      content: "probe-author-ecosystem synthetic session",
      keystroke_data: sampleHalKeystrokes(),
      is_reference: false,
    };
    const halRes = await fetch(`${AUTHOR_BASE}/api/hal/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${HAL_JWT}`,
      },
      body: JSON.stringify(halBody),
    });
    const halJson = await halRes.json().catch(() => ({}));
    console.log("\nPOST /api/hal/session:", halRes.status, halJson);
  } else {
    console.log(
      "\n(skip) POST /api/hal/session — set AUTHOR_ECOSYSTEM_JWT to exercise HAL ledger."
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
    "\nNote: Author ecosystem uses its own Postgres HAL ledger; MSGF uses Supabase + pledge/baseline gates. They are not wired together yet—this script only proves both stacks respond."
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
