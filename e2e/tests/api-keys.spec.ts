import { expect, test } from "../fixtures/base";
import { ApiHelper } from "../helpers/api-helper";
import { ASYNC_UI_TIMEOUT, MULTI_USER_TIMEOUT } from "../helpers/constants";
import { ResourcePage } from "../helpers/resource-page";

// ── Shared test data for list + detail tests ──
const keyNames = {
  a: "", // first key
  b: "", // second key
};

test.describe("api keys", () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const api = new ApiHelper(page);

    const ts = Date.now();
    keyNames.a = `test-ak-a-${ts}`;
    keyNames.b = `test-ak-b-${ts}`;

    await api.createApiKey(keyNames.a);
    await api.createApiKey(keyNames.b);

    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const api = new ApiHelper(page);

    for (const name of Object.values(keyNames)) {
      await api.deleteApiKey(name).catch(() => {});
    }
    await context.close();
  });

  // ────────────────────────────────────────────────────────────
  // List tests
  // ────────────────────────────────────────────────────────────
  test.describe("list", () => {
    test(
      "list page shows expected columns",
      {
        tag: "@C2611860",
      },
      async ({ apiKeys }) => {
        await apiKeys.goToList();

        const headers = apiKeys.table.root.locator("thead th");
        await expect(headers.filter({ hasText: /name/i })).toBeVisible();
        await expect(headers.filter({ hasText: /workspace/i })).toBeVisible();
        await expect(headers.filter({ hasText: /updated/i })).toBeVisible();
        await expect(headers.filter({ hasText: /created/i })).toBeVisible();

        await apiKeys.table.expectRowWithText(keyNames.a);
      },
    );

    test(
      "can sort by name",
      {
        tag: "@C2611865",
      },
      async ({ apiKeys }) => {
        await apiKeys.goToList();
        await apiKeys.table.sort(/name/i);
      },
    );

    test(
      "workspace column links to workspace detail",
      {
        tag: "@C2611866",
      },
      async ({ apiKeys }) => {
        await apiKeys.goToList();

        const row = apiKeys.table.rowWithText(keyNames.a);
        await row.getByRole("link", { name: "default" }).click();

        const showPage = apiKeys.page.locator('[data-testid="show-page"]');
        await expect(showPage).toBeVisible();
        await expect(
          showPage.getByText("default", { exact: true }),
        ).toBeVisible();
      },
    );

    test(
      "can sort by created at",
      {
        tag: "@C2611867",
      },
      async ({ apiKeys }) => {
        await apiKeys.goToList();
        await apiKeys.table.sort(/created/i);
      },
    );

    test(
      "can toggle column visibility",
      {
        tag: "@C2611868",
      },
      async ({ apiKeys }) => {
        await apiKeys.goToList();
        // Workspace column is visible by default
        await expect(apiKeys.table.headerCell(/workspace/i)).toBeVisible();
        // Toggle it hidden
        await apiKeys.table.toggleColumn(/workspace/i);
        await expect(apiKeys.table.headerCell(/workspace/i)).toBeHidden();
        // Toggle it visible again
        await apiKeys.table.toggleColumn(/workspace/i);
        await expect(apiKeys.table.headerCell(/workspace/i)).toBeVisible();
      },
    );

    test(
      "only current user's keys are visible",
      {
        tag: "@C2611876",
        annotation: {
          type: "slow",
          description:
            "creates test user and verifies they cannot see admin's keys",
        },
      },
      async ({ createTestUser, apiKeys }, testInfo) => {
        testInfo.setTimeout(MULTI_USER_TIMEOUT);

        // Admin should see the test keys
        await apiKeys.goToList();
        await apiKeys.table.expectRowWithText(keyNames.a);

        // Create a test user with basic permissions (API keys are filtered by user identity)
        const testUser = await createTestUser(["role:read"]);
        const testApiKeys = new ResourcePage(testUser.page, {
          routeName: "api-keys",
          workspaced: true,
        });

        await testApiKeys.goToList();
        await testApiKeys.table.waitForLoaded();

        // Test user should not see admin's keys
        await testApiKeys.table.expectNoRowWithText(keyNames.a);
        await testApiKeys.table.expectNoRowWithText(keyNames.b);
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // Detail tests
  // ────────────────────────────────────────────────────────────
  test.describe("detail", () => {
    test(
      "show page displays name, workspace, timestamps, and usage stats table",
      {
        tag: "@C2611871",
      },
      async ({ apiKeys }) => {
        await apiKeys.goToShow(keyNames.a);

        const showPage = apiKeys.page.locator('[data-testid="show-page"]');
        await expect(showPage).toBeVisible();

        // Name
        await expect(
          showPage.getByText(keyNames.a, { exact: true }),
        ).toBeVisible();

        // Workspace
        const workspaceDt = showPage.locator("dt", {
          hasText: /workspace/i,
        });
        await expect(workspaceDt).toBeVisible();

        // Timestamps
        await expect(
          showPage.getByRole("term").filter({ hasText: /created at/i }),
        ).toBeVisible();
        await expect(
          showPage.getByRole("term").filter({ hasText: /updated at/i }),
        ).toBeVisible();

        // API Usage Statistics table
        await expect(
          apiKeys.page.getByText(/api usage statistics/i),
        ).toBeVisible();

        // Table headers: Date, Endpoint, Usage
        const usageTable = apiKeys.page.locator("table").last();
        await expect(usageTable.getByText(/date/i)).toBeVisible();
        await expect(usageTable.getByText(/endpoint/i)).toBeVisible();
        await expect(usageTable.getByText(/usage/i)).toBeVisible();
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // Create tests
  // ────────────────────────────────────────────────────────────
  test.describe("create", () => {
    test(
      "name format accepts special characters",
      {
        tag: "@C2611861",
      },
      async ({ apiKeys, apiHelper }) => {
        const akName = `test-ak-sp.${Date.now()}`;

        await apiKeys.goToList();

        // Click Create button to open modal dialog
        await apiKeys.page.getByRole("link", { name: /create/i }).click();
        const dialog = apiKeys.page.getByRole("dialog");
        await dialog.waitFor({ state: "visible" });

        // Select workspace
        await dialog
          .locator("button")
          .filter({ hasText: /select/i })
          .click();
        await apiKeys.page
          .locator('[data-state="open"][role="dialog"]')
          .getByRole("option", { name: "default", exact: true })
          .click();

        // Fill name (target by accessible name to avoid cmdk input)
        await dialog.getByRole("textbox", { name: /name/i }).fill(akName);

        // Submit
        await dialog.getByRole("button", { name: /^create$/i }).click();

        // Should show secret key (success state)
        await expect(
          dialog.getByText("API Key created successfully", { exact: false }),
        ).toBeVisible({ timeout: ASYNC_UI_TIMEOUT });
        await expect(dialog.locator("code")).toBeVisible();

        // Close the dialog (use .first() to avoid matching the Radix X button)
        await dialog.getByRole("button", { name: /close/i }).first().click();
        await dialog.waitFor({ state: "hidden" });

        // Verify in list
        await apiKeys.table.expectRowWithText(akName);

        // Cleanup
        await apiHelper.deleteApiKey(akName).catch(() => {});
      },
    );

    test(
      "save creates key and displays secret key",
      {
        tag: "@C2611863",
      },
      async ({ apiKeys, apiHelper }) => {
        const akName = `test-ak-save-${Date.now()}`;

        await apiKeys.goToList();
        await apiKeys.page.getByRole("link", { name: /create/i }).click();
        const dialog = apiKeys.page.getByRole("dialog");
        await dialog.waitFor({ state: "visible" });

        // Select workspace
        await dialog
          .locator("button")
          .filter({ hasText: /select/i })
          .click();
        await apiKeys.page
          .locator('[data-state="open"][role="dialog"]')
          .getByRole("option", { name: "default", exact: true })
          .click();

        // Fill name (target by accessible name to avoid cmdk input)
        await dialog.getByRole("textbox", { name: /name/i }).fill(akName);

        // Submit
        await dialog.getByRole("button", { name: /^create$/i }).click();

        // Verify success state: secret key shown
        await expect(
          dialog.getByText("API Key created successfully", { exact: false }),
        ).toBeVisible({ timeout: ASYNC_UI_TIMEOUT });
        const secretKey = await dialog.locator("code").textContent();
        expect(secretKey).toBeTruthy();
        expect(secretKey?.length).toBeGreaterThan(10);

        // Close (use .first() to avoid matching the Radix X button)
        await dialog.getByRole("button", { name: /close/i }).first().click();
        await dialog.waitFor({ state: "hidden" });

        // Cleanup
        await apiHelper.deleteApiKey(akName).catch(() => {});
      },
    );

    test(
      "cancel button closes dialog without creating",
      {
        tag: "@C2611864",
      },
      async ({ apiKeys }) => {
        const akName = `test-ak-cancel-${Date.now()}`;

        await apiKeys.goToList();
        await apiKeys.page.getByRole("link", { name: /create/i }).click();
        const dialog = apiKeys.page.getByRole("dialog");
        await dialog.waitFor({ state: "visible" });

        // Fill name but cancel
        await dialog.getByRole("textbox", { name: /name/i }).fill(akName);
        await dialog.getByRole("button", { name: /cancel/i }).click();
        await dialog.waitFor({ state: "hidden" });

        // Key should not appear in list
        await apiKeys.table.expectNoRowWithText(akName);
      },
    );

    test(
      "OSS only allows default workspace",
      {
        tag: "@C2611875",
      },
      async ({ apiKeys }) => {
        await apiKeys.goToList();
        await apiKeys.page.getByRole("link", { name: /create/i }).click();
        const dialog = apiKeys.page.getByRole("dialog");
        await dialog.waitFor({ state: "visible" });

        // Open workspace combobox
        await dialog
          .locator("button")
          .filter({ hasText: /select/i })
          .click();
        const popover = apiKeys.page.locator(
          '[data-state="open"][role="dialog"]',
        );

        // Should show "default" workspace option
        await expect(
          popover.getByRole("option", { name: "default" }),
        ).toBeVisible();

        // Close
        await apiKeys.page.keyboard.press("Escape");
        await dialog.getByRole("button", { name: /cancel/i }).click();
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // Delete tests
  // ────────────────────────────────────────────────────────────
  test.describe("delete", () => {
    test(
      "can delete from list action menu",
      {
        tag: "@C2611869",
      },
      async ({ apiKeys, apiHelper }) => {
        const akName = `test-ak-del-${Date.now()}`;
        await apiHelper.createApiKey(akName);

        await apiKeys.goToList();
        await apiKeys.table.deleteRow(akName);
        await apiKeys.table.expectNoRowWithText(akName);
      },
    );
  });
});
