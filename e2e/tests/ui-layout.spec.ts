import { expect, test } from "../fixtures/base";
import { MULTI_USER_TIMEOUT } from "../helpers/constants";
import { loginAs, logout } from "../helpers/test-user-context";

// ════════════════════════════════════════════════════════════
// UI Layout & Overview Tests
// ════════════════════════════════════════════════════════════

test.describe("ui layout", () => {
  // ────────────────────────────────────────────────────────
  // Auth Pages (incognito context)
  // ────────────────────────────────────────────────────────
  test.describe("auth pages", () => {
    test(
      "login page UI elements and login flow",
      { tag: "@C2611909" },
      async ({ page, browser }, testInfo) => {
        testInfo.setTimeout(MULTI_USER_TIMEOUT);

        // Navigate admin page first to establish app origin
        await page.goto("/#/dashboard");
        const baseURL = new URL(page.url()).origin;
        const context = await browser.newContext({
          baseURL,
          storageState: { cookies: [], origins: [] },
        });
        const incognitoPage = await context.newPage();

        try {
          await incognitoPage.goto("/#/login");
          await incognitoPage
            .locator('input[name="email"]')
            .waitFor({ state: "visible" });

          // Verify UI elements
          await expect(
            incognitoPage.getByText("Sign in to your account"),
          ).toBeVisible();
          await expect(
            incognitoPage.locator('input[name="email"]'),
          ).toBeVisible();
          await expect(
            incognitoPage.locator('input[name="password"]'),
          ).toBeVisible();
          await expect(
            incognitoPage.getByRole("button", { name: /sign in/i }),
          ).toBeVisible();
          await expect(
            incognitoPage.getByText("Forgot password?"),
          ).toBeVisible();
          await expect(incognitoPage.getByText("Sign up")).toBeVisible();
          await expect(incognitoPage.getByAltText("logo")).toBeVisible();

          // Login flow
          await incognitoPage
            .locator('input[name="email"]')
            .fill(process.env.E2E_USER_EMAIL ?? "");
          await incognitoPage
            .locator('input[name="password"]')
            .fill(process.env.E2E_USER_PASSWORD ?? "");
          await incognitoPage.getByRole("button", { name: /sign in/i }).click();
          await incognitoPage.waitForURL("**/#/dashboard");
        } finally {
          await context.close();
        }
      },
    );

    test(
      "forgot password page UI elements and submit",
      { tag: "@C2611911" },
      async ({ page, browser }, testInfo) => {
        testInfo.setTimeout(MULTI_USER_TIMEOUT);

        // Navigate admin page first to establish app origin
        await page.goto("/#/dashboard");
        const baseURL = new URL(page.url()).origin;
        const context = await browser.newContext({
          baseURL,
          storageState: { cookies: [], origins: [] },
        });
        const incognitoPage = await context.newPage();

        try {
          await incognitoPage.goto("/#/forgot-password");
          await incognitoPage
            .locator('input[name="email"]')
            .waitFor({ state: "visible" });

          // Verify UI elements
          await expect(
            incognitoPage.getByText("Forgot your password?"),
          ).toBeVisible();
          await expect(
            incognitoPage.locator('input[name="email"]'),
          ).toBeVisible();
          await expect(
            incognitoPage.getByRole("button", {
              name: /send reset instructions/i,
            }),
          ).toBeVisible();
          await expect(incognitoPage.getByText("Back to login")).toBeVisible();
          await expect(incognitoPage.getByAltText("logo")).toBeVisible();

          // Submit form with test email
          await incognitoPage
            .locator('input[name="email"]')
            .fill("test-forgot@e2e.local");
          await incognitoPage
            .getByRole("button", { name: /send reset instructions/i })
            .click();

          // Verify no hard error — button should re-enable after submission
          await expect(
            incognitoPage.getByRole("button", {
              name: /send reset instructions/i,
            }),
          ).toBeEnabled({ timeout: 10000 });
        } finally {
          await context.close();
        }
      },
    );
  });

  // ────────────────────────────────────────────────────────
  // Sidebar
  // ────────────────────────────────────────────────────────
  test.describe("sidebar", () => {
    test(
      "sidebar logo is visible in expanded state",
      { tag: "@C2611912" },
      async ({ page }) => {
        await page.goto("/#/dashboard");
        await page.waitForURL("**/#/dashboard");

        const sidebar = page.locator('[data-sidebar="sidebar"]');
        await expect(sidebar.getByAltText("logo")).toBeVisible();
      },
    );

    test(
      "sidebar toggle collapses and expands",
      { tag: "@C2611913" },
      async ({ page }) => {
        await page.goto("/#/dashboard");
        await page.waitForURL("**/#/dashboard");

        const sidebarWrapper = page.locator(".peer[data-state]");
        const initialState = await sidebarWrapper.getAttribute("data-state");

        // Click toggle
        await page.getByRole("button", { name: /toggle sidebar/i }).click();

        // Verify state flipped
        const toggledState =
          initialState === "expanded" ? "collapsed" : "expanded";
        await expect(sidebarWrapper).toHaveAttribute(
          "data-state",
          toggledState,
        );

        // Click again to restore
        await page.getByRole("button", { name: /toggle sidebar/i }).click();
        await expect(sidebarWrapper).toHaveAttribute(
          "data-state",
          initialState ?? "expanded",
        );
      },
    );
  });

  // ────────────────────────────────────────────────────────
  // Theme
  // ────────────────────────────────────────────────────────
  test.describe("theme", () => {
    test(
      "theme toggle switches between dark, light, and system",
      { tag: "@C2611914" },
      async ({ page }) => {
        await page.goto("/#/dashboard");
        await page.waitForURL("**/#/dashboard");

        const html = page.locator("html");

        // Switch to dark mode
        await page.getByRole("button", { name: /toggle theme/i }).click();
        await page.getByRole("menuitem", { name: /dark mode/i }).click();
        await expect(html).toHaveClass(/dark/);

        // Switch to light mode
        await page.getByRole("button", { name: /toggle theme/i }).click();
        await page.getByRole("menuitem", { name: /light mode/i }).click();
        await expect(html).not.toHaveClass(/dark/);

        // Cleanup: switch to system
        await page.getByRole("button", { name: /toggle theme/i }).click();
        await page.getByRole("menuitem", { name: /follow system/i }).click();
      },
    );
  });

  // ────────────────────────────────────────────────────────
  // User Menu
  // ────────────────────────────────────────────────────────
  test.describe("user menu", () => {
    test(
      "user dropdown shows username and email",
      { tag: "@C2611915" },
      async ({ page }) => {
        await page.goto("/#/dashboard");
        await page.waitForURL("**/#/dashboard");

        // Open user dropdown (button text = username "admin")
        await page.locator("button:has(.lucide-chevron-down)").click();

        // Verify admin username and email (contains "@")
        const dropdownContent = page.locator(
          '[role="menu"], [data-radix-menu-content]',
        );
        await expect(dropdownContent.getByText("admin").first()).toBeVisible();
        await expect(dropdownContent.getByText(/@/)).toBeVisible();
      },
    );

    test(
      "user dropdown shows version info",
      { tag: "@C2611916" },
      async ({ page }) => {
        await page.goto("/#/dashboard");
        await page.waitForURL("**/#/dashboard");

        await page.locator("button:has(.lucide-chevron-down)").click();

        const dropdownContent = page.locator(
          '[role="menu"], [data-radix-menu-content]',
        );
        await expect(dropdownContent.getByText("Version")).toBeVisible();
      },
    );

    test(
      "language submenu shows English option",
      { tag: "@C2611917" },
      async ({ page }) => {
        await page.goto("/#/dashboard");
        await page.waitForURL("**/#/dashboard");

        await page.locator("button:has(.lucide-chevron-down)").click();

        // Click Language submenu trigger
        await page.getByText("Language").click();

        // Verify English is listed in the submenu
        await expect(page.getByText("English")).toBeVisible();
      },
    );

    test(
      "update password page and flow",
      {
        tag: "@C2611918",
        annotation: {
          type: "slow",
          description: "creates test user for password update flow",
        },
      },
      async ({ page, browser, apiHelper }, testInfo) => {
        testInfo.setTimeout(MULTI_USER_TIMEOUT);

        const ts = Date.now();
        const userName = `test-upd-${ts}`;
        const email = `test-upd-${ts}@e2e.local`;
        const oldPassword = "Test@123456";
        const newPassword = "Test@654321";

        await apiHelper.createUser(userName, email, oldPassword);

        try {
          const { page: userPage, context: userContext } = await loginAs(
            browser,
            apiHelper,
            email,
            oldPassword,
          );

          try {
            // Navigate to update-password page directly
            await userPage.goto("/#/update-password");
            await userPage.waitForURL("**/#/update-password");

            // Verify update password page UI
            await expect(userPage.getByText("Set New Password")).toBeVisible();
            await expect(
              userPage.locator('input[name="password"]'),
            ).toBeVisible();
            await expect(
              userPage.locator('input[name="confirmPassword"]'),
            ).toBeVisible();
            const submitBtn = userPage.getByRole("button", {
              name: /^update$/i,
            });
            await expect(submitBtn).toBeVisible();

            // Fill and submit new password
            await userPage.locator('input[name="password"]').fill(newPassword);
            await userPage
              .locator('input[name="confirmPassword"]')
              .fill(newPassword);
            await submitBtn.click();

            // Verify redirect to dashboard after successful update
            await userPage.waitForURL("**/#/dashboard");
          } finally {
            await userContext.close();
          }
        } finally {
          await apiHelper.deleteUser(userName, { retries: 5 });
        }
      },
    );

    test(
      "logout redirects to login page",
      {
        tag: "@C2611919",
        annotation: {
          type: "slow",
          description: "creates test user for logout flow",
        },
      },
      async ({ page, browser, apiHelper }, testInfo) => {
        testInfo.setTimeout(MULTI_USER_TIMEOUT);

        const ts = Date.now();
        const userName = `test-out-${ts}`;
        const email = `test-out-${ts}@e2e.local`;
        const password = "Test@123456";

        await apiHelper.createUser(userName, email, password);

        try {
          const { page: userPage, context: userContext } = await loginAs(
            browser,
            apiHelper,
            email,
            password,
          );

          try {
            // Logout
            await logout(userPage);

            // Verify login page is shown
            await expect(userPage.locator('input[name="email"]')).toBeVisible();
          } finally {
            await userContext.close();
          }
        } finally {
          await apiHelper.deleteUser(userName, { retries: 5 });
        }
      },
    );
  });

  // ────────────────────────────────────────────────────────
  // Dashboard Overview
  // ────────────────────────────────────────────────────────
  test.describe("dashboard overview", () => {
    test(
      "cluster count card shows a number",
      { tag: "@C2611920" },
      async ({ page }) => {
        await page.goto("/#/dashboard");
        await expect(page.getByText("Dashboard").first()).toBeVisible();

        // Find the Clusters card and verify it contains a number
        const clustersCard = page
          .locator("div")
          .filter({ hasText: /^Clusters$/ })
          .locator("..");
        await expect(clustersCard.getByText(/\d+/)).toBeVisible({
          timeout: 10000,
        });
      },
    );

    test(
      "endpoint count card shows a number",
      { tag: "@C2611921" },
      async ({ page }) => {
        await page.goto("/#/dashboard");
        await expect(page.getByText("Dashboard").first()).toBeVisible();

        // Find the Endpoints card and verify it contains a number
        const endpointsCard = page
          .locator("div")
          .filter({ hasText: /^Endpoints$/ })
          .locator("..");
        await expect(endpointsCard.getByText(/\d+/)).toBeVisible({
          timeout: 10000,
        });
      },
    );
  });
});
