import { expect, test as setup } from "@playwright/test";
import { config } from "../config";

setup("authenticate", async ({ page }) => {
  const { email, password } = config.auth;

  if (!email || !password) {
    throw new Error(
      "Auth credentials must be set via profile YAML (auth.email / auth.password) or env vars (E2E_USER_EMAIL / E2E_USER_PASSWORD)",
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
