import { expect, test } from "../fixtures/base";

test("roles CRUD", async ({ roles }) => {
  const uniqueName = `test-role-${Date.now()}`;

  await test.step("list", async () => {
    await roles.goToList();
    await roles.table.waitForLoaded();
    await roles.table.expectRowWithText("admin");
  });

  await test.step("create", async () => {
    await roles.goToCreate();
    await roles.form.fillInput("metadata.name", uniqueName);

    const permField = roles.form.field("spec.permissions");
    await permField.getByText("Workspaces:Read").click();

    await roles.form.submit();

    await roles.goToList();
    await roles.table.expectRowWithText(uniqueName);
  });

  await test.step("edit", async () => {
    await roles.goToList();
    await roles.table.editRow(uniqueName);

    await expect(roles.page.locator('[data-testid="form"]')).toBeVisible();

    const nameInput = roles.form.field("metadata.name").locator("input");
    await expect(nameInput).toBeDisabled();

    await roles.form.submit();
  });

  await test.step("delete", async () => {
    await roles.goToList();
    await roles.table.deleteRow(uniqueName);
    await roles.table.expectNoRowWithText(uniqueName);
  });
});
