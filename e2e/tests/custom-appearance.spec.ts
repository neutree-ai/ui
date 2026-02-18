import type { Browser, Page } from "@playwright/test";
import { expect, test } from "../fixtures/base";
import { ApiHelper } from "../helpers/api-helper";
import { MULTI_USER_TIMEOUT } from "../helpers/constants";

// ── Minimal test images ──

/** 1x1 red pixel PNG */
const MINI_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

/** 1x1 red pixel SVG */
const MINI_SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect fill="red" width="1" height="1"/></svg>',
);

/**
 * Navigate to the OEM config page with a full page reload.
 * Hash-only changes don't reload the SPA, so we reload() to clear
 * any stale React Query cache for the OEM config hook.
 */
async function goToOemConfig(page: Page): Promise<void> {
  await page.goto("/#/oem-configs");
  await page.reload();
  await page.locator('[data-testid="form"]').waitFor({ state: "visible" });
  // Wait for the form's getOne API call to populate fields before interacting.
  // See contributing/e2e.md "Edit form race condition".
  await expect(page.locator('[data-testid="form-submit"]')).toBeEnabled();
}

/**
 * Click Save and wait for the form submit to complete.
 * Waits for any non-GET response to oem_configs endpoint.
 */
async function saveForm(page: Page): Promise<void> {
  const responsePromise = page.waitForResponse(
    (resp) =>
      resp.url().includes("oem_configs") && resp.request().method() !== "GET",
    { timeout: 15000 },
  );
  await page.locator('[data-testid="form-submit"]').click();
  await responsePromise;
}

/**
 * Navigate to dashboard with a full page reload to clear SPA cache.
 * Accepts any warnWhenUnsavedChanges dialog that may fire during
 * hash-only navigation (react-hook-form doesn't auto-reset dirty state).
 */
async function goToDashboard(page: Page): Promise<void> {
  // Register dialog handler BEFORE navigation to catch any confirm dialogs
  const dialogHandler = (dialog: import("@playwright/test").Dialog) =>
    dialog.accept();
  page.on("dialog", dialogHandler);

  await page.goto("/#/dashboard");
  await page.reload();
  await page.waitForURL("**/#/dashboard");
  // Wait for sidebar brand to render after OEM config hook loads
  await page
    .locator('[data-sidebar="sidebar"]')
    .getByAltText("logo")
    .waitFor({ timeout: 10000 });

  page.off("dialog", dialogHandler);
}

/** Verify brand name is shown in the sidebar */
async function expectSidebarBrand(page: Page, brandName: string) {
  const sidebar = page.locator('[data-sidebar="sidebar"]');
  await expect(sidebar.getByText(brandName)).toBeVisible();
}

/** Verify logo src matches pattern in the sidebar */
async function expectSidebarLogo(page: Page, srcPattern: RegExp) {
  const logoImg = page.locator('[data-sidebar="sidebar"]').getByAltText("logo");
  await expect(logoImg).toBeVisible();
  await expect(logoImg).toHaveAttribute("src", srcPattern);
}

/** Verify brand name is shown on the login page using an incognito context */
async function expectLoginPageBrand(
  browser: Browser,
  adminPage: Page,
  brandName: string,
) {
  const baseURL = new URL(adminPage.url()).origin;
  const incognito = await browser.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
  });
  const loginPage = await incognito.newPage();
  await loginPage.goto("/#/login");
  await loginPage.getByLabel(/email/i).waitFor({ state: "visible" });
  await expect(loginPage.getByText(brandName)).toBeVisible();
  await incognito.close();
}

// ════════════════════════════════════════════════════════════
// Custom Appearance Tests
// ════════════════════════════════════════════════════════════

test.describe("custom appearance", () => {
  // Ensure clean state after all tests
  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const api = new ApiHelper(page);
    await api.resetOemConfig();
    await context.close();
  });

  // ────────────────────────────────────────────────────────
  // Display
  // ────────────────────────────────────────────────────────
  test.describe("display", () => {
    test(
      "default appearance shows Neutree brand name and logo",
      { tag: "@C2611843" },
      async ({ page, apiHelper }) => {
        await apiHelper.resetOemConfig();
        await goToDashboard(page);

        await expectSidebarBrand(page, "Neutree");
        await expectSidebarLogo(page, /logo\.png/);
      },
    );

    test(
      "homepage sidebar shows custom brand name and logo",
      { tag: "@C2611844" },
      async ({ page, apiHelper }) => {
        const customBrand = `TestBrand-${Date.now()}`;
        await apiHelper.upsertOemConfig({
          brand_name: customBrand,
          logo_base64: `data:image/png;base64,${MINI_PNG.toString("base64")}`,
        });

        await goToDashboard(page);

        await expectSidebarBrand(page, customBrand);
        await expectSidebarLogo(page, /^data:image\/png/);

        // Cleanup
        await apiHelper.resetOemConfig();
      },
    );

    test(
      "login page shows custom brand name and logo",
      { tag: "@C2611842" },
      async ({ page, browser, apiHelper }) => {
        const customBrand = `LoginBrand-${Date.now()}`;
        await apiHelper.upsertOemConfig({
          brand_name: customBrand,
          logo_base64: `data:image/png;base64,${MINI_PNG.toString("base64")}`,
        });

        await expectLoginPageBrand(browser, page, customBrand);

        // Cleanup
        await apiHelper.resetOemConfig();
      },
    );
  });

  // ────────────────────────────────────────────────────────
  // Edit
  // ────────────────────────────────────────────────────────
  test.describe("edit", () => {
    test(
      "edit page loads current config values",
      { tag: "@C2611845" },
      async ({ page, apiHelper }) => {
        const brandName = `CurrentBrand-${Date.now()}`;
        await apiHelper.upsertOemConfig({
          brand_name: brandName,
          logo_base64: `data:image/png;base64,${MINI_PNG.toString("base64")}`,
        });

        await goToOemConfig(page);

        const brandInput = page.getByPlaceholder("Enter brand name");
        await expect(brandInput).toHaveValue(brandName);
        await expect(page.getByAltText("Main logo preview")).toBeVisible();

        // Cleanup
        await apiHelper.resetOemConfig();
      },
    );

    test(
      "brand name accepts special characters",
      { tag: "@C2611835" },
      async ({ page, apiHelper }) => {
        await apiHelper.resetOemConfig();
        await goToOemConfig(page);

        const brandInput = page.getByPlaceholder("Enter brand name");

        const specialBrand = "Test Brand & Co. (2024) - AI!";
        await brandInput.fill(specialBrand);

        await saveForm(page);

        // Reload and verify the value was saved
        await goToOemConfig(page);
        await expect(brandInput).toHaveValue(specialBrand);

        // Cleanup
        await apiHelper.resetOemConfig();
      },
    );

    test(
      "main logo upload shows preview",
      { tag: "@C2611836" },
      async ({ page, apiHelper }) => {
        await apiHelper.resetOemConfig();
        await goToOemConfig(page);

        // No preview initially
        await expect(page.getByAltText("Main logo preview")).toBeHidden();

        // Upload via hidden file input
        const fileInput = page
          .locator('input[type="file"][accept="image/*"]')
          .first();
        await fileInput.setInputFiles({
          name: "test-logo.png",
          mimeType: "image/png",
          buffer: MINI_PNG,
        });

        // Preview should appear with base64 src
        const preview = page.getByAltText("Main logo preview");
        await expect(preview).toBeVisible();
        await expect(preview).toHaveAttribute("src", /^data:image\/png/);
      },
    );

    test(
      "collapsed logo upload shows preview",
      { tag: "@C2611837" },
      async ({ page, apiHelper }) => {
        await apiHelper.resetOemConfig();
        await goToOemConfig(page);

        // No preview initially
        await expect(page.getByAltText("Collapsed logo preview")).toBeHidden();

        // Upload via filechooser triggered by the Upload Collapsed Logo button
        const [fileChooser] = await Promise.all([
          page.waitForEvent("filechooser"),
          page.getByRole("button", { name: /upload collapsed logo/i }).click(),
        ]);
        await fileChooser.setFiles({
          name: "test-collapsed.png",
          mimeType: "image/png",
          buffer: MINI_PNG,
        });

        const preview = page.getByAltText("Collapsed logo preview");
        await expect(preview).toBeVisible();
        await expect(preview).toHaveAttribute("src", /^data:image\/png/);
      },
    );

    test(
      "supports PNG and SVG image formats",
      { tag: "@C2611838" },
      async ({ page, apiHelper }) => {
        await apiHelper.resetOemConfig();
        await goToOemConfig(page);

        const fileInput = page
          .locator('input[type="file"][accept="image/*"]')
          .first();
        const preview = page.getByAltText("Main logo preview");

        // Test PNG
        await fileInput.setInputFiles({
          name: "test-logo.png",
          mimeType: "image/png",
          buffer: MINI_PNG,
        });
        await expect(preview).toBeVisible();
        await expect(preview).toHaveAttribute("src", /^data:image\/png/);

        // Clear via the X button next to the main logo preview
        await preview.locator("..").getByRole("button").click();
        await expect(preview).toBeHidden();

        // Test SVG
        await fileInput.setInputFiles({
          name: "test-logo.svg",
          mimeType: "image/svg+xml",
          buffer: MINI_SVG,
        });
        await expect(preview).toBeVisible();
        await expect(preview).toHaveAttribute("src", /^data:image\/svg\+xml/);
      },
    );

    test(
      "save updates homepage sidebar and login page",
      { tag: "@C2611839" },
      async ({ page, browser, apiHelper }) => {
        await apiHelper.resetOemConfig();
        await goToOemConfig(page);

        const customBrand = `SavedBrand-${Date.now()}`;

        await page.getByPlaceholder("Enter brand name").fill(customBrand);

        const fileInput = page
          .locator('input[type="file"][accept="image/*"]')
          .first();
        await fileInput.setInputFiles({
          name: "test-logo.png",
          mimeType: "image/png",
          buffer: MINI_PNG,
        });

        await saveForm(page);

        // Verify sidebar updated (same page, no navigation needed)
        await page
          .locator('[data-sidebar="sidebar"]')
          .getByAltText("logo")
          .waitFor({ timeout: 10000 });
        await expectSidebarBrand(page, customBrand);

        // Verify login page
        await expectLoginPageBrand(browser, page, customBrand);

        // Cleanup
        await apiHelper.resetOemConfig();
      },
    );

    test(
      "unsaved changes are discarded when navigating away",
      { tag: "@C2611840" },
      async ({ page, apiHelper }) => {
        await apiHelper.resetOemConfig();
        await goToOemConfig(page);

        // Modify the brand name
        const brandInput = page.getByPlaceholder("Enter brand name");
        await brandInput.fill("UnsavedBrand");

        // Accept any dialog (browser confirm from warnWhenUnsavedChanges)
        page.on("dialog", (dialog) => dialog.accept());

        // Use sidebar link click to trigger in-app navigation
        // (hash-based routing won't fire beforeunload on page.goto)
        await page
          .locator('[data-sidebar="sidebar"]')
          .getByRole("link", { name: /dashboard/i })
          .click();
        await page.waitForURL("**/#/dashboard");

        // Navigate back — form should NOT have the unsaved value
        await goToOemConfig(page);
        await expect(brandInput).not.toHaveValue("UnsavedBrand");
      },
    );

    test(
      "saving empty fields resets to default Neutree appearance",
      { tag: "@C2611841" },
      async ({ page, apiHelper }) => {
        // First set a custom config
        await apiHelper.upsertOemConfig({
          brand_name: "TempBrand",
          logo_base64: `data:image/png;base64,${MINI_PNG.toString("base64")}`,
        });

        await goToOemConfig(page);

        // Clear brand name
        const brandInput = page.getByPlaceholder("Enter brand name");
        await brandInput.clear();

        // Clear logo via X button if preview visible
        const logoPreview = page.getByAltText("Main logo preview");
        if (await logoPreview.isVisible()) {
          await logoPreview.locator("..").getByRole("button").click();
        }

        await saveForm(page);

        // Reload same page (avoids warnWhenUnsavedChanges hash nav issue)
        await page.reload();
        await page
          .locator('[data-sidebar="sidebar"]')
          .getByAltText("logo")
          .waitFor({ timeout: 10000 });

        // Custom brand "TempBrand" should no longer appear in the sidebar
        const sidebar = page.locator('[data-sidebar="sidebar"]');
        await expect(sidebar.getByText("TempBrand")).toBeHidden();
        await expectSidebarLogo(page, /logo\.png/);
      },
    );
  });

  // ────────────────────────────────────────────────────────
  // Permissions
  // ────────────────────────────────────────────────────────
  test.describe("permissions", () => {
    test(
      "admin user can edit custom appearance",
      { tag: "@C2611848" },
      async ({ page, apiHelper }) => {
        await apiHelper.resetOemConfig();
        await goToOemConfig(page);

        const brandName = `AdminBrand-${Date.now()}`;
        await page.getByPlaceholder("Enter brand name").fill(brandName);

        await saveForm(page);

        // Reload and verify
        await goToOemConfig(page);
        await expect(page.getByPlaceholder("Enter brand name")).toHaveValue(
          brandName,
        );

        // Cleanup
        await apiHelper.resetOemConfig();
      },
    );

    test(
      "non-admin with system:admin permission can edit",
      {
        tag: "@C2611849",
        annotation: {
          type: "slow",
          description: "creates test user with system:admin permission",
        },
      },
      async ({ createTestUser, apiHelper, page }, testInfo) => {
        testInfo.setTimeout(MULTI_USER_TIMEOUT);

        await apiHelper.resetOemConfig();
        const testUser = await createTestUser(["system:admin"]);

        await goToOemConfig(testUser.page);

        const brandName = `SysAdminBrand-${Date.now()}`;
        await testUser.page
          .getByPlaceholder("Enter brand name")
          .fill(brandName);

        await saveForm(testUser.page);

        // Verify the save persisted by checking via the admin page
        await goToDashboard(page);
        await expectSidebarBrand(page, brandName);

        // Cleanup
        await apiHelper.resetOemConfig();
      },
    );

    test(
      "non-admin without system:admin cannot save changes",
      {
        tag: "@C2611850",
        annotation: {
          type: "slow",
          description: "creates test user without system:admin permission",
        },
      },
      async ({ createTestUser, apiHelper, page }, testInfo) => {
        testInfo.setTimeout(MULTI_USER_TIMEOUT);

        await apiHelper.resetOemConfig();
        const testUser = await createTestUser(["role:read"]);

        await goToOemConfig(testUser.page);

        // Try to save
        await testUser.page
          .getByPlaceholder("Enter brand name")
          .fill("ShouldFail");

        // Click save and capture response to check status
        const responsePromise = testUser.page.waitForResponse(
          (resp) =>
            resp.url().includes("oem_configs") &&
            resp.request().method() !== "GET",
          { timeout: 15000 },
        );
        await testUser.page.locator('[data-testid="form-submit"]').click();
        const response = await responsePromise;

        // PostgREST may return 200 with 0 rows affected (RLS silently blocks)
        // or 4xx (explicit rejection). Either way, verify the change was NOT persisted.
        const status = response.status();
        if (status < 400) {
          // RLS silently blocked — verify via admin that "ShouldFail" was NOT saved
          await goToDashboard(page);
          const sidebar = page.locator('[data-sidebar="sidebar"]');
          await expect(sidebar.getByText("ShouldFail")).toBeHidden();
        }
        // If 4xx, the save was explicitly rejected — test passes
      },
    );
  });
});
