import { expect, test } from "../fixtures/base";

test.describe("roles list", () => {
  test(
    "list page shows expected columns",
    {
      tag: "@C2611652",
    },
    async ({ roles }) => {
      await roles.goToList();
      await roles.table.waitForLoaded();

      const headers = roles.table.root.locator("thead th");
      await expect(headers.filter({ hasText: /name/i })).toBeVisible();
      await expect(headers.filter({ hasText: /permissions/i })).toBeVisible();
      await expect(headers.filter({ hasText: /updated/i })).toBeVisible();
    },
  );

  test(
    "admin user can see built-in roles",
    {
      tag: "@C2611683",
    },
    async ({ roles }) => {
      await roles.goToList();
      await roles.table.expectRowWithText("admin");
      await roles.table.expectRowWithText("workspace-user");
    },
  );

  test(
    "preset admin role has no action menu",
    {
      tag: "@C2611686",
    },
    async ({ roles }) => {
      await roles.goToList();
      const hasActions = await roles.table.hasRowActions("admin");
      expect(hasActions).toBe(false);
    },
  );

  test(
    "preset workspace-user role has no action menu",
    {
      tag: "@C2611687",
    },
    async ({ roles }) => {
      await roles.goToList();
      const hasActions = await roles.table.hasRowActions("workspace-user");
      expect(hasActions).toBe(false);
    },
  );

  test(
    "permissions column shows permission count",
    {
      tag: "@C2611667",
    },
    async ({ roles }) => {
      await roles.goToList();
      await roles.table.waitForLoaded();

      const adminRow = roles.table.rowWithText("admin");
      await expect(adminRow.getByText(/\d+ permissions/)).toBeVisible();
    },
  );

  test(
    "can sort by updated time",
    {
      tag: "@C2611668",
    },
    async ({ roles }) => {
      await roles.goToList();
      await roles.table.sort(/updated/i);
    },
  );

  test(
    "can sort by created time",
    {
      tag: "@C2611669",
    },
    async ({ roles }) => {
      await roles.goToList();
      await roles.table.waitForLoaded();

      // Created At column may be hidden by default
      const createdHeader = roles.table.headerCell(/created/i);
      if (!(await createdHeader.isVisible().catch(() => false))) {
        await roles.table.toggleColumn(/created/i);
      }

      await roles.table.sort(/created/i);
    },
  );

  test(
    "can toggle column visibility",
    {
      tag: "@C2611670",
    },
    async ({ roles }) => {
      await roles.goToList();
      await roles.table.waitForLoaded();

      await roles.table.toggleColumn(/updated/i);
      await expect(roles.table.headerCell(/updated/i)).toBeHidden();

      await roles.table.toggleColumn(/updated/i);
      await expect(roles.table.headerCell(/updated/i)).toBeVisible();
    },
  );
});

test.describe("roles detail", () => {
  test(
    "click role name navigates to detail page",
    {
      tag: "@C2611666",
    },
    async ({ roles }) => {
      await roles.goToList();
      await roles.table.clickRowLink("admin");

      await expect(
        roles.page.locator('[data-testid="show-page"]'),
      ).toBeVisible();
    },
  );

  test(
    "detail page shows role info and permissions",
    {
      tag: "@C2611779",
    },
    async ({ roles }) => {
      await roles.goToList();
      await roles.table.clickRowLink("admin");

      const showPage = roles.page.locator('[data-testid="show-page"]');
      await expect(showPage).toBeVisible();
      await expect(showPage.getByText("admin", { exact: true })).toBeVisible();
      await expect(
        showPage.locator('[data-testid="permissions-card"]'),
      ).toBeAttached();
    },
  );

  test(
    "preset role detail page has no edit or delete actions",
    {
      tag: "@C2611686",
    },
    async ({ roles }) => {
      await roles.goToList();
      await roles.table.clickRowLink("admin");

      await expect(
        roles.page.locator('[data-testid="show-page"]'),
      ).toBeVisible();
      await expect(
        roles.page.locator('[data-testid="show-actions-trigger"]'),
      ).toBeHidden();
    },
  );
});

test.describe("roles create", () => {
  test(
    "admin user can create a role with permissions",
    {
      tag: ["@C2611697", "@C2611664"],
    },
    async ({ roles }) => {
      const uniqueName = `test-role-${Date.now()}`;

      await roles.goToCreate();
      await roles.form.fillInput("metadata.name", uniqueName);
      await roles.form
        .field("spec.permissions")
        .getByText("Workspaces:Read")
        .click();
      await roles.form.submit();

      await roles.goToList();
      await roles.table.expectRowWithText(uniqueName);

      // Cleanup
      await roles.table.deleteRow(uniqueName);
    },
  );

  test(
    "cannot create role without name",
    {
      tag: "@C2611690",
    },
    async ({ roles }) => {
      await roles.goToCreate();
      await roles.form.submit();

      await expect(roles.page.locator('[data-testid="form"]')).toBeVisible();
    },
  );

  test(
    "cancel button returns to list",
    {
      tag: "@C2611665",
    },
    async ({ roles }) => {
      await roles.goToList();
      await roles.clickCreate();
      await roles.form.cancel();

      await roles.table.waitForLoaded();
    },
  );
});

test.describe("roles edit", () => {
  test(
    "can edit role from list action menu",
    {
      tag: ["@C2611706", "@C2611708"],
    },
    async ({ roles }) => {
      const uniqueName = `test-role-${Date.now()}`;

      // Setup
      await roles.goToCreate();
      await roles.form.fillInput("metadata.name", uniqueName);
      await roles.form
        .field("spec.permissions")
        .getByText("Workspaces:Read")
        .click();
      await roles.form.submit();
      await roles.goToList();
      await roles.table.expectRowWithText(uniqueName);

      // Edit from list
      await roles.table.editRow(uniqueName);
      await expect(roles.page.locator('[data-testid="form"]')).toBeVisible();

      const nameInput = roles.form.field("metadata.name").locator("input");
      await expect(nameInput).toBeDisabled();

      await roles.form.submit();

      // Cleanup
      await roles.goToList();
      await roles.table.deleteRow(uniqueName);
    },
  );

  test(
    "can edit role from detail page",
    {
      tag: "@C2611707",
    },
    async ({ roles }) => {
      const uniqueName = `test-role-${Date.now()}`;

      // Setup
      await roles.goToCreate();
      await roles.form.fillInput("metadata.name", uniqueName);
      await roles.form
        .field("spec.permissions")
        .getByText("Workspaces:Read")
        .click();
      await roles.form.submit();

      await roles.goToList();
      await roles.table.clickRowLink(uniqueName);
      await expect(
        roles.page.locator('[data-testid="show-page"]'),
      ).toBeVisible();

      // Edit from detail page
      await roles.showPageEdit();
      await roles.form.submit();

      // Cleanup
      await roles.goToList();
      await roles.table.deleteRow(uniqueName);
    },
  );
});

test.describe("roles delete", () => {
  test(
    "can delete role from list action menu",
    {
      tag: "@C2611721",
    },
    async ({ roles }) => {
      const uniqueName = `test-role-${Date.now()}`;

      // Setup
      await roles.goToCreate();
      await roles.form.fillInput("metadata.name", uniqueName);
      await roles.form
        .field("spec.permissions")
        .getByText("Workspaces:Read")
        .click();
      await roles.form.submit();
      await roles.goToList();
      await roles.table.expectRowWithText(uniqueName);

      // Delete from list
      await roles.table.deleteRow(uniqueName);
      await roles.table.expectNoRowWithText(uniqueName);
    },
  );

  test(
    "can delete role from detail page",
    {
      tag: "@C2611722",
    },
    async ({ roles }) => {
      const uniqueName = `test-role-${Date.now()}`;

      // Setup
      await roles.goToCreate();
      await roles.form.fillInput("metadata.name", uniqueName);
      await roles.form
        .field("spec.permissions")
        .getByText("Workspaces:Read")
        .click();
      await roles.form.submit();

      await roles.goToList();
      await roles.table.clickRowLink(uniqueName);
      await expect(
        roles.page.locator('[data-testid="show-page"]'),
      ).toBeVisible();

      // Delete from detail page
      await roles.showPageDelete(uniqueName);
    },
  );
});
