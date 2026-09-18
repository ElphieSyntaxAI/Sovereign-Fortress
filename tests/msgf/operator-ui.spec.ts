import { expect, test } from "@playwright/test";

test.describe("MSGF operator UI auth gate", () => {
  test("/dashboard requires a signed-in session", async ({ page }) => {
    const res = await page.goto("/dashboard");
    expect(res, "dashboard navigation").toBeTruthy();
    await expect(page).toHaveURL(/sign-in/);
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  });

  test("/admin/ops requires a signed-in operator", async ({ page }) => {
    await page.goto("/admin/ops");
    await expect(page).toHaveURL(/sign-in|admin\/sign-in/);
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  });

  test("/admin/dashboard requires a signed-in operator", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await expect(page).toHaveURL(/sign-in|admin\/sign-in/);
  });

  test("/setup/projects requires a signed-in session", async ({ page }) => {
    await page.goto("/setup/projects");
    await expect(page).toHaveURL(/sign-in|setup/);
  });
});
