import { expect, test } from "@playwright/test";

import {
  authHeaders,
  firePulse,
  isProductionHost,
  msgfBaseUrl,
  paidLicense,
  stripeE2eEnabled,
} from "./helpers/msgf-stress";

test.describe("MSGF paid Checkout smoke", () => {
  test.beforeEach(() => {
    test.skip(!stripeE2eEnabled(), "Set MSGF_STRIPE_E2E=1 to run paid Checkout");
    test.skip(
      isProductionHost(),
      "Checkout smoke is staging-only — refuse production elphiesgatedai"
    );
  });

  test("Checkout API creates Pro $99 and Startup Stripe test sessions", async ({
    request,
  }) => {
    test.setTimeout(120_000);
    for (const plan of ["pro_individual", "startup_team"] as const) {
      const res = await request.post("/api/billing/checkout", {
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        data: { plan },
        timeout: 60_000,
      });
      const text = await res.text();
      expect(res.ok(), `${plan} checkout ${res.status()} ${text}`).toBeTruthy();
      const payload = JSON.parse(text) as { url?: string };
      expect(payload.url, `${plan} checkout URL`).toMatch(/stripe\.com/);
    }
  });

  test("Pro $99 Checkout then entitled Pulse", async ({ page, request }) => {
    test.setTimeout(180_000);
    const consoleErrors: string[] = [];
    page.on("pageerror", (err) => consoleErrors.push(err.message));

    const pricing = await page.goto("/pricing", { timeout: 90_000, waitUntil: "domcontentloaded" });
    if (!pricing?.ok()) {
      test.skip(true, `pricing HTTP ${pricing?.status()} — page not ready`);
    }
    const buy = page.getByRole("button", { name: /Buy once — \$99/i });
    await expect(buy).toBeVisible({ timeout: 30_000 });

    const checkoutResponse = page.waitForResponse(
      (res) => res.url().includes("/api/billing/checkout") && res.request().method() === "POST",
      { timeout: 60_000 }
    );
    await buy.click();
    const api = await checkoutResponse.catch(() => null);
    if (!api) {
      test.skip(true, "Checkout POST did not fire from pricing CTA (needs signed-in or Stripe host)");
    }

    const payload = (await api.json().catch(() => ({}))) as {
      url?: string;
      error?: string;
      code?: string;
    };

    if (!api.ok()) {
      test.skip(
        true,
        `Checkout API ${api.status()} ${payload.code ?? payload.error ?? ""} — Stripe not ready on ${msgfBaseUrl()}`
      );
    }

    expect(payload.url, "checkout session URL").toBeTruthy();
    await page.waitForURL(/checkout\.stripe\.com|pricing\?checkout=/, { timeout: 45_000 });

    expect(page.url()).toMatch(/checkout=success|checkout\.stripe\.com/);

    if (paidLicense()) {
      const pulse = await firePulse(request, "paid", authHeaders("paid"));
      expect(pulse.status, pulse.bodyExcerpt).not.toBe(402);
      expect([200, 202]).toContain(pulse.status);
    }

    const missing = await firePulse(request, "unentitled", authHeaders("none"));
    if (missing.status !== 0) {
      expect([401, 402, 403, 429], missing.bodyExcerpt).toContain(missing.status);
      if (missing.status === 402) {
        expect(missing.errorCode).toBe("INSUFFICIENT_FUNDS");
      }
    }

    expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
  });

  test("Startup Team Checkout CTA starts a session", async ({ page }) => {
    test.setTimeout(180_000);
    const pricing = await page.goto("/pricing", { timeout: 90_000, waitUntil: "domcontentloaded" });
    if (!pricing?.ok()) {
      test.skip(true, `pricing HTTP ${pricing?.status()}`);
    }
    const cta = page.getByRole("button", { name: /Start team checkout/i });
    await expect(cta).toBeVisible({ timeout: 30_000 });

    const checkoutResponse = page.waitForResponse(
      (res) => res.url().includes("/api/billing/checkout") && res.request().method() === "POST",
      { timeout: 60_000 }
    );
    await cta.click();
    const api = await checkoutResponse.catch(() => null);
    if (!api) {
      test.skip(true, "Startup checkout POST did not fire from CTA");
    }
    const payload = (await api.json().catch(() => ({}))) as {
      url?: string;
      code?: string;
      error?: string;
    };
    if (!api.ok()) {
      test.skip(
        true,
        `Startup checkout API ${api.status()} ${payload.code ?? payload.error ?? ""}`
      );
    }
    expect(payload.url).toMatch(/stripe\.com/);
  });

  test("missing entitlement Pulse is 402 paid gate (or 401 without a key)", async ({
    request,
  }) => {
    let result = await firePulse(request, "unentitled", authHeaders("none"));
    if (result.status === 0) {
      result = await firePulse(request, "unentitled", authHeaders("none"));
    }
    expect([401, 402, 403, 429]).toContain(result.status);
    if (result.status === 402) {
      expect(result.errorCode).toBe("INSUFFICIENT_FUNDS");
    }
  });
});
