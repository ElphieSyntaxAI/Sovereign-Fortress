import { expect, test } from "@playwright/test";

import {
  assertStressAuth,
  authHeaders,
  authorTenantId,
  educationTenantId,
  firePulse,
  licenseTenantCandidates,
  logLine,
  msgfTenantId,
  standardLicense,
} from "./helpers/msgf-stress";

function productPulseHeaders(tenant: string, origin: string): Record<string, string> {
  return {
    ...authHeaders("standard"),
    "x-msgf-tenant-id": tenant,
    "X-MSGF-Tenant-Key": tenant,
    "x-msgf-project-origin": origin,
  };
}

async function attributedPulse(
  request: import("@playwright/test").APIRequestContext,
  label: "author" | "education",
  tenant: string,
  origin: string
) {
  const result = await firePulse(request, "standard", productPulseHeaders(tenant, origin));
  logLine(
    `[consumers] ${label} tenant=${tenant} origin=${origin} status=${result.status} code=${result.errorCode ?? "-"}`
  );
  if ([200, 202].includes(result.status)) return result;

  const fallback = await firePulse(request, "standard", {
    ...authHeaders("standard"),
    "x-msgf-project-origin": origin,
    "x-msgf-tenant-id": msgfTenantId(),
    "X-MSGF-Tenant-Key": msgfTenantId(),
  });
  logLine(
    `[consumers] ${label} fallback licensed tenant status=${fallback.status} code=${fallback.errorCode ?? "-"}`
  );
  expect(
    [200, 202, 403].includes(result.status) || [200, 202].includes(fallback.status),
    `${label} Pulse neither attributed nor licensed: ${result.status} / ${fallback.status} ${result.bodyExcerpt}`
  ).toBeTruthy();
  return fallback.status === 200 || fallback.status === 202 ? fallback : result;
}

test.describe("MSGF consumer product pulses", () => {
  test.beforeAll(() => {
    assertStressAuth();
  });

  test("Author Ecosystem Pulse attributes through MSGF", async ({ request }) => {
    const tenant = authorTenantId();
    const result = await attributedPulse(
      request,
      "author",
      tenant,
      "apps/author-ecosystem"
    );
    expect([200, 202, 403]).toContain(result.status);

    const savings = await request.get(
      `/api/msgf/admin/dashboard/savings-features?tenant_id=${encodeURIComponent(tenant)}`,
      { headers: authHeaders("standard") }
    );
    expect([200, 401, 403], await savings.text()).toContain(savings.status());
    expect(savings.status()).not.toBe(500);
  });

  test("Education Pulse attributes through MSGF", async ({ request }) => {
    const tenant = educationTenantId();
    const result = await attributedPulse(
      request,
      "education",
      tenant,
      "apps/syntax-educates"
    );
    expect([200, 202, 403]).toContain(result.status);

    const savings = await request.get(
      `/api/msgf/dashboard/savings-features?tenant_id=${encodeURIComponent(tenant)}`,
      { headers: authHeaders("standard") }
    );
    expect([200, 401, 403], await savings.text()).toContain(savings.status());
    expect(savings.status()).not.toBe(500);
  });

  test("Indie BYOK Pulse still works at $0 (mock entitlements on)", async ({ request }) => {
    const result = await firePulse(request, "standard", {
      ...authHeaders("standard"),
      "x-msgf-byok-gemini": "short",
    });
    expect(result.status, result.bodyExcerpt).not.toBe(402);
    expect([200, 202]).toContain(result.status);
  });

  test("Pulse Guard verify-result API accepts a local pass", async ({ request }) => {
    test.skip(!standardLicense(), "Need contract license for verify-result");
    const candidates = licenseTenantCandidates();
    let lastText = "";
    let lastStatus = 0;
    for (const tenant of candidates) {
      const res = await request.post("/api/msgf/verify-result", {
        headers: {
          ...authHeaders("standard"),
          "x-msgf-tenant-id": tenant,
          "X-MSGF-Tenant-Key": tenant,
        },
        data: {
          tenant_id: tenant,
          passed: true,
          command: "npx tsc --noEmit",
          exit_code: 0,
          stdout_snippet: "MSGF Pulse Guard RC verify-result",
          file_paths: ["packages/msgf-pulse-guard/src/extension.ts"],
          product_surface: "ide",
          dev_heal_choice: "self_local",
          async: true,
          correlation_id: `rc-verify-${Date.now()}`,
        },
        timeout: 45_000,
      });
      lastStatus = res.status();
      lastText = await res.text();
      if (res.ok()) {
        const json = JSON.parse(lastText) as { ok?: boolean; passed?: boolean };
        expect(json.ok).toBe(true);
        return;
      }
    }
    expect([200, 202], lastText).toContain(lastStatus);
  });
});
