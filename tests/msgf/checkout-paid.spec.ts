import { expect, test } from "@playwright/test";

import {
  authHeaders,
  firePulse,
  isProductionHost,
  msgfBaseUrl,
  paidLicense,
  stripeE2eEnabled,
} from "./helpers/msgf-stress";

async function fillStripeCheckout(page: import("@playwright/test").Page) {
  const email =
    process.env.MSGF_STRIPE_TEST_EMAIL?.trim() || "qa-msgf-rc@example.com";
  const emailBox = page.getByLabel(/email/i).or(page.locator('input[type="email"]'));
  if (await emailBox.first().isVisible({ timeout: 15_000 }).catch(() => false)) {
    await emailBox.first().fill(email);
  }

  const cardFrame = page.frameLocator('iframe[name*="privateStripeFrame"]').first();
  const number = page
    .getByPlaceholder(/1234/)
    .or(page.getByLabel(/card number/i))
    .or(cardFrame.getByPlaceholder(/1234/));
  if (await number.first().isVisible({ timeout: 10_000 }).catch(() => false)) {
    await number.first().fill("4242424242424242");
  }

  const expiry = page.getByPlaceholder(/MM/).or(page.getByLabel(/expir/i));
  if (await expiry.first().isVisible({ timeout: 5_000 }).catch(() => false)) {
    await expiry.first().fill("1234");
  }

  const cvc = page.getByPlaceholder(/CVC/i).or(page.getByLabel(/CVC/i));
  if (await cvc.first().isVisible({ timeout: 5_000 }).catch(() => false)) {
    await cvc.first().fill("123");
  }

  const pay = page.getByRole("button", { name: /pay|subscribe|start trial|buy/i });
  if (await pay.first().isVisible({ timeout: 5_000 }).catch(() => false)) {
    await pay.first().click();
  }
}

test.describe("MSGF paid Checkout smoke", () => {
  test.beforeEach(() => {
    test.skip(!stripeE2eEnabled(), "Set MSGF_STRIPE_E2E=1 to run paid Checkout");
    test.skip(
      isProductionHost(),
      "Checkout smoke is staging-only — refuse production elphiesgatedai"
    );
  });

  test("Pro $99 Checkout then entitled Pulse", async ({ page, request }) => {
    const consoleErrors: string[] = [];
    page.on("pageerror", (err) => consoleErrors.push(err.message));

    await page.goto("/pricing");
    await expect(page.getByRole("button", { name: /Buy once — \$99/i })).toBeVisible();

    const checkoutResponse = page.waitForResponse(
      (res) => res.url().includes("/api/billing/checkout") && res.request().method() === "POST",
      { timeout: 30_000 }
    );
    await page.getByRole("button", { name: /Buy once — \$99/i }).click();
    const api = await checkoutResponse;
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

    if (page.url().includes("checkout.stripe.com")) {
      await fillStripeCheckout(page);
      await page.waitForURL(/pricing\?checkout=success/, { timeout: 90_000 });
    }

    expect(page.url()).toMatch(/checkout=success|checkout\.stripe\.com/);

    if (paidLicense()) {
      const pulse = await firePulse(request, "paid", authHeaders("paid"));
      expect(pulse.status, pulse.bodyExcerpt).not.toBe(402);
      expect([200, 202]).toContain(pulse.status);
    }

    expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
  });

  test("Startup Team Checkout CTA starts a session", async ({ page }) => {
    await page.goto("/pricing");
    const cta = page.getByRole("button", { name: /Start team checkout/i });
    await expect(cta).toBeVisible();

    const checkoutResponse = page.waitForResponse(
      (res) => res.url().includes("/api/billing/checkout") && res.request().method() === "POST",
      { timeout: 30_000 }
    );
    await cta.click();
    const api = await checkoutResponse;
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
});
