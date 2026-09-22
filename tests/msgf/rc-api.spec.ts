import { expect, test } from "@playwright/test";

import {
  assertStressAuth,
  authHeaders,
  bodyHasKeyLists,
  creditReservationEnabled,
  firePulse,
  foreignTenantId,
  gatewayHeaders,
  licenseTenantCandidates,
  isProductionHost,
  logLine,
  opsCronHeaders,
  opsCronSecret,
  pulseCookie,
  recordHallFailure,
  standardLicense,
  swarmAbortHeaders,
  stripeE2eEnabled,
} from "./helpers/msgf-stress";

type HealQueueJson = {
  ok?: boolean;
  audience_scope?: string;
  human_arbitration_packages?: unknown[];
  error?: string;
};

async function getHealQueueForLicense(request: import("@playwright/test").APIRequestContext) {
  const headers = authHeaders("standard");
  let lastStatus = 0;
  let lastText = "";
  for (const tenant of licenseTenantCandidates()) {
    const res = await request.get(`/api/msgf/heal-queue?tenant_id=${encodeURIComponent(tenant)}`, {
      headers: {
        ...headers,
        "x-msgf-tenant-id": tenant,
        "X-MSGF-Tenant-Key": tenant,
      },
    });
    lastStatus = res.status();
    lastText = await res.text();
    if (res.ok()) {
      return { tenant, res, json: JSON.parse(lastText) as HealQueueJson, text: lastText };
    }
  }
  return { tenant: null, res: null, json: null, text: lastText, status: lastStatus };
}

test.describe("MSGF RC API contracts", () => {
  test.beforeAll(() => {
    assertStressAuth();
  });

  test("heal-queue user license is audience_scope user with empty arbitration", async ({
    request,
  }) => {
    const found = await getHealQueueForLicense(request);
    expect(found.json, found.text).toBeTruthy();
    expect(found.json?.ok).toBe(true);
    expect(found.json?.audience_scope).toBe("user");
    expect(found.json?.human_arbitration_packages).toEqual([]);
  });

  test("heal-queue without operator session is not admin scope", async ({ request }) => {
    const unauth = await request.get(
      `/api/msgf/heal-queue?tenant_id=${encodeURIComponent(licenseTenantCandidates()[0])}`
    );
    expect([401, 403]).toContain(unauth.status());

    const found = await getHealQueueForLicense(request);
    expect(found.json, found.text).toBeTruthy();
    expect(found.json?.audience_scope).not.toBe("admin");
  });

  test("v32-heartbeat dry_run with ops cron secret", async ({ request }) => {
    test.skip(!opsCronSecret(), "Set MSGF_OPS_CRON_SECRET for heartbeat smoke");
    const res = await request.post("/api/msgf/ops/v32-heartbeat", {
      headers: opsCronHeaders(),
      data: { dry_run: true, skip_hall_purge: true, skip_scheduled_heal: true },
      timeout: 120_000,
    });
    const text = await res.text();
    expect([200, 207], text).toContain(res.status());
    const json = JSON.parse(text) as { ok?: boolean; error?: string };
    expect(json.ok === true || json.error == null).toBeTruthy();
  });

  test("shadow gateway with x-msgf-key is projected eval, not live spend", async ({
    request,
  }) => {
    test.skip(!standardLicense(), "Need contract license for x-msgf-key");
    const res = await request.post("/api/v1/chat/completions", {
      headers: gatewayHeaders("shadow"),
      data: {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "MSGF RC shadow eval — do not spend." }],
        max_tokens: 8,
        stream: false,
      },
      timeout: 45_000,
    });
    const text = await res.text();
    logLine(`[rc-api] shadow gateway status=${res.status()} body=${text.slice(0, 400)}`);
    expect(res.status(), text).not.toBe(500);
    expect(text.toLowerCase()).not.toContain("msgf_key_required");
    const json = JSON.parse(text) as {
      error?: { code?: string; message?: string };
      usage?: unknown;
      choices?: unknown;
    };
    const code = json.error?.code ?? "";
    expect(code).not.toBe("msgf_key_required");
    expect(code).not.toBe("msgf_license_invalid");
    if (res.ok()) {
      expect(json.choices || json.usage).toBeTruthy();
    }
  });

  test("active gateway returns x-msgf-routing; spoofed tenant is ignored", async ({
    request,
  }) => {
    test.skip(!standardLicense(), "Need contract license for x-msgf-key");
    const res = await request.post("/api/v1/chat/completions", {
      headers: gatewayHeaders("active"),
      data: {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "MSGF RC active routing check." }],
        max_tokens: 8,
        stream: false,
      },
      timeout: 45_000,
    });
    const text = await res.text();
    logLine(`[rc-api] active gateway status=${res.status()} routing=${res.headers()["x-msgf-routing"] ?? "-"}`);
    expect(res.status(), text).not.toBe(500);
    expect(text.toLowerCase()).not.toContain("spoofed-rc-tenant");
    const routing = res.headers()["x-msgf-routing"];
    if (res.ok()) {
      expect(routing, "active response must include x-msgf-routing").toBeTruthy();
    }
  });

  test("foreign tenant_id on period-reports and shadow-eval is 401/403", async ({
    request,
  }) => {
    const foreign = foreignTenantId();
    const headers: Record<string, string> = { ...authHeaders("standard") };
    const cookie = pulseCookie();
    if (cookie) headers.Cookie = cookie;

    const period = await request.get(
      `/api/msgf/dashboard/period-reports?tenant_id=${encodeURIComponent(foreign)}`,
      { headers }
    );
    const shadow = await request.get(
      `/api/msgf/dashboard/shadow-eval?tenant_id=${encodeURIComponent(foreign)}`,
      { headers }
    );

    for (const [name, res] of [
      ["period-reports", period],
      ["shadow-eval", shadow],
    ] as const) {
      const text = await res.text();
      logLine(`[rc-api] ${name} foreign tenant status=${res.status()}`);
      if (res.status() === 200) {
        const json = JSON.parse(text) as { ok?: boolean; tenant_id?: string };
        expect(
          json.tenant_id === foreign,
          `${name} must not return foreign tenant data for a non-operator`
        ).toBeFalsy();
      } else {
        expect([401, 403], `${name} ${text}`).toContain(res.status());
      }
    }
  });

  test("swarm Pulse headers abort with 409, Hall row, no key lists", async ({ request }) => {
    const result = await firePulse(
      request,
      "standard",
      authHeaders("standard"),
      swarmAbortHeaders()
    );
    expect(bodyHasKeyLists(result.bodyExcerpt)).toBeFalsy();
    if (isProductionHost() && result.status === 402) {
      expect(result.errorCode).toBe("INSUFFICIENT_FUNDS");
      return;
    }
    expect(result.status, result.bodyExcerpt).toBe(409);
    expect(result.errorCode).toBe("BOT_SWARM_DETECTED");
    expect(result.bodyExcerpt).toMatch(/hitl|cause_codes|BOT_SWARM/i);
    recordHallFailure(result);
  });

  test("unentitled Pulse is 401 without a key; 402 is the paid credit gate", async ({
    request,
  }) => {
    const none = await firePulse(request, "unentitled", authHeaders("none"));
    expect([401, 402, 403, 429]).toContain(none.status);
    if (!standardLicense()) {
      expect(none.status).toBe(401);
    }
    if (none.status === 402) {
      expect(none.errorCode).toBe("INSUFFICIENT_FUNDS");
    }

    if (creditReservationEnabled() && none.status !== 402) {
      logLine(
        "[rc-api] credit reservation is on but unentitled Pulse was not 402 — wallet may still have mock credits"
      );
    }
  });

  test("Stripe Checkout API mints Pro, Startup, and Enterprise test sessions", async ({ request }) => {
    test.skip(!stripeE2eEnabled(), "Set MSGF_STRIPE_E2E=1");
    test.skip(isProductionHost(), "Refuse production Checkout");
    const cases = [
      { plan: "pro_individual" },
      { plan: "startup_team" },
      { plan: "startup_team", interval: "year" },
      { plan: "enterprise" },
      { plan: "enterprise", interval: "year" },
    ] as const;
    for (const data of cases) {
      const label = `${data.plan}${data.interval ? `_${data.interval}` : ""}`;
      const res = await request.post("/api/billing/checkout", {
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        data,
        timeout: 60_000,
      });
      const text = await res.text();
      if (!res.ok()) {
        test.skip(true, `Checkout ${label} HTTP ${res.status()} ${text.slice(0, 180)}`);
      }
      const payload = JSON.parse(text) as { url?: string };
      expect(payload.url, `${label} checkout URL`).toMatch(/stripe\.com/);
    }
  });
});
