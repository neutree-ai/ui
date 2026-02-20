import { expect, test } from "../fixtures/base";
import { MULTI_USER_TIMEOUT } from "../helpers/constants";
import { ResourcePage } from "../helpers/resource-page";

/** Default workspace that always exists in the test environment */
const DEFAULT_WORKSPACE = "default";

test.describe("workspaces list", () => {
  test(
    "list page shows expected columns and default workspace",
    {
      tag: "@C2611793",
    },
    async ({ workspaces }) => {
      await workspaces.goToList();

      const headers = workspaces.table.root.locator("thead th");
      await expect(headers.filter({ hasText: /name/i })).toBeVisible();
      await expect(headers.filter({ hasText: /updated/i })).toBeVisible();

      // Default workspace should be visible
      await workspaces.table.expectRowWithText(DEFAULT_WORKSPACE);
    },
  );

  test(
    "can sort by name",
    {
      tag: "@C2611797",
    },
    async ({ workspaces }) => {
      await workspaces.goToList();
      await workspaces.table.sort(/name/i);
    },
  );

  test(
    "updated at column visible and sortable",
    {
      tag: "@C2611798",
    },
    async ({ workspaces }) => {
      await workspaces.goToList();
      await expect(workspaces.table.headerCell(/updated/i)).toBeVisible();
      await workspaces.table.sort(/updated/i);
    },
  );

  test(
    "created at column visible and sortable",
    {
      tag: "@C2611799",
    },
    async ({ workspaces }) => {
      await workspaces.goToList();
      await expect(workspaces.table.headerCell(/created/i)).toBeVisible();
      await workspaces.table.sort(/created/i);
    },
  );

  test(
    "can toggle column visibility",
    {
      tag: "@C2611800",
    },
    async ({ workspaces }) => {
      await workspaces.goToList();
      // Created At is visible by default
      await expect(workspaces.table.headerCell(/created/i)).toBeVisible();
      // Toggle it hidden
      await workspaces.table.toggleColumn(/created/i);
      await expect(workspaces.table.headerCell(/created/i)).toBeHidden();
      // Toggle it visible again
      await workspaces.table.toggleColumn(/created/i);
      await expect(workspaces.table.headerCell(/created/i)).toBeVisible();
    },
  );

  test(
    "admin can see all workspaces",
    {
      tag: "@C2611813",
    },
    async ({ workspaces }) => {
      await workspaces.goToList();
      const rowCount = await workspaces.table.rows().count();
      expect(rowCount).toBeGreaterThan(0);
      await workspaces.table.expectRowWithText(DEFAULT_WORKSPACE);
    },
  );

  test(
    "non-admin with workspace:read can see workspaces",
    {
      tag: "@C2611825",
      annotation: {
        type: "slow",
        description: "creates test user with workspace:read permission",
      },
    },
    async ({ createTestUser }, testInfo) => {
      testInfo.setTimeout(MULTI_USER_TIMEOUT);

      const testUser = await createTestUser(["workspace:read"]);
      const wsPage = new ResourcePage(testUser.page, {
        routeName: "workspaces",
      });

      await wsPage.goToList();
      const rowCount = await wsPage.table.rows().count();
      expect(rowCount).toBeGreaterThan(0);
    },
  );

  test(
    "non-admin without workspace:read cannot see workspaces",
    {
      tag: "@C2611826",
      annotation: {
        type: "slow",
        description: "creates test user without workspace:read permission",
      },
    },
    async ({ createTestUser }, testInfo) => {
      testInfo.setTimeout(MULTI_USER_TIMEOUT);

      const testUser = await createTestUser(["role:read"]);
      const wsPage = new ResourcePage(testUser.page, {
        routeName: "workspaces",
      });

      await testUser.page.goto("/#/workspaces");
      await wsPage.table.waitForLoaded();

      await expect(
        testUser.page.locator('[data-testid="table-empty"]'),
      ).toBeVisible();
    },
  );
});

test.describe("workspace create", () => {
  test(
    "open source license limits max 1 workspace — server rejects second",
    {
      tag: "@C2611828",
    },
    async ({ workspaces }) => {
      await workspaces.goToCreate();

      await workspaces.form.fillInput(
        "metadata.name",
        `test-ws-oslimit-${Date.now()}`,
      );

      const responsePromise = workspaces.page.waitForResponse(
        (r) =>
          r.url().includes("/workspaces") && r.request().method() === "POST",
      );
      await workspaces.form.submit();
      const response = await responsePromise;

      // Server enforces limit: "default" already exists → reject
      expect(response.status()).toBeGreaterThanOrEqual(400);

      // Form stays visible (not redirected to list)
      await expect(
        workspaces.page.locator('[data-testid="form"]'),
      ).toBeVisible();
    },
  );

  test(
    "delete workspace from list action menu with confirmation",
    {
      tag: "@C2611831",
    },
    async ({ workspaces, apiHelper }) => {
      const name = `test-ws-del-${Date.now()}`;
      try {
        await apiHelper.createWorkspace(name);
      } catch {
        // Open-source license limits to 1 workspace — skip when creation is blocked
        test.skip(true, "workspace creation blocked by license limit");
        return;
      }

      await workspaces.goToList();
      await workspaces.table.deleteRow(name);
    },
  );
});

test.describe("workspaces detail", () => {
  test(
    "show page displays name, created at, updated at, and workspace policies section",
    {
      tag: "@C2611803",
    },
    async ({ workspaces }) => {
      await workspaces.goToShow(DEFAULT_WORKSPACE);

      const showPage = workspaces.page.locator('[data-testid="show-page"]');
      await expect(showPage).toBeVisible();

      // Verify workspace name is displayed
      await expect(
        showPage.getByText(DEFAULT_WORKSPACE, { exact: true }),
      ).toBeVisible();

      // Verify timestamps are displayed (scope to metadata card <dt> elements
      // to avoid strict mode violation with the policies table header)
      await expect(
        showPage.getByRole("term").filter({ hasText: /created at/i }),
      ).toBeVisible();
      await expect(
        showPage.getByRole("term").filter({ hasText: /updated at/i }),
      ).toBeVisible();

      // Verify workspace policies section exists
      await expect(showPage.locator('[data-testid="table"]')).toBeVisible();
    },
  );
});
