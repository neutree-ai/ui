import { expect, test } from "../fixtures/base";
import { MULTI_USER_TIMEOUT } from "../helpers/constants";
import { ResourcePage } from "../helpers/resource-page";

/** Known engines that exist in the test environment */
const ENGINE_LLAMA = "llama-cpp";
const ENGINE_VLLM = "vllm";

test.describe("engines list", () => {
  test(
    "list page shows expected columns and known engines",
    {
      tag: ["@C2613049", "@C2613204"],
    },
    async ({ engines }) => {
      await engines.goToList();

      const headers = engines.table.root.locator("thead th");
      await expect(headers.filter({ hasText: /name/i })).toBeVisible();
      await expect(headers.filter({ hasText: /workspace/i })).toBeVisible();
      await expect(headers.filter({ hasText: /status/i })).toBeVisible();
      await expect(headers.filter({ hasText: /versions/i })).toBeVisible();
      await expect(headers.filter({ hasText: /updated/i })).toBeVisible();

      // Admin can see known engines
      await engines.table.expectRowWithText(ENGINE_LLAMA);
      await engines.table.expectRowWithText(ENGINE_VLLM);
    },
  );

  test(
    "can sort by name",
    {
      tag: "@C2613059",
    },
    async ({ engines }) => {
      await engines.goToList();
      await engines.table.sort(/name/i);
    },
  );

  test(
    "clicking name navigates to detail page",
    {
      tag: "@C2613050",
    },
    async ({ engines }) => {
      await engines.goToList();
      await engines.table.clickRowLink(ENGINE_LLAMA);

      const showPage = engines.page.locator('[data-testid="show-page"]');
      await expect(showPage).toBeVisible();
      await expect(
        showPage.getByText(ENGINE_LLAMA, { exact: true }),
      ).toBeVisible();
    },
  );

  test(
    "clicking workspace navigates to workspace detail",
    {
      tag: "@C2613051",
    },
    async ({ engines }) => {
      await engines.goToList();

      const row = engines.table.rowWithText(ENGINE_LLAMA);
      await row.getByRole("link", { name: "default" }).click();

      // Should navigate to workspace show page
      const showPage = engines.page.locator('[data-testid="show-page"]');
      await expect(showPage).toBeVisible();
      await expect(
        showPage.getByText("default", { exact: true }),
      ).toBeVisible();
    },
  );

  test(
    "status column shows engine phase",
    {
      tag: "@C2613052",
    },
    async ({ engines }) => {
      await engines.goToList();
      await engines.table.waitForLoaded();
      await expect(engines.table.headerCell(/status/i)).toBeVisible();

      const row = engines.table.rowWithText(ENGINE_LLAMA);
      await expect(row.getByText("Created")).toBeVisible();
    },
  );

  test(
    "versions column shows engine versions",
    {
      tag: "@C2613053",
    },
    async ({ engines }) => {
      await engines.goToList();
      await engines.table.waitForLoaded();
      await expect(engines.table.headerCell(/versions/i)).toBeVisible();

      // vllm has multiple versions
      const row = engines.table.rowWithText(ENGINE_VLLM);
      await expect(row.getByText("v0.8.5")).toBeVisible();
    },
  );

  test(
    "can sort by updated time",
    {
      tag: "@C2613054",
    },
    async ({ engines }) => {
      await engines.goToList();
      await engines.table.sort(/updated/i);
    },
  );

  test(
    "can sort by created time",
    {
      tag: "@C2613055",
    },
    async ({ engines }) => {
      await engines.goToList();
      await engines.table.waitForLoaded();

      // Created At column may be hidden by default
      const createdHeader = engines.table.headerCell(/created/i);
      if (!(await createdHeader.isVisible().catch(() => false))) {
        await engines.table.toggleColumn(/created/i);
      }

      await engines.table.sort(/created/i);
    },
  );

  test(
    "can toggle column visibility",
    {
      tag: "@C2613056",
    },
    async ({ engines }) => {
      await engines.goToList();
      await engines.table.waitForLoaded();

      await engines.table.toggleColumn(/status/i);
      await expect(engines.table.headerCell(/status/i)).toBeHidden();

      await engines.table.toggleColumn(/status/i);
      await expect(engines.table.headerCell(/status/i)).toBeVisible();
    },
  );

  test(
    "no row actions on list page",
    {
      tag: "@C2613233",
    },
    async ({ engines }) => {
      await engines.goToList();
      await engines.table.waitForLoaded();

      const hasActions = await engines.table.hasRowActions(ENGINE_LLAMA);
      expect(hasActions).toBe(false);
    },
  );
});

test.describe("engines detail", () => {
  test(
    "detail page shows engine info with status and supported tasks",
    {
      tag: ["@C2613208", "@C2613209"],
    },
    async ({ engines }) => {
      await engines.goToShow(ENGINE_LLAMA);

      const showPage = engines.page.locator('[data-testid="show-page"]');

      // C2613208: name, workspace, status, supported tasks visible
      await expect(
        showPage.getByText(ENGINE_LLAMA, { exact: true }),
      ).toBeVisible();

      // Workspace
      const workspaceDt = showPage.locator("dt", { hasText: /workspace/i });
      await expect(workspaceDt).toBeVisible();
      const workspaceDd = workspaceDt.locator("~ dd").first();
      await expect(workspaceDd.getByRole("link")).toBeVisible();

      // Status
      const statusDt = showPage.locator("dt", { hasText: /^status$/i });
      await expect(statusDt).toBeVisible();

      // Supported Tasks
      const tasksDt = showPage.locator("dt", {
        hasText: /supported tasks/i,
      });
      await expect(tasksDt).toBeVisible();

      // C2613209: workspace link navigates to workspace detail
      await workspaceDd.getByRole("link").click();
      const wsShowPage = engines.page.locator('[data-testid="show-page"]');
      await expect(wsShowPage).toBeVisible();
      await expect(
        wsShowPage.getByText("default", { exact: true }),
      ).toBeVisible();
    },
  );

  test(
    "detail page shows values schema for engine version",
    {
      tag: "@C2613210",
    },
    async ({ engines }) => {
      await engines.goToShow(ENGINE_LLAMA);

      const showPage = engines.page.locator('[data-testid="show-page"]');

      // Version selector should be visible
      await expect(
        showPage.locator('button[role="combobox"]').first(),
      ).toBeVisible();

      // Values Schema section should be visible
      await expect(
        showPage.locator("dt", { hasText: /values schema/i }),
      ).toBeVisible();
    },
  );

  test(
    "can switch version in detail page",
    {
      tag: "@C2613211",
    },
    async ({ engines }) => {
      // vllm has multiple versions (v0.8.5, v0.11.2)
      await engines.goToShow(ENGINE_VLLM);

      const showPage = engines.page.locator('[data-testid="show-page"]');

      // Click the version selector
      const versionSelect = showPage.locator('button[role="combobox"]').first();
      await expect(versionSelect).toBeVisible();
      const currentVersion = await versionSelect.innerText();

      // Open and verify multiple options
      await versionSelect.click();
      const options = engines.page.getByRole("option");
      await expect(options.first()).toBeVisible();
      const count = await options.count();
      expect(count).toBeGreaterThanOrEqual(2);

      // Select a different version
      for (let i = 0; i < count; i++) {
        const text = await options.nth(i).innerText();
        if (text !== currentVersion) {
          await options.nth(i).click();
          break;
        }
      }

      // Values schema should still be visible after switch
      await expect(
        showPage.locator("dt", { hasText: /values schema/i }),
      ).toBeVisible();
    },
  );

  test(
    "no actions menu on detail page",
    {
      tag: ["@C2613214", "@C2613215"],
    },
    async ({ engines }) => {
      await engines.goToShow(ENGINE_LLAMA);

      // canEdit=false, canDelete=false → no actions trigger
      await expect(
        engines.page.locator('[data-testid="show-actions-trigger"]'),
      ).toBeHidden();
    },
  );
});

// ────────────────────────────────────────────────────────────
// Multi-user permission tests
// ────────────────────────────────────────────────────────────
test.describe("engines multi-user permissions", () => {
  test(
    "user with engine:read can see engines list",
    {
      tag: "@C2613205",
      annotation: {
        type: "slow",
        description: "creates test user with engine:read permission",
      },
    },
    async ({ createTestUser }, testInfo) => {
      testInfo.setTimeout(MULTI_USER_TIMEOUT);

      const testUser = await createTestUser(["engine:read"]);
      const enginesPage = new ResourcePage(testUser.page, {
        routeName: "engines",
        workspaced: true,
      });

      await enginesPage.goToList();

      // User with engine:read should see engine rows
      const rowCount = await enginesPage.table.rows().count();
      expect(rowCount).toBeGreaterThan(0);
    },
  );

  test(
    "user without engine:read sees empty engines list",
    {
      tag: "@C2613207",
      annotation: {
        type: "slow",
        description: "creates test user without engine:read permission",
      },
    },
    async ({ createTestUser }, testInfo) => {
      testInfo.setTimeout(MULTI_USER_TIMEOUT);

      // Give an unrelated permission so the user can log in
      const testUser = await createTestUser(["role:read"]);
      const enginesPage = new ResourcePage(testUser.page, {
        routeName: "engines",
        workspaced: true,
      });

      await testUser.page.goto("/#/default/engines");
      await enginesPage.table.waitForLoaded();

      // User without engine:read should see empty table
      await expect(
        testUser.page.locator('[data-testid="table-empty"]'),
      ).toBeVisible();
    },
  );
});
