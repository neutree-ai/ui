import { expect, test as setup } from "@playwright/test";

setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "E2E_USER_EMAIL and E2E_USER_PASSWORD env vars must be set",
    );
  }

  await page.goto("/#/login");

  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();

  // Wait for redirect to dashboard after successful login
  await page.waitForURL("**/#/dashboard");
  await expect(page).toHaveURL(/\/#\/dashboard/);

  // Save signed-in state
  await page.context().storageState({ path: "e2e/auth/storage-state.json" });
});
