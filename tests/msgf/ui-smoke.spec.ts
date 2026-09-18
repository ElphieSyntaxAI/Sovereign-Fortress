import { expect, test } from "@playwright/test";

test.describe("MSGF UI smoke", () => {
  test("landing page loads", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    const res = await page.goto("/");
    expect(res?.ok(), `landing HTTP ${res?.status()}`).toBeTruthy();
    await expect(page.getByRole("heading", { name: /Prefrontal cortex/i })).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("pricing page loads", async ({ page }) => {
    const res = await page.goto("/pricing");
    expect(res?.ok(), `pricing HTTP ${res?.status()}`).toBeTruthy();
    await expect(page.getByRole("heading", { name: /Clear pricing/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Buy once — \$99/i })).toBeVisible();
  });

  test("shadow trial page loads without mutating", async ({ page }) => {
    const res = await page.goto("/shadow-trial");
    expect(res?.ok(), `shadow-trial HTTP ${res?.status()}`).toBeTruthy();
    await expect(page.getByRole("heading", { name: /Shadow Proxy trial/i })).toBeVisible();
  });

  test("health endpoint is reachable", async ({ request }) => {
    const res = await request.get("/health");
    expect(res.status(), await res.text()).toBe(200);
    const json = (await res.json()) as { status?: string };
    expect(json.status).toBe("healthy");
  });
});
