import { expect, test } from "@playwright/test";

// Auth tests start with completely empty storage
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("authentication", () => {
  test("should redirect unauthenticated user to login", async ({ page }) => {
    await page.goto("/#/dashboard");
    await page.waitForURL(/\/#\/login/);
    await expect(page).toHaveURL(/\/#\/login/);
  });

  test("should login with valid credentials", async ({ page }) => {
    const email = process.env.E2E_USER_EMAIL;
    const password = process.env.E2E_USER_PASSWORD;

    if (!email || !password) {
      test.skip(!email || !password, "E2E credentials not set");
      return;
    }

    await page.goto("/#/login");

    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();

    await page.waitForURL(/\/#\/dashboard/);
    await expect(page).toHaveURL(/\/#\/dashboard/);
  });

  test("should show error for invalid credentials", async ({ page }) => {
    await page.goto("/#/login");

    await page.locator('input[name="email"]').fill("invalid@example.com");
    await page.locator('input[name="password"]').fill("wrongpassword");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Expect an error notification/message to appear
    await expect(
      page.getByText(/invalid|error|incorrect|unauthorized/i).first(),
    ).toBeVisible({});
  });
});
