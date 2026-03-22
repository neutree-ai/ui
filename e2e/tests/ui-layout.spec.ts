import { config } from "../config";
import { expect, type Page, test } from "../fixtures/base";
import { DELETE_TIMEOUT, MULTI_USER_TIMEOUT } from "../helpers/constants";
import { loginAs, logout } from "../helpers/test-user-context";

/** data-testid mapping for dashboard count cards */
const DASHBOARD_CARD_TESTID: Record<string, string> = {
  Clusters: "dashboard-cluster-count",
  Endpoints: "dashboard-endpoint-count",
};

/** Read the count number from a dashboard card by data-testid */
async function getDashboardCount(page: Page, title: string): Promise<number> {
  const testId = DASHBOARD_CARD_TESTID[title];
  const card = page.locator(`[data-testid="${testId}"]`);
  await expect(card.getByText(/\d+/)).toBeVisible({ timeout: 10000 });
  // The count is rendered directly as text content inside CardContent
  const text = await card.getByText(/\d+/).textContent();
  return Number(text);
}

/** Poll-reload dashboard until expected count appears, with timeout */
async function waitForDashboardCount(
  page: Page,
  title: string,
  expected: number,
  timeout = DELETE_TIMEOUT,
): Promise<void> {
  const testId = DASHBOARD_CARD_TESTID[title];
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    await page.reload();
    await expect(page.getByText("Dashboard").first()).toBeVisible();
    const count = await getDashboardCount(page, title);
    if (count === expected) return;
    await page.waitForTimeout(2000);
  }
  // Final assertion to generate a proper error message
  const card = page.locator(`[data-testid="${testId}"]`);
  await expect(card.getByText(String(expected))).toBeVisible({ timeout: 5000 });
}

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
            .fill(config.auth.email);
          await incognitoPage
            .locator('input[name="password"]')
            .fill(config.auth.password);
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
    test("sidebar logo is visible in expanded state", {
      tag: "@C2611912",
    }, async ({ page }) => {
      await page.goto("/#/dashboard");
      await page.waitForURL("**/#/dashboard");

      const sidebar = page.locator('[data-sidebar="sidebar"]');
      await expect(sidebar.getByAltText("logo")).toBeVisible();
    });

    test("sidebar toggle collapses and expands", { tag: "@C2611913" }, async ({
      page,
    }) => {
      await page.goto("/#/dashboard");
      await page.waitForURL("**/#/dashboard");

      const sidebarWrapper = page.locator(".peer[data-state]");
      const initialState = await sidebarWrapper.getAttribute("data-state");

      // Click toggle
      await page.getByRole("button", { name: /toggle sidebar/i }).click();

      // Verify state flipped
      const toggledState =
        initialState === "expanded" ? "collapsed" : "expanded";
      await expect(sidebarWrapper).toHaveAttribute("data-state", toggledState);

      // Click again to restore
      await page.getByRole("button", { name: /toggle sidebar/i }).click();
      await expect(sidebarWrapper).toHaveAttribute(
        "data-state",
        initialState ?? "expanded",
      );
    });
  });

  // ────────────────────────────────────────────────────────
  // Theme
  // ────────────────────────────────────────────────────────
  test.describe("theme", () => {
    test("theme toggle switches between dark, light, and system", {
      tag: "@C2611914",
    }, async ({ page }) => {
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
    });
  });

  // ────────────────────────────────────────────────────────
  // User Menu
  // ────────────────────────────────────────────────────────
  test.describe("user menu", () => {
    test("user dropdown shows username and email", {
      tag: "@C2611915",
    }, async ({ page }) => {
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
    });

    test("user dropdown shows version info", { tag: "@C2611916" }, async ({
      page,
    }) => {
      await page.goto("/#/dashboard");
      await page.waitForURL("**/#/dashboard");

      await page.locator("button:has(.lucide-chevron-down)").click();

      const dropdownContent = page.locator(
        '[role="menu"], [data-radix-menu-content]',
      );
      await expect(dropdownContent.getByText("Version")).toBeVisible();
    });

    test("language submenu shows English option", { tag: "@C2611917" }, async ({
      page,
    }) => {
      await page.goto("/#/dashboard");
      await page.waitForURL("**/#/dashboard");

      await page.locator("button:has(.lucide-chevron-down)").click();

      // Click Language submenu trigger
      await page.getByText("Language").click();

      // Verify English is listed in the submenu
      await expect(page.getByText("English")).toBeVisible();
    });

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
    test("cluster count card shows a number", { tag: "@C2611920" }, async ({
      page,
    }) => {
      await page.goto("/#/dashboard");
      await expect(page.getByText("Dashboard").first()).toBeVisible();

      const clustersCard = page.locator(
        '[data-testid="dashboard-cluster-count"]',
      );
      await expect(clustersCard.getByText(/\d+/)).toBeVisible({
        timeout: 10000,
      });
    });

    test("endpoint count card shows a number", { tag: "@C2611921" }, async ({
      page,
    }) => {
      await page.goto("/#/dashboard");
      await expect(page.getByText("Dashboard").first()).toBeVisible();

      const endpointsCard = page.locator(
        '[data-testid="dashboard-endpoint-count"]',
      );
      await expect(endpointsCard.getByText(/\d+/)).toBeVisible({
        timeout: 10000,
      });
    });

    test(
      "cluster count changes on add and delete",
      {
        tag: "@C2611945",
        annotation: {
          type: "slow",
          description: "creates and deletes cluster to verify count change",
        },
      },
      async ({ page, apiHelper }, testInfo) => {
        testInfo.setTimeout(MULTI_USER_TIMEOUT);

        const ts = Date.now();
        const irName = `test-dash-ir-${ts}`;
        const clusterName = `test-dash-cl-${ts}`;

        await page.goto("/#/dashboard");
        await expect(page.getByText("Dashboard").first()).toBeVisible();

        const initialCount = await getDashboardCount(page, "Clusters");

        // Create resources
        await apiHelper.createImageRegistry(irName);
        await apiHelper.createCluster(clusterName, {
          imageRegistry: irName,
        });

        try {
          // Wait for count to increase (creation may take a moment to reflect)
          await waitForDashboardCount(page, "Clusters", initialCount + 1);

          // Delete cluster and wait for GC
          await apiHelper.deleteCluster(clusterName, { force: true });
          await waitForDashboardCount(page, "Clusters", initialCount);
        } finally {
          await apiHelper
            .deleteCluster(clusterName, { force: true })
            .catch(() => {});
          await apiHelper
            .deleteImageRegistry(irName, { force: true })
            .catch(() => {});
        }
      },
    );

    test(
      "endpoint count changes on add and delete",
      {
        tag: "@C2611946",
        annotation: {
          type: "slow",
          description:
            "creates full resource chain for endpoint count verification",
        },
      },
      async ({ page, apiHelper }, testInfo) => {
        testInfo.setTimeout(MULTI_USER_TIMEOUT);

        const ts = Date.now();
        const irName = `test-dash-ep-ir-${ts}`;
        const clusterName = `test-dash-ep-cl-${ts}`;
        const mrName = `test-dash-ep-mr-${ts}`;
        const epName = `test-dash-ep-${ts}`;

        await page.goto("/#/dashboard");
        await expect(page.getByText("Dashboard").first()).toBeVisible();

        const initialCount = await getDashboardCount(page, "Endpoints");

        // Create full dependency chain
        await apiHelper.createImageRegistry(irName);
        await apiHelper.createCluster(clusterName, {
          imageRegistry: irName,
        });
        await apiHelper.createModelRegistry(mrName);
        await apiHelper.createEndpoint(epName, {
          cluster: clusterName,
          modelRegistry: mrName,
        });

        try {
          // Wait for count to increase (creation may take a moment to reflect)
          await waitForDashboardCount(page, "Endpoints", initialCount + 1);

          // Delete endpoint and wait for GC
          await apiHelper.deleteEndpoint(epName, { force: true });
          await waitForDashboardCount(page, "Endpoints", initialCount);
        } finally {
          await apiHelper
            .deleteEndpoint(epName, { force: true })
            .catch(() => {});
          await apiHelper
            .deleteCluster(clusterName, { force: true })
            .catch(() => {});
          await apiHelper
            .deleteModelRegistry(mrName, { force: true })
            .catch(() => {});
          await apiHelper
            .deleteImageRegistry(irName, { force: true })
            .catch(() => {});
        }
      },
    );

    test(
      "cluster count shows only clusters visible to current user",
      {
        tag: "@C2611947",
        annotation: {
          type: "slow",
          description: "creates test user without cluster:read permission",
        },
      },
      async ({ page, createTestUser }, testInfo) => {
        testInfo.setTimeout(MULTI_USER_TIMEOUT);

        // Admin should see clusters (count >= 0)
        await page.goto("/#/dashboard");
        await expect(page.getByText("Dashboard").first()).toBeVisible();

        // Create test user WITHOUT cluster:read permission
        const testUser = await createTestUser([
          "endpoint:read",
          "workspace:read",
        ]);

        await testUser.page.goto("/#/dashboard");
        await expect(
          testUser.page.getByText("Dashboard").first(),
        ).toBeVisible();

        // User without cluster:read should see 0 clusters
        const clustersCard = testUser.page.locator(
          '[data-testid="dashboard-cluster-count"]',
        );
        await expect(clustersCard.getByText("0")).toBeVisible({
          timeout: 10000,
        });
      },
    );

    test(
      "endpoint count shows only endpoints visible to current user",
      {
        tag: "@C2611948",
        annotation: {
          type: "slow",
          description: "creates test user without endpoint:read permission",
        },
      },
      async ({ page, createTestUser }, testInfo) => {
        testInfo.setTimeout(MULTI_USER_TIMEOUT);

        // Admin should see endpoints (count >= 0)
        await page.goto("/#/dashboard");
        await expect(page.getByText("Dashboard").first()).toBeVisible();

        // Create test user WITHOUT endpoint:read permission
        const testUser = await createTestUser([
          "cluster:read",
          "workspace:read",
        ]);

        await testUser.page.goto("/#/dashboard");
        await expect(
          testUser.page.getByText("Dashboard").first(),
        ).toBeVisible();

        // User without endpoint:read should see 0 endpoints
        const endpointsCard = testUser.page.locator(
          '[data-testid="dashboard-endpoint-count"]',
        );
        await expect(endpointsCard.getByText("0")).toBeVisible({
          timeout: 10000,
        });
      },
    );
  });
});
