import type { Locator } from "@playwright/test";
import { expect, test } from "../fixtures/base";
import type { ResourcePage } from "../helpers/resource-page";

/** Create a role via the create form and submit */
async function createRole(
  roles: ResourcePage,
  name: string,
  permissions?: string[],
): Promise<void> {
  await roles.goToCreate();
  await roles.form.fillInput("metadata.name", name);
  if (permissions?.length) {
    const permField = roles.form.field("spec.permissions");
    for (const perm of permissions) {
      await permField.getByText(perm, { exact: true }).click();
    }
  }
  await roles.form.submit();
}

/** Assert permission count shown in the list row */
async function expectPermissionCount(
  roles: ResourcePage,
  name: string,
  count: number,
): Promise<void> {
  await expect(
    roles.table
      .rowWithText(name)
      .getByText(`${count} permissions`, { exact: true }),
  ).toBeVisible();
}

/** Open edit form and wait for permission data to load, return the permissions field locator */
async function editRowWithPermissions(
  roles: ResourcePage,
  name: string,
  groupName: string,
  badgeText: string,
): Promise<Locator> {
  await roles.table.editRow(name);
  await expect(roles.page.locator('[data-testid="form-submit"]')).toBeEnabled();
  const permField = roles.form.field("spec.permissions");
  await expect(
    permField
      .locator('[data-testid="permission-group-header"]')
      .filter({ hasText: groupName })
      .getByText(badgeText, { exact: true }),
  ).toBeVisible();
  return permField;
}

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

      await createRole(roles, uniqueName, ["Workspaces:Read"]);

      await roles.goToList();
      await roles.table.expectRowWithText(uniqueName);

      // Cleanup
      await roles.table.deleteRow(uniqueName, { noWait: true });
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

  test(
    "can create role with valid k8s name format",
    {
      tag: "@C2611653",
    },
    async ({ roles }) => {
      const name = `test-a1-${Date.now()}`;

      await createRole(roles, name, ["Workspaces:Read"]);

      await roles.goToList();
      await roles.table.expectRowWithText(name);

      // Cleanup
      await roles.table.deleteRow(name, { noWait: true });
    },
  );

  test(
    "rejects name longer than 63 characters",
    {
      tag: "@C2611691",
    },
    async ({ roles }) => {
      const longName = "a".repeat(64);

      await roles.goToCreate();
      await roles.form.fillInput("metadata.name", longName);
      await roles.form.submit();

      await expect(
        roles.page.locator('[data-sonner-toast][data-type="error"]'),
      ).toBeVisible();
      await expect(roles.page.locator('[data-testid="form"]')).toBeVisible();
    },
  );

  test(
    "rejects duplicate role name",
    {
      tag: "@C2611692",
    },
    async ({ roles }) => {
      const name = `test-dup-${Date.now()}`;

      // Create first role
      await createRole(roles, name);
      await roles.goToList();
      await roles.table.expectRowWithText(name);

      // Try to create second with same name
      await roles.goToCreate();
      await roles.form.fillInput("metadata.name", name);
      await roles.form.submit();

      await expect(
        roles.page.locator('[data-sonner-toast][data-type="error"]'),
      ).toBeVisible();
      await expect(roles.page.locator('[data-testid="form"]')).toBeVisible();

      // Cleanup
      await roles.goToList();
      await roles.table.deleteRow(name, { noWait: true });
    },
  );

  test(
    "can create role without any permissions",
    {
      tag: "@C2611693",
    },
    async ({ roles }) => {
      const name = `test-noperm-${Date.now()}`;

      await createRole(roles, name);

      await roles.goToList();
      await expectPermissionCount(roles, name, 0);

      // Cleanup
      await roles.table.deleteRow(name, { noWait: true });
    },
  );

  test(
    "can create role with all permissions selected",
    {
      tag: "@C2611694",
    },
    async ({ roles }) => {
      const name = `test-allperm-${Date.now()}`;

      await roles.goToCreate();
      await roles.form.fillInput("metadata.name", name);

      // Click each resource group header to select all permissions
      const permField = roles.form.field("spec.permissions");
      const headers = permField.locator(
        '[data-testid="permission-group-header"]',
      );
      const count = await headers.count();
      for (let i = 0; i < count; i++) {
        await headers
          .nth(i)
          .locator('[data-testid="permission-group-toggle"]')
          .click();
      }

      await roles.form.submit();

      await roles.goToList();
      await expectPermissionCount(roles, name, 45);

      // Cleanup
      await roles.table.deleteRow(name, { noWait: true });
    },
  );

  test(
    "can create role with partial permissions",
    {
      tag: "@C2611695",
    },
    async ({ roles }) => {
      const name = `test-partial-${Date.now()}`;

      await createRole(roles, name, [
        "Workspaces:Read",
        "Clusters:Read",
        "Endpoints:Read",
      ]);

      await roles.goToList();
      await expectPermissionCount(roles, name, 3);

      // Cleanup
      await roles.table.deleteRow(name, { noWait: true });
    },
  );

  test(
    "group header toggles all permissions in group",
    {
      tag: "@C2611696",
    },
    async ({ roles }) => {
      await roles.goToCreate();

      const permField = roles.form.field("spec.permissions");
      const header = permField
        .locator('[data-testid="permission-group-header"]')
        .filter({ hasText: "Clusters" });

      // Initially 0/4
      await expect(
        header.getByText("0/4 Permissions", { exact: true }),
      ).toBeVisible();

      // Click group header to select all
      await header.locator('[data-testid="permission-group-toggle"]').click();
      await expect(
        header.getByText("4/4 Permissions", { exact: true }),
      ).toBeVisible();

      // Click again to deselect all
      await header.locator('[data-testid="permission-group-toggle"]').click();
      await expect(
        header.getByText("0/4 Permissions", { exact: true }),
      ).toBeVisible();
    },
  );
});

interface PermissionGroupSpec {
  caseId: string;
  groupTitle: string;
  cards: string[];
  depTrigger: string | null;
}

const PERMISSION_GROUPS: PermissionGroupSpec[] = [
  {
    caseId: "C2611654",
    groupTitle: "Clusters",
    cards: [
      "Clusters:Create",
      "Clusters:Delete",
      "Clusters:Read",
      "Clusters:Update",
    ],
    depTrigger: "Clusters:Create",
  },
  {
    caseId: "C2611655",
    groupTitle: "Endpoints",
    cards: [
      "Endpoints:Create",
      "Endpoints:Delete",
      "Endpoints:Read",
      "Endpoints:Update",
    ],
    depTrigger: "Endpoints:Create",
  },
  {
    caseId: "C2611656",
    groupTitle: "Engines",
    cards: [
      "Engines:Create",
      "Engines:Delete",
      "Engines:Read",
      "Engines:Update",
    ],
    depTrigger: "Engines:Create",
  },
  {
    caseId: "C2611657",
    groupTitle: "Image Registries",
    cards: [
      "Image Registries:Create",
      "Image Registries:Delete",
      "Image Registries:Read",
      "Image Registries:Update",
    ],
    depTrigger: "Image Registries:Create",
  },
  {
    caseId: "C2611658",
    groupTitle: "Model Catalogs",
    cards: [
      "Model Catalogs:Create",
      "Model Catalogs:Delete",
      "Model Catalogs:Read",
      "Model Catalogs:Update",
    ],
    depTrigger: "Model Catalogs:Create",
  },
  {
    caseId: "C2611659",
    groupTitle: "Model Registries",
    cards: [
      "Model Registries:Create",
      "Model Registries:Delete",
      "Model Registries:Read",
      "Model Registries:Update",
    ],
    depTrigger: "Model Registries:Create",
  },
  {
    caseId: "C2611660",
    groupTitle: "Roles",
    cards: ["Roles:Create", "Roles:Delete", "Roles:Read", "Roles:Update"],
    depTrigger: "Roles:Create",
  },
  {
    caseId: "C2611661",
    groupTitle: "Workspace Policies",
    cards: [
      "Workspace Policies:Create",
      "Workspace Policies:Delete",
      "Workspace Policies:Read",
      "Workspace Policies:Update",
    ],
    depTrigger: "Workspace Policies:Create",
  },
  {
    caseId: "C2611662",
    groupTitle: "Systems",
    cards: ["System Admin"],
    depTrigger: null,
  },
  {
    caseId: "C2611663",
    groupTitle: "Workspaces",
    cards: [
      "Workspaces:Create",
      "Workspaces:Delete",
      "Workspaces:Read",
      "Workspaces:Update",
    ],
    depTrigger: "Workspaces:Create",
  },
  {
    caseId: "C2611733",
    groupTitle: "Users",
    cards: ["Users:Create", "Users:Delete", "Users:Read", "Users:Update"],
    depTrigger: "Users:Create",
  },
];

async function verifyPermissionGroup(
  roles: ResourcePage,
  spec: PermissionGroupSpec,
): Promise<void> {
  const slug = spec.groupTitle.toLowerCase().replace(/\s+/g, "-");
  const name = `test-pg-${slug}-${Date.now()}`;
  const N = spec.cards.length;

  await roles.goToCreate();
  await roles.form.fillInput("metadata.name", name);

  const permField = roles.form.field("spec.permissions");
  const header = permField
    .locator('[data-testid="permission-group-header"]')
    .filter({ hasText: spec.groupTitle });

  // Verify badge shows 0/N
  await expect(
    header.getByText(`0/${N} Permissions`, { exact: true }),
  ).toBeVisible();

  // Verify each permission card is visible
  for (const card of spec.cards) {
    await expect(permField.getByText(card, { exact: true })).toBeVisible();
  }

  // Dependency auto-select test (standard groups only)
  if (spec.depTrigger) {
    // Click non-read permission → auto-selects Read → badge becomes 2/N
    await permField.getByText(spec.depTrigger, { exact: true }).click();
    await expect(
      header.getByText(`2/${N} Permissions`, { exact: true }),
    ).toBeVisible();

    // Deselect depTrigger
    await permField.getByText(spec.depTrigger, { exact: true }).click();
    // Deselect auto-selected Read
    await permField
      .getByText(`${spec.groupTitle}:Read`, { exact: true })
      .click();
    // Badge back to 0/N
    await expect(
      header.getByText(`0/${N} Permissions`, { exact: true }),
    ).toBeVisible();
  }

  // Select all via group header toggle
  await header.locator('[data-testid="permission-group-toggle"]').click();
  await expect(
    header.getByText(`${N}/${N} Permissions`, { exact: true }),
  ).toBeVisible();

  // Submit and verify
  await roles.form.submit();
  await roles.goToList();
  await expectPermissionCount(roles, name, N);

  // Cleanup
  await roles.table.deleteRow(name, { noWait: true });
}

test.describe("roles create - permission groups", () => {
  for (const spec of PERMISSION_GROUPS) {
    test(
      `verify ${spec.groupTitle} permission group`,
      {
        tag: `@${spec.caseId}`,
      },
      async ({ roles }) => {
        await verifyPermissionGroup(roles, spec);
      },
    );
  }
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
      await createRole(roles, uniqueName, ["Workspaces:Read"]);
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
      await roles.table.deleteRow(uniqueName, { noWait: true });
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
      await createRole(roles, uniqueName, ["Workspaces:Read"]);

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
      await roles.table.deleteRow(uniqueName, { noWait: true });
    },
  );

  test(
    "editing role updates permissions count",
    {
      tag: "@C2611705",
    },
    async ({ roles }) => {
      const name = `test-editcnt-${Date.now()}`;

      // Create with 1 permission
      await createRole(roles, name, ["Workspaces:Read"]);

      await roles.goToList();
      await expectPermissionCount(roles, name, 1);

      // Edit: add 1 more permission
      const permField = await editRowWithPermissions(
        roles,
        name,
        "Workspaces",
        "1/4 Permissions",
      );
      await permField.getByText("Clusters:Read", { exact: true }).click();
      await roles.form.submit();

      await roles.goToList();
      await expectPermissionCount(roles, name, 2);

      // Cleanup
      await roles.table.deleteRow(name, { noWait: true });
    },
  );

  test(
    "admin can edit custom role via list action menu",
    {
      tag: "@C2611709",
    },
    async ({ roles }) => {
      const name = `test-canedit-${Date.now()}`;

      // Setup
      await createRole(roles, name, ["Workspaces:Read"]);

      await roles.goToList();
      await roles.table.expectRowWithText(name);

      // Edit from list and submit without changes
      await roles.table.editRow(name);
      await roles.form.submit();

      await roles.goToList();
      await roles.table.expectRowWithText(name);

      // Cleanup
      await roles.table.deleteRow(name, { noWait: true });
    },
  );

  test(
    "can increase permissions on existing role",
    {
      tag: "@C2611712",
    },
    async ({ roles }) => {
      const name = `test-incperm-${Date.now()}`;

      // Create with 1 permission
      await createRole(roles, name, ["Workspaces:Read"]);

      await roles.goToList();
      await expectPermissionCount(roles, name, 1);

      // Edit: add 2 more permissions
      const permField = await editRowWithPermissions(
        roles,
        name,
        "Workspaces",
        "1/4 Permissions",
      );
      await permField.getByText("Clusters:Read", { exact: true }).click();
      await permField.getByText("Endpoints:Read", { exact: true }).click();
      await roles.form.submit();

      await roles.goToList();
      await expectPermissionCount(roles, name, 3);

      // Cleanup
      await roles.table.deleteRow(name, { noWait: true });
    },
  );

  test(
    "can decrease permissions on existing role",
    {
      tag: "@C2611713",
    },
    async ({ roles }) => {
      const name = `test-decperm-${Date.now()}`;

      // Create with 3 permissions
      await createRole(roles, name, [
        "Workspaces:Read",
        "Clusters:Read",
        "Endpoints:Read",
      ]);

      await roles.goToList();
      await expectPermissionCount(roles, name, 3);

      // Edit: remove 2 permissions
      const permField = await editRowWithPermissions(
        roles,
        name,
        "Clusters",
        "1/4 Permissions",
      );
      await permField.getByText("Clusters:Read", { exact: true }).click();
      await permField.getByText("Endpoints:Read", { exact: true }).click();
      await roles.form.submit();

      await roles.goToList();
      await expectPermissionCount(roles, name, 1);

      // Cleanup
      await roles.table.deleteRow(name, { noWait: true });
    },
  );
});

test.describe("roles yaml import", () => {
  test(
    "can import single or multiple roles via YAML",
    {
      tag: "@C2611699",
    },
    async ({ roles, yamlImport }) => {
      const ts = Date.now();
      const name1 = `test-import1-${ts}`;
      const name2 = `test-import2-${ts}`;

      const yaml = `apiVersion: v1
kind: Role
metadata:
  name: ${name1}
spec:
  permissions:
    - workspace:read
---
apiVersion: v1
kind: Role
metadata:
  name: ${name2}
spec:
  permissions:
    - cluster:read
    - endpoint:read`;

      await roles.goToList();
      await yamlImport.importYaml(yaml);
      await yamlImport.expectResults({ success: 2, errors: 0 });
      await yamlImport.close();

      // Verify both roles in list
      await roles.goToList();
      await roles.table.expectRowWithText(name1);
      await roles.table.expectRowWithText(name2);
      await expectPermissionCount(roles, name1, 1);
      await expectPermissionCount(roles, name2, 2);

      // Cleanup
      await roles.table.deleteRow(name1, { noWait: true });
      await roles.table.deleteRow(name2, { noWait: true });
    },
  );

  test(
    "import fails with invalid field content",
    {
      tag: "@C2611700",
    },
    async ({ roles, yamlImport }) => {
      const yaml = `apiVersion: v1
kind: Role
metadata:
  name: INVALID_UPPERCASE_NAME
spec:
  permissions:
    - workspace:read`;

      await roles.goToList();
      await yamlImport.importYaml(yaml);
      await yamlImport.expectResults({ success: 0, errors: 1 });
      await yamlImport.close();
    },
  );

  test(
    "import skips role with duplicate name",
    {
      tag: "@C2611701",
    },
    async ({ roles, yamlImport }) => {
      const name = `test-impdup-${Date.now()}`;

      // Create a role first
      await createRole(roles, name, ["Workspaces:Read"]);
      await roles.goToList();
      await roles.table.expectRowWithText(name);

      // Import YAML with same name
      const yaml = `apiVersion: v1
kind: Role
metadata:
  name: ${name}
spec:
  permissions:
    - cluster:read`;

      await yamlImport.importYaml(yaml);
      await yamlImport.expectResults({ success: 0, skipped: 1, errors: 0 });
      await yamlImport.close();

      // Verify original permissions unchanged (still 1, not 2)
      await roles.goToList();
      await expectPermissionCount(roles, name, 1);

      // Cleanup
      await roles.table.deleteRow(name, { noWait: true });
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
      await createRole(roles, uniqueName, ["Workspaces:Read"]);
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
      await createRole(roles, uniqueName, ["Workspaces:Read"]);

      await roles.goToList();
      await roles.table.clickRowLink(uniqueName);
      await expect(
        roles.page.locator('[data-testid="show-page"]'),
      ).toBeVisible();

      // Delete from detail page
      await roles.showPageDelete(uniqueName);
    },
  );

  test(
    "admin can delete multiple custom roles",
    {
      tag: "@C2611723",
      annotation: { type: "slow", description: "creates and deletes 2 roles" },
    },
    async ({ roles }, testInfo) => {
      testInfo.setTimeout(90_000);

      const name1 = `test-del1-${Date.now()}`;
      const name2 = `test-del2-${Date.now()}`;

      // Create first role
      await createRole(roles, name1);
      await roles.goToList();
      await roles.table.expectRowWithText(name1);

      // Create second role
      await createRole(roles, name2);
      await roles.goToList();
      await roles.table.expectRowWithText(name2);

      // Delete both
      await roles.table.deleteRow(name1);
      await roles.table.deleteRow(name2);
    },
  );
});
