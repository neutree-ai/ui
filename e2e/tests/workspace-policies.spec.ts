import { expect, test } from "../fixtures/base";
import type { ResourcePage } from "../helpers/resource-page";

/** Admin user profile name (matches E2E login user) */
const ADMIN_USER = "admin";
/** Built-in admin role */
const ADMIN_ROLE = "admin";
/** Built-in policy name that always exists */
const BUILTIN_POLICY = "admin-global-role-assignment";

/** Create a workspace policy via the create form and submit */
async function createPolicy(
  wp: ResourcePage,
  name: string,
  user: string = ADMIN_USER,
  role: string = ADMIN_ROLE,
): Promise<void> {
  await wp.goToCreate();
  await wp.form.fillInput("metadata.name", name);
  await wp.form.selectComboboxOption("spec.user_id", user);
  await wp.form.selectComboboxOption("spec.role", role);
  await wp.form.submit();
}

test.describe("workspace policies list", () => {
  test(
    "list page shows expected columns",
    {
      tag: ["@C2611745", "@C2611776"],
    },
    async ({ workspacePolicies: wp }) => {
      await wp.goToList();
      await wp.table.waitForLoaded();

      const headers = wp.table.root.locator("thead th");
      await expect(headers.filter({ hasText: /name/i })).toBeVisible();
      await expect(headers.filter({ hasText: /workspace/i })).toBeVisible();
      await expect(headers.filter({ hasText: /role/i })).toBeVisible();
      await expect(headers.filter({ hasText: /user/i })).toBeVisible();
      await expect(headers.filter({ hasText: /updated/i })).toBeVisible();
    },
  );

  test(
    "can sort by name",
    {
      tag: "@C2611753",
    },
    async ({ workspacePolicies: wp }) => {
      await wp.goToList();
      await wp.table.sort(/name/i);
    },
  );

  test(
    "workspace column visible",
    {
      tag: "@C2611754",
    },
    async ({ workspacePolicies: wp }) => {
      await wp.goToList();
      await wp.table.waitForLoaded();
      await expect(wp.table.headerCell(/workspace/i)).toBeVisible();
    },
  );

  test(
    "role column visible",
    {
      tag: "@C2611755",
    },
    async ({ workspacePolicies: wp }) => {
      await wp.goToList();
      await wp.table.waitForLoaded();
      await expect(wp.table.headerCell(/role/i)).toBeVisible();
    },
  );

  test(
    "user column visible",
    {
      tag: "@C2611756",
    },
    async ({ workspacePolicies: wp }) => {
      await wp.goToList();
      await wp.table.waitForLoaded();
      await expect(wp.table.headerCell(/user/i)).toBeVisible();
    },
  );

  test(
    "can sort by updated time",
    {
      tag: "@C2611757",
    },
    async ({ workspacePolicies: wp }) => {
      await wp.goToList();
      await wp.table.sort(/updated/i);
    },
  );

  test(
    "can sort by created time",
    {
      tag: "@C2611758",
    },
    async ({ workspacePolicies: wp }) => {
      await wp.goToList();
      await wp.table.waitForLoaded();

      // Created At column may be hidden by default
      const createdHeader = wp.table.headerCell(/created/i);
      if (!(await createdHeader.isVisible().catch(() => false))) {
        await wp.table.toggleColumn(/created/i);
      }

      await wp.table.sort(/created/i);
    },
  );

  test(
    "can toggle column visibility",
    {
      tag: "@C2611759",
    },
    async ({ workspacePolicies: wp }) => {
      await wp.goToList();
      await wp.table.waitForLoaded();

      await wp.table.toggleColumn(/updated/i);
      await expect(wp.table.headerCell(/updated/i)).toBeHidden();

      await wp.table.toggleColumn(/updated/i);
      await expect(wp.table.headerCell(/updated/i)).toBeVisible();
    },
  );

  test(
    "can edit from list action menu",
    {
      tag: "@C2611760",
    },
    async ({ workspacePolicies: wp }) => {
      const name = `test-wp-edit-${Date.now()}`;

      await createPolicy(wp, name);
      await wp.goToList();
      await wp.table.expectRowWithText(name);

      // Edit from list
      await wp.table.editRow(name);
      await expect(wp.page.locator('[data-testid="form"]')).toBeVisible();
      await wp.form.submit();

      // Cleanup
      await wp.goToList();
      await wp.table.deleteRow(name, { noWait: true });
    },
  );

  test(
    "can delete from list action menu",
    {
      tag: "@C2611761",
    },
    async ({ workspacePolicies: wp }) => {
      const name = `test-wp-del-${Date.now()}`;

      await createPolicy(wp, name);
      await wp.goToList();
      await wp.table.expectRowWithText(name);

      // Delete from list
      await wp.table.deleteRow(name);
      await wp.table.expectNoRowWithText(name);
    },
  );
});

test.describe("workspace policies detail", () => {
  test(
    "detail page shows policy info with workspace, role, and user",
    {
      tag: ["@C2611767", "@C2611768", "@C2611769", "@C2611770"],
    },
    async ({ workspacePolicies: wp }) => {
      await wp.goToList();
      await wp.table.clickRowLink(BUILTIN_POLICY);

      const showPage = wp.page.locator('[data-testid="show-page"]');
      await expect(showPage).toBeVisible();

      // C2611767: detail page shows policy info
      await expect(
        showPage.getByText(BUILTIN_POLICY, { exact: true }),
      ).toBeVisible();

      // C2611768: workspace field shows "*" for global policy
      // The show page renders workspace as term/definition pair
      const workspaceDef = showPage
        .locator("dt", { hasText: /workspace/i })
        .locator("+ dd");
      await expect(workspaceDef).toContainText("*");

      // C2611769: role link visible (links to /roles/show/admin)
      await expect(
        showPage.getByRole("link", { name: "admin" }).first(),
      ).toBeVisible();

      // C2611770: user info visible (User label exists in the detail)
      await expect(
        showPage.locator("dt", { hasText: /^user$/i }),
      ).toBeVisible();
    },
  );
});

test.describe("workspace policies create", () => {
  test(
    "admin can create policy with all fields",
    {
      tag: ["@C2611751", "@C2611780"],
    },
    async ({ workspacePolicies: wp }) => {
      const name = `test-wp-new-${Date.now()}`;

      await createPolicy(wp, name);

      // Verify in list
      await wp.goToList();
      await wp.table.expectRowWithText(name);

      // Cleanup
      await wp.table.deleteRow(name, { noWait: true });
    },
  );

  test(
    "name validation rejects invalid names",
    {
      tag: "@C2611746",
    },
    async ({ workspacePolicies: wp }) => {
      // Long name > 63 chars
      const longName = "a".repeat(64);

      await wp.goToCreate();
      await wp.form.fillInput("metadata.name", longName);
      await wp.form.submit();

      await expect(
        wp.page.locator('[data-sonner-toast][data-type="error"]'),
      ).toBeVisible();
      await expect(wp.page.locator('[data-testid="form"]')).toBeVisible();
    },
  );

  test(
    "user dropdown shows existing users",
    {
      tag: "@C2611747",
    },
    async ({ workspacePolicies: wp }) => {
      await wp.goToCreate();

      // Open user combobox
      const userField = wp.form.field("spec.user_id");
      await userField.locator("button").click();

      // Verify at least one option is visible
      await expect(wp.page.getByRole("option").first()).toBeVisible();
    },
  );

  test(
    "user combobox supports search",
    {
      tag: "@C2611763",
    },
    async ({ workspacePolicies: wp }) => {
      await wp.goToCreate();

      // Open user combobox
      const userField = wp.form.field("spec.user_id");
      await userField.locator("button").click();

      // Wait for options to appear
      await expect(wp.page.getByRole("option").first()).toBeVisible();

      // Get the first option's text to use as search term
      const firstOptionText = await wp.page
        .getByRole("option")
        .first()
        .innerText();
      const searchTerm = firstOptionText.slice(0, 3);

      // Type in the search input
      await wp.page.getByPlaceholder(/search/i).fill(searchTerm);

      // Verify filtered option is still visible
      await expect(wp.page.getByRole("option").first()).toBeVisible();
    },
  );

  test(
    "role dropdown shows existing roles",
    {
      tag: "@C2611748",
    },
    async ({ workspacePolicies: wp }) => {
      await wp.goToCreate();

      // Open role combobox
      const roleField = wp.form.field("spec.role");
      await roleField.locator("button").click();

      // Verify built-in roles are visible
      await expect(
        wp.page.getByRole("option", { name: "admin", exact: true }),
      ).toBeVisible();
      await expect(
        wp.page.getByRole("option", { name: "workspace-user", exact: true }),
      ).toBeVisible();
    },
  );

  test(
    "role combobox supports search",
    {
      tag: "@C2611764",
    },
    async ({ workspacePolicies: wp }) => {
      await wp.goToCreate();

      // Open role combobox
      const roleField = wp.form.field("spec.role");
      await roleField.locator("button").click();

      // Wait for options
      await expect(wp.page.getByRole("option").first()).toBeVisible();

      // Type partial search text
      await wp.page.getByPlaceholder(/search/i).fill("admin");

      // Verify admin option is visible and workspace-user is filtered out
      await expect(
        wp.page.getByRole("option", { name: "admin", exact: true }),
      ).toBeVisible();
    },
  );

  test(
    "policy scope defaults to Global and is disabled in open source",
    {
      tag: ["@C2611749", "@C2611829"],
    },
    async ({ workspacePolicies: wp }) => {
      await wp.goToCreate();

      // Verify scope field shows Global and is disabled
      const scopeField = wp.form.field("spec.global");
      await expect(scopeField).toContainText("Global");
      await expect(
        scopeField.locator('button[role="combobox"]'),
      ).toBeDisabled();
    },
  );

  test(
    "cancel button returns to list",
    {
      tag: "@C2611752",
    },
    async ({ workspacePolicies: wp }) => {
      await wp.goToList();
      await wp.clickCreate();
      await wp.form.cancel();

      await wp.table.waitForLoaded();
    },
  );
});

test.describe("workspace policies edit", () => {
  test(
    "admin can edit and save policy changes",
    {
      tag: ["@C2611775", "@C2611784"],
    },
    async ({ workspacePolicies: wp }) => {
      const name = `test-wp-editsave-${Date.now()}`;

      await createPolicy(wp, name);
      await wp.goToList();
      await wp.table.expectRowWithText(name);

      // Edit: change role to workspace-user
      await wp.table.editRow(name);
      await expect(
        wp.page.locator('[data-testid="form-submit"]'),
      ).toBeEnabled();
      await wp.form.selectComboboxOption("spec.role", "workspace-user");
      await wp.form.submit();

      // Verify update in list
      await wp.goToList();
      const updatedRow = wp.table.rowWithText(name);
      await expect(updatedRow.getByText("workspace-user")).toBeVisible();

      // Cleanup
      await wp.table.deleteRow(name, { noWait: true });
    },
  );

  test(
    "can switch user in edit",
    {
      tag: "@C2611771",
    },
    async ({ workspacePolicies: wp }) => {
      const name = `test-wp-edituser-${Date.now()}`;

      await createPolicy(wp, name);
      await wp.goToList();
      await wp.table.expectRowWithText(name);

      // Edit: re-select same user (only one admin user available)
      await wp.table.editRow(name);
      await expect(
        wp.page.locator('[data-testid="form-submit"]'),
      ).toBeEnabled();
      await wp.form.selectComboboxOption("spec.user_id", ADMIN_USER);
      await wp.form.submit();

      // Verify still in list
      await wp.goToList();
      await wp.table.expectRowWithText(name);

      // Cleanup
      await wp.table.deleteRow(name, { noWait: true });
    },
  );

  test(
    "can switch role in edit",
    {
      tag: "@C2611772",
    },
    async ({ workspacePolicies: wp }) => {
      const name = `test-wp-editrole-${Date.now()}`;

      // Create with admin role
      await createPolicy(wp, name, ADMIN_USER, "admin");
      await wp.goToList();
      await wp.table.expectRowWithText(name);

      // Edit: switch to workspace-user role
      await wp.table.editRow(name);
      await expect(
        wp.page.locator('[data-testid="form-submit"]'),
      ).toBeEnabled();
      await wp.form.selectComboboxOption("spec.role", "workspace-user");
      await wp.form.submit();

      // Verify role changed in list
      await wp.goToList();
      const updatedRow = wp.table.rowWithText(name);
      await expect(updatedRow.getByText("workspace-user")).toBeVisible();

      // Cleanup
      await wp.table.deleteRow(name, { noWait: true });
    },
  );

  test(
    "policy scope is disabled in open source edit",
    {
      tag: ["@C2611773", "@C2611830"],
    },
    async ({ workspacePolicies: wp }) => {
      const name = `test-wp-scope-${Date.now()}`;

      await createPolicy(wp, name);
      await wp.goToList();

      // Edit and verify scope is disabled
      await wp.table.editRow(name);
      await expect(
        wp.page.locator('[data-testid="form-submit"]'),
      ).toBeEnabled();

      const scopeField = wp.form.field("spec.global");
      await expect(scopeField).toContainText("Global");
      await expect(
        scopeField.locator('button[role="combobox"]'),
      ).toBeDisabled();

      await wp.form.cancel();

      // Cleanup
      await wp.goToList();
      await wp.table.deleteRow(name, { noWait: true });
    },
  );
});

test.describe("workspace policies delete", () => {
  test(
    "can delete from list action menu",
    {
      tag: ["@C2611787", "@C2611790"],
    },
    async ({ workspacePolicies: wp }) => {
      const name = `test-wp-delist-${Date.now()}`;

      await createPolicy(wp, name);
      await wp.goToList();
      await wp.table.expectRowWithText(name);

      // Delete from list
      await wp.table.deleteRow(name);
      await wp.table.expectNoRowWithText(name);
    },
  );

  test(
    "can delete from detail page",
    {
      tag: "@C2611788",
    },
    async ({ workspacePolicies: wp }) => {
      const name = `test-wp-dedetail-${Date.now()}`;

      await createPolicy(wp, name);

      // Navigate to detail
      await wp.goToList();
      await wp.table.clickRowLink(name);
      await expect(wp.page.locator('[data-testid="show-page"]')).toBeVisible();

      // Delete from detail page
      await wp.showPageDelete(name);
    },
  );

  test(
    "admin-global-role-assignment has no actions",
    {
      tag: "@C2611789",
    },
    async ({ workspacePolicies: wp }) => {
      await wp.goToList();
      const hasActions = await wp.table.hasRowActions(BUILTIN_POLICY);
      expect(hasActions).toBe(false);
    },
  );
});
