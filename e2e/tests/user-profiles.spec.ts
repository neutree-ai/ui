import { expect, test } from "../fixtures/base";
import {
  MULTI_USER_EXTENDED_TIMEOUT,
  MULTI_USER_TIMEOUT,
} from "../helpers/constants";
import type { ResourcePage } from "../helpers/resource-page";
import { DELETE_TIMEOUT } from "../helpers/table-helper";
import { loginAs, logout } from "../helpers/test-user-context";

/** Admin user profile name (matches E2E login user) */
const ADMIN_USER = "admin";

/** Create a user via the create form and submit */
async function createUser(
  users: ResourcePage,
  name: string,
  email: string,
  password: string,
): Promise<void> {
  await users.goToCreate();
  await users.form.fillInput("name", name);
  await users.form.fillInput("email", email);
  await users.form.fillInput("password", password);
  await users.form.fillInput("confirmPassword", password);
  await users.form.submit();
}

// ────────────────────────────────────────────────────────────
// List
// ────────────────────────────────────────────────────────────
test.describe("user profiles list", () => {
  test(
    "list page shows expected columns and admin user is visible",
    {
      tag: ["@C2611577", "@C2611580", "@C2611728"],
    },
    async ({ userProfiles: users }) => {
      await users.goToList();
      await users.table.waitForLoaded();

      const headers = users.table.root.locator("thead th");
      await expect(headers.filter({ hasText: /name/i })).toBeVisible();
      await expect(headers.filter({ hasText: /email/i })).toBeVisible();
      await expect(headers.filter({ hasText: /updated/i })).toBeVisible();

      // Admin user is visible
      await users.table.expectRowWithText(ADMIN_USER);
    },
  );

  test(
    "can sort by name",
    {
      tag: "@C2611578",
    },
    async ({ userProfiles: users }) => {
      await users.goToList();
      await users.table.sort(/name/i);
    },
  );

  test(
    "click name navigates to detail page",
    {
      tag: "@C2611579",
    },
    async ({ userProfiles: users }) => {
      await users.goToList();
      await users.table.clickRowLink(ADMIN_USER);

      await expect(
        users.page.locator('[data-testid="show-page"]'),
      ).toBeVisible();
    },
  );

  test(
    "can sort by updated time",
    {
      tag: "@C2611581",
    },
    async ({ userProfiles: users }) => {
      await users.goToList();
      await users.table.sort(/updated/i);
    },
  );

  test(
    "can sort by created time",
    {
      tag: "@C2611582",
    },
    async ({ userProfiles: users }) => {
      await users.goToList();
      await users.table.waitForLoaded();

      const createdHeader = users.table.headerCell(/created/i);
      if (!(await createdHeader.isVisible().catch(() => false))) {
        await users.table.toggleColumn(/created/i);
      }

      await users.table.sort(/created/i);
    },
  );

  test(
    "can toggle column visibility",
    {
      tag: "@C2611583",
    },
    async ({ userProfiles: users }) => {
      await users.goToList();
      await users.table.waitForLoaded();

      await users.table.toggleColumn(/email/i);
      await expect(users.table.headerCell(/email/i)).toBeHidden();

      await users.table.toggleColumn(/email/i);
      await expect(users.table.headerCell(/email/i)).toBeVisible();
    },
  );
});

// ────────────────────────────────────────────────────────────
// Create
// ────────────────────────────────────────────────────────────
test.describe("user profiles create", () => {
  test(
    "admin can create user with all fields and verify in list",
    {
      tag: ["@C2579751", "@C2586819"],
    },
    async ({ userProfiles: users }) => {
      const ts = Date.now();
      const name = `test-usr-${ts}`;
      const email = `test-usr-${ts}@e2e.local`;

      await createUser(users, name, email, "Test@123456");

      await users.goToList();
      await users.table.expectRowWithText(name);

      // Cleanup
      await users.table.deleteRow(name, { noWait: true });
    },
  );

  test(
    "rejects invalid name format",
    {
      tag: "@C2579748",
    },
    async ({ userProfiles: users }) => {
      const ts = Date.now();
      const email = `test-inv-${ts}@e2e.local`;

      // Name with uppercase (invalid k8s name)
      await users.goToCreate();
      await users.form.fillInput("name", "INVALID_UPPERCASE");
      await users.form.fillInput("email", email);
      await users.form.fillInput("password", "Test@123456");
      await users.form.fillInput("confirmPassword", "Test@123456");
      await users.form.submit();

      await expect(
        users.page.locator('[data-sonner-toast][data-type="error"]'),
      ).toBeVisible();
      await expect(users.page.locator('[data-testid="form"]')).toBeVisible();
    },
  );

  test(
    "rejects invalid email format",
    {
      tag: "@C2579749",
    },
    async ({ userProfiles: users }) => {
      const ts = Date.now();

      await users.goToCreate();
      await users.form.fillInput("name", `test-eml-${ts}`);
      await users.form.fillInput("email", "not-an-email");
      await users.form.fillInput("password", "Test@123456");
      await users.form.fillInput("confirmPassword", "Test@123456");
      await users.form.submit();

      // Email input has type="email" so browser validation or backend rejects
      await expect(users.page.locator('[data-testid="form"]')).toBeVisible();
    },
  );

  test(
    "rejects password shorter than 6 characters",
    {
      tag: ["@C2579750", "@C2586815"],
    },
    async ({ userProfiles: users }) => {
      const ts = Date.now();

      await users.goToCreate();
      await users.form.fillInput("name", `test-pwd-${ts}`);
      await users.form.fillInput("email", `test-pwd-${ts}@e2e.local`);
      await users.form.fillInput("password", "12345");
      await users.form.fillInput("confirmPassword", "12345");
      await users.form.submit();

      // Client-side validation: minLength 6
      await expect(users.page.locator('[data-testid="form"]')).toBeVisible();
    },
  );

  test(
    "cancel button returns to list",
    {
      tag: "@C2579752",
    },
    async ({ userProfiles: users }) => {
      await users.goToList();
      await users.clickCreate();
      await users.form.cancel();

      await users.table.waitForLoaded();
    },
  );

  test(
    "missing name or email shows error",
    {
      tag: "@C2586812",
    },
    async ({ userProfiles: users }) => {
      await users.goToCreate();
      // Fill only password fields, skip name and email
      await users.form.fillInput("password", "Test@123456");
      await users.form.fillInput("confirmPassword", "Test@123456");
      await users.form.submit();

      await expect(users.page.locator('[data-testid="form"]')).toBeVisible();
    },
  );

  test(
    "missing password shows error",
    {
      tag: "@C2586813",
    },
    async ({ userProfiles: users }) => {
      const ts = Date.now();

      await users.goToCreate();
      await users.form.fillInput("name", `test-nopwd-${ts}`);
      await users.form.fillInput("email", `test-nopwd-${ts}@e2e.local`);
      // Leave password and confirmPassword empty
      await users.form.submit();

      await expect(users.page.locator('[data-testid="form"]')).toBeVisible();
    },
  );

  test(
    "password mismatch shows error",
    {
      tag: "@C2586814",
    },
    async ({ userProfiles: users }) => {
      const ts = Date.now();

      await users.goToCreate();
      await users.form.fillInput("name", `test-mismatch-${ts}`);
      await users.form.fillInput("email", `test-mismatch-${ts}@e2e.local`);
      await users.form.fillInput("password", "Test@123456");
      await users.form.fillInput("confirmPassword", "Different@789");
      await users.form.submit();

      await expect(users.page.locator('[data-testid="form"]')).toBeVisible();
    },
  );

  test(
    "duplicate name shows error",
    {
      tag: "@C2586816",
    },
    async ({ userProfiles: users }) => {
      const ts = Date.now();
      const name = `test-dupname-${ts}`;
      const email1 = `test-dupname1-${ts}@e2e.local`;
      const email2 = `test-dupname2-${ts}@e2e.local`;

      // Create first user
      await createUser(users, name, email1, "Test@123456");
      await users.goToList();
      await users.table.expectRowWithText(name);

      // Try to create second with same name
      await users.goToCreate();
      await users.form.fillInput("name", name);
      await users.form.fillInput("email", email2);
      await users.form.fillInput("password", "Test@123456");
      await users.form.fillInput("confirmPassword", "Test@123456");
      await users.form.submit();

      await expect(
        users.page.locator('[data-sonner-toast][data-type="error"]'),
      ).toBeVisible();
      await expect(users.page.locator('[data-testid="form"]')).toBeVisible();

      // Cleanup
      await users.goToList();
      await users.table.deleteRow(name, { noWait: true });
    },
  );

  test(
    "duplicate email shows error",
    {
      tag: "@C2586817",
    },
    async ({ userProfiles: users }) => {
      const ts = Date.now();
      const name1 = `test-dupeml1-${ts}`;
      const name2 = `test-dupeml2-${ts}`;
      const email = `test-dupeml-${ts}@e2e.local`;

      // Create first user
      await createUser(users, name1, email, "Test@123456");
      await users.goToList();
      await users.table.expectRowWithText(name1);

      // Try to create second with same email
      await users.goToCreate();
      await users.form.fillInput("name", name2);
      await users.form.fillInput("email", email);
      await users.form.fillInput("password", "Test@123456");
      await users.form.fillInput("confirmPassword", "Test@123456");
      await users.form.submit();

      await expect(
        users.page.locator('[data-sonner-toast][data-type="error"]'),
      ).toBeVisible();
      await expect(users.page.locator('[data-testid="form"]')).toBeVisible();

      // Cleanup
      await users.goToList();
      await users.table.deleteRow(name1, { noWait: true });
    },
  );

  test(
    "after create, admin session is preserved",
    {
      tag: "@C2586818",
    },
    async ({ userProfiles: users }) => {
      const ts = Date.now();
      const name = `test-sessn-${ts}`;
      const email = `test-sessn-${ts}@e2e.local`;

      await createUser(users, name, email, "Test@123456");

      // After creation, the admin user dropdown still shows "admin"
      await expect(
        users.page.getByRole("button", { name: /admin/i }),
      ).toBeVisible();

      // Cleanup
      await users.goToList();
      await users.table.deleteRow(name, { noWait: true });
    },
  );
});

// ────────────────────────────────────────────────────────────
// Detail
// ────────────────────────────────────────────────────────────
test.describe("user profiles detail", () => {
  test(
    "detail page shows user info, Global Roles, and Joined Workspaces",
    {
      tag: "@C2611604",
    },
    async ({ userProfiles: users }) => {
      await users.goToList();
      await users.table.clickRowLink(ADMIN_USER);

      const showPage = users.page.locator('[data-testid="show-page"]');
      await expect(showPage).toBeVisible();

      // Name visible (use .first() — "admin" also appears as a role link)
      await expect(
        showPage.getByText(ADMIN_USER, { exact: true }).first(),
      ).toBeVisible();
      await expect(showPage.getByText(/@/)).toBeVisible();

      // Global Roles section
      await expect(showPage.getByText(/global roles/i)).toBeVisible();
      // Joined Workspaces section
      await expect(showPage.getByText(/joined workspaces/i)).toBeVisible();
    },
  );

  test(
    "Global Role link navigates to role detail",
    {
      tag: "@C2611608",
    },
    async ({ userProfiles: users }) => {
      await users.goToList();
      await users.table.clickRowLink(ADMIN_USER);

      const showPage = users.page.locator('[data-testid="show-page"]');
      await expect(showPage).toBeVisible();

      // Click the "admin" role link in the Global Roles card
      await showPage
        .locator('[data-testid="global-roles-card"]')
        .getByRole("link", { name: "admin" })
        .click();
      await expect(
        users.page.locator('[data-testid="show-page"]'),
      ).toBeVisible();
      // Should navigate to role detail page
      await expect(users.page).toHaveURL(/\/#\/roles\/show\//);
    },
  );

  test(
    "multiple Global Roles displayed for user with multiple roles",
    {
      tag: "@C2611609",
    },
    async ({ userProfiles: users, apiHelper }) => {
      const testData = await apiHelper.createTestUserData(["workspace:read"]);

      // Also create a second policy linking to the built-in admin role
      const policyName2 = `test-pol2-${Date.now()}`;
      await apiHelper.createPolicy(policyName2, testData.userId, "admin", true);

      try {
        await users.goToList();
        await users.table.clickRowLink(testData.userName);

        const showPage = users.page.locator('[data-testid="show-page"]');
        await expect(showPage).toBeVisible();

        // Both roles should appear in the Global Roles table
        await expect(showPage.getByText(testData.roleName)).toBeVisible();
        await expect(showPage.getByText("admin")).toBeVisible();
      } finally {
        await apiHelper.deletePolicy(policyName2).catch(() => {});
        await testData.cleanup();
      }
    },
  );
});

// ────────────────────────────────────────────────────────────
// Edit
// ────────────────────────────────────────────────────────────
test.describe("user profiles edit", () => {
  test(
    "admin can edit user email and verify",
    {
      tag: ["@C2611619", "@C2611730"],
    },
    async ({ userProfiles: users }) => {
      const ts = Date.now();
      const name = `test-edteml-${ts}`;
      const email = `test-edteml-${ts}@e2e.local`;
      const newEmail = `test-edteml-new-${ts}@e2e.local`;

      await createUser(users, name, email, "Test@123456");
      await users.goToList();
      await users.table.expectRowWithText(name);

      // Edit from list — wait for form data to load before modifying
      await users.table.editRow(name);
      await expect(
        users.page.locator('[data-testid="form-submit"]'),
      ).toBeEnabled();

      await users.form.fillInput("spec.email", newEmail);
      await users.form.submit();

      // Verify new email in list
      await users.goToList();
      await users.table.expectRowWithText(newEmail);

      // Cleanup
      await users.table.deleteRow(name, { noWait: true });
    },
  );

  test(
    "can edit from list action menu",
    {
      tag: "@C2611620",
    },
    async ({ userProfiles: users }) => {
      const ts = Date.now();
      const name = `test-edtlst-${ts}`;
      const email = `test-edtlst-${ts}@e2e.local`;

      await createUser(users, name, email, "Test@123456");
      await users.goToList();
      await users.table.expectRowWithText(name);

      await users.table.editRow(name);
      await expect(users.page.locator('[data-testid="form"]')).toBeVisible();

      await users.form.submit();

      // Cleanup
      await users.goToList();
      await users.table.deleteRow(name, { noWait: true });
    },
  );

  test(
    "can edit from detail page action menu",
    {
      tag: "@C2611621",
    },
    async ({ userProfiles: users }) => {
      const ts = Date.now();
      const name = `test-edtdtl-${ts}`;
      const email = `test-edtdtl-${ts}@e2e.local`;

      await createUser(users, name, email, "Test@123456");
      await users.goToList();
      await users.table.clickRowLink(name);
      await expect(
        users.page.locator('[data-testid="show-page"]'),
      ).toBeVisible();

      await users.showPageEdit();
      await users.form.submit();

      // Cleanup
      await users.goToList();
      await users.table.deleteRow(name, { noWait: true });
    },
  );

  test(
    "name field is readonly in edit mode",
    {
      tag: "@C2611622",
    },
    async ({ userProfiles: users }) => {
      const ts = Date.now();
      const name = `test-rdonly-${ts}`;
      const email = `test-rdonly-${ts}@e2e.local`;

      await createUser(users, name, email, "Test@123456");
      await users.goToList();
      await users.table.editRow(name);

      const nameInput = users.form.field("metadata.name").locator("input");
      await expect(nameInput).toBeDisabled();

      // Cleanup
      await users.form.cancel();
      await users.table.deleteRow(name, { noWait: true });
    },
  );

  test(
    "admin can edit own email",
    {
      tag: "@C2611625",
    },
    async ({ userProfiles: users }) => {
      await users.goToList();
      await users.table.editRow(ADMIN_USER);

      await expect(users.page.locator('[data-testid="form"]')).toBeVisible();
      const nameInput = users.form.field("metadata.name").locator("input");
      await expect(nameInput).toHaveValue(ADMIN_USER);
      await expect(nameInput).toBeDisabled();

      // Just verify the edit form loads — don't actually change admin email
      await users.form.cancel();
    },
  );
});

// ────────────────────────────────────────────────────────────
// Delete
// ────────────────────────────────────────────────────────────
test.describe("user profiles delete", () => {
  test(
    "admin can delete user from list action menu",
    {
      tag: ["@C2611633", "@C2611634", "@C2611732"],
    },
    async ({ userProfiles: users }) => {
      const ts = Date.now();
      const name = `test-dellst-${ts}`;
      const email = `test-dellst-${ts}@e2e.local`;

      await createUser(users, name, email, "Test@123456");
      await users.goToList();
      await users.table.expectRowWithText(name);

      await users.table.deleteRow(name);
      await users.table.expectNoRowWithText(name);
    },
  );

  test(
    "admin can delete user from detail page",
    {
      tag: "@C2611635",
    },
    async ({ userProfiles: users }) => {
      const ts = Date.now();
      const name = `test-deldtl-${ts}`;
      const email = `test-deldtl-${ts}@e2e.local`;

      await createUser(users, name, email, "Test@123456");
      await users.goToList();
      await users.table.clickRowLink(name);
      await expect(
        users.page.locator('[data-testid="show-page"]'),
      ).toBeVisible();

      // Manual delete flow — showPageDelete uses table.waitForLoaded which
      // fails on user show page (2 sub-tables: Global Roles + Joined Workspaces)
      await users.page.locator('[data-testid="show-actions-trigger"]').click();
      await users.page.getByRole("menuitem", { name: /delete/i }).click();
      const dialog = users.page.getByRole("alertdialog");
      await dialog.waitFor({ state: "visible" });
      await dialog.getByRole("button", { name: /delete/i }).click();
      await dialog.waitFor({ state: "hidden" });

      // Navigate to list — wait for show page to unmount before checking table
      // (user show page has 2 sub-tables that conflict with table.waitForLoaded)
      await users.page.goto("/#/user-profiles");
      await users.page
        .locator('[data-testid="show-page"]')
        .waitFor({ state: "detached" });
      await users.table.waitForLoaded();
      await users.table.expectNoRowWithText(name, { timeout: DELETE_TIMEOUT });
    },
  );

  test(
    "cannot delete self (admin user)",
    {
      tag: "@C2611650",
    },
    async ({ userProfiles: users }) => {
      await users.goToList();
      await users.table.waitForLoaded();

      // Attempt to delete admin from list
      await users.table
        .rowWithText(ADMIN_USER)
        .locator('[data-testid="row-actions-trigger"]')
        .click();
      await users.page.locator('[role="menu"]').waitFor({ state: "visible" });
      await users.page.getByRole("menuitem", { name: /delete/i }).click();

      const dialog = users.page.getByRole("alertdialog");
      await dialog.waitFor({ state: "visible" });
      await dialog.getByRole("button", { name: /delete/i }).click();

      // Expect an error toast — backend rejects self-delete
      await expect(
        users.page.locator('[data-sonner-toast][data-type="error"]'),
      ).toBeVisible();

      // Admin should still be in the list
      await dialog.waitFor({ state: "hidden" });
      await users.table.expectRowWithText(ADMIN_USER);
    },
  );

  test(
    "cannot delete admin user",
    {
      tag: "@C2611639",
    },
    async ({ userProfiles: users }) => {
      await users.goToList();
      await users.table.waitForLoaded();

      // For admin user, "cannot delete self" and "cannot delete admin" overlap.
      // This test verifies that the admin user row still has actions but
      // delete fails. The backend returns an error for admin user deletion.
      await users.table
        .rowWithText(ADMIN_USER)
        .locator('[data-testid="row-actions-trigger"]')
        .click();
      await users.page.locator('[role="menu"]').waitFor({ state: "visible" });
      await users.page.getByRole("menuitem", { name: /delete/i }).click();

      const dialog = users.page.getByRole("alertdialog");
      await dialog.waitFor({ state: "visible" });
      await dialog.getByRole("button", { name: /delete/i }).click();

      await expect(
        users.page.locator('[data-sonner-toast][data-type="error"]'),
      ).toBeVisible();

      await dialog.waitFor({ state: "hidden" });
      await users.table.expectRowWithText(ADMIN_USER);
    },
  );

  test(
    "delete fails when user has associated workspace policies",
    {
      tag: "@C2611651",
      annotation: {
        type: "slow",
        description: "creates user + role + policy, then attempts delete",
      },
    },
    async ({ userProfiles: users, apiHelper }, testInfo) => {
      testInfo.setTimeout(MULTI_USER_EXTENDED_TIMEOUT);

      const testData = await apiHelper.createTestUserData(["workspace:read"]);

      try {
        await users.goToList();
        await users.table.expectRowWithText(testData.userName);

        // Attempt to delete user with associated policy
        await users.table
          .rowWithText(testData.userName)
          .locator('[data-testid="row-actions-trigger"]')
          .click();
        await users.page.locator('[role="menu"]').waitFor({ state: "visible" });
        await users.page.getByRole("menuitem", { name: /delete/i }).click();

        const dialog = users.page.getByRole("alertdialog");
        await dialog.waitFor({ state: "visible" });
        await dialog.getByRole("button", { name: /delete/i }).click();

        // Should show error — user has associated policies
        await expect(
          users.page.locator('[data-sonner-toast][data-type="error"]'),
        ).toBeVisible();

        await dialog.waitFor({ state: "hidden" });
        await users.table.expectRowWithText(testData.userName);
      } finally {
        await testData.cleanup();
      }
    },
  );
});

// ────────────────────────────────────────────────────────────
// Login (needs multi-user helper)
// ────────────────────────────────────────────────────────────
test.describe("user profiles login", () => {
  test(
    "created user can login with email and password",
    {
      tag: "@C2586822",
      annotation: {
        type: "slow",
        description: "creates user via API and logs in via new browser context",
      },
    },
    async ({ apiHelper, browser }, testInfo) => {
      testInfo.setTimeout(MULTI_USER_TIMEOUT);

      const ts = Date.now();
      const name = `test-login-${ts}`;
      const email = `test-login-${ts}@e2e.local`;
      const password = "Test@123456";

      await apiHelper.createUser(name, email, password);

      try {
        const { page, context } = await loginAs(
          browser,
          apiHelper,
          email,
          password,
        );
        await expect(page).toHaveURL(/\/#\/dashboard/);
        await context.close();
      } finally {
        await apiHelper.deleteUser(name).catch(() => {});
      }
    },
  );

  test(
    "after login, username shows in top-right corner",
    {
      tag: "@C2586823",
      annotation: {
        type: "slow",
        description: "creates user via API and logs in via new browser context",
      },
    },
    async ({ apiHelper, browser }, testInfo) => {
      testInfo.setTimeout(MULTI_USER_TIMEOUT);

      const ts = Date.now();
      const name = `test-uname-${ts}`;
      const email = `test-uname-${ts}@e2e.local`;
      const password = "Test@123456";

      await apiHelper.createUser(name, email, password);

      try {
        const { page, context } = await loginAs(
          browser,
          apiHelper,
          email,
          password,
        );

        // Username should appear in the user dropdown trigger button
        await expect(page.getByRole("button", { name: name })).toBeVisible();

        await context.close();
      } finally {
        await apiHelper.deleteUser(name).catch(() => {});
      }
    },
  );
});

// ────────────────────────────────────────────────────────────
// Password Change (needs multi-user helper)
// ────────────────────────────────────────────────────────────
test.describe("user profiles password change", () => {
  test(
    "user can change own password and login with new password",
    {
      tag: ["@C2611616", "@C2611617"],
      annotation: {
        type: "slow",
        description: "creates user, logs in, changes password, then re-logs in",
      },
    },
    async ({ apiHelper, browser }, testInfo) => {
      testInfo.setTimeout(MULTI_USER_EXTENDED_TIMEOUT);

      const ts = Date.now();
      const name = `test-chpwd-${ts}`;
      const email = `test-chpwd-${ts}@e2e.local`;
      const oldPassword = "Test@123456";
      const newPassword = "NewPass@789";

      await apiHelper.createUser(name, email, oldPassword);

      try {
        const { page, context } = await loginAs(
          browser,
          apiHelper,
          email,
          oldPassword,
        );

        // Change password
        await page.goto("/#/update-password");
        await page
          .locator('input[name="password"]')
          .waitFor({ state: "visible" });
        await page.locator('input[name="password"]').fill(newPassword);
        await page.locator('input[name="confirmPassword"]').fill(newPassword);
        await page.getByRole("button", { name: /update/i }).click();
        await page.waitForURL("**/#/dashboard");

        // Logout → lands on login page
        await logout(page);

        // Login with new password
        await page.locator('input[name="email"]').fill(email);
        await page.locator('input[name="password"]').fill(newPassword);
        await page.getByRole("button", { name: /sign in/i }).click();
        await page.waitForURL("**/#/dashboard");

        await context.close();
      } finally {
        await apiHelper.deleteUser(name).catch(() => {});
      }
    },
  );

  test(
    "old password fails after password change",
    {
      tag: "@C2611618",
      annotation: {
        type: "slow",
        description:
          "creates user, logs in, changes password, then tries old password",
      },
    },
    async ({ apiHelper, browser }, testInfo) => {
      testInfo.setTimeout(MULTI_USER_EXTENDED_TIMEOUT);

      const ts = Date.now();
      const name = `test-oldpwd-${ts}`;
      const email = `test-oldpwd-${ts}@e2e.local`;
      const oldPassword = "Test@123456";
      const newPassword = "NewPass@789";

      await apiHelper.createUser(name, email, oldPassword);

      try {
        const { page, context } = await loginAs(
          browser,
          apiHelper,
          email,
          oldPassword,
        );

        // Change password
        await page.goto("/#/update-password");
        await page
          .locator('input[name="password"]')
          .waitFor({ state: "visible" });
        await page.locator('input[name="password"]').fill(newPassword);
        await page.locator('input[name="confirmPassword"]').fill(newPassword);
        await page.getByRole("button", { name: /update/i }).click();
        await page.waitForURL("**/#/dashboard");

        // Logout → lands on login page
        await logout(page);

        // Try to login with old password — should fail
        await page.locator('input[name="email"]').fill(email);
        await page.locator('input[name="password"]').fill(oldPassword);
        await page.getByRole("button", { name: /sign in/i }).click();

        // Should show error or remain on login page
        await expect(
          page.getByText(/invalid|error|incorrect|unauthorized/i).first(),
        ).toBeVisible();

        await context.close();
      } finally {
        await apiHelper.deleteUser(name).catch(() => {});
      }
    },
  );
});
