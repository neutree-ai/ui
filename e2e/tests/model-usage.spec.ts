import { expect, test } from "../fixtures/base";
import type { ResourcePage } from "../helpers/resource-page";

// TestRail suite 2420, Model Usage section — Roles create page permission wiring.
//
// `workspace:usage-read` one-directionally depends on `workspace:read`:
// selecting Usage Read auto-selects AND locks Read, but selecting Read alone
// does not pull in Usage Read. The Workspaces group has 5 actions
// (read, usage-read, create, update, delete) so the group badge is "x/5".

const GROUP = "Workspaces";
const READ = "Workspaces:Read";
const USAGE_READ = "Workspaces:Usage Read";
const N = 5;

test.describe("model usage — roles usage-read dependency", () => {
  test("workspace:usage-read one-directionally depends on and locks workspace:read", {
    tag: "@C2710873",
  }, async ({ roles }: { roles: ResourcePage }) => {
    await roles.goToCreate();
    await roles.form.fillInput("metadata.name", `usage-read-dep-${Date.now()}`);

    const permField = roles.form.field("spec.permissions");
    const header = permField
      .locator('[data-testid="permission-group-header"]')
      .filter({ hasText: GROUP });

    // Step 1 — baseline: nothing selected in the Workspaces group.
    await expect(
      header.getByText(`0/${N} Permissions`, { exact: true }),
    ).toBeVisible();
    await expect(permField.getByText(READ, { exact: true })).toBeVisible();
    await expect(
      permField.getByText(USAGE_READ, { exact: true }),
    ).toBeVisible();

    // Step 2 — selecting Read alone must NOT auto-select anything else.
    await permField.getByText(READ, { exact: true }).click();
    await expect(
      header.getByText(`1/${N} Permissions`, { exact: true }),
    ).toBeVisible();

    // Step 3 — deselect Read → back to baseline.
    await permField.getByText(READ, { exact: true }).click();
    await expect(
      header.getByText(`0/${N} Permissions`, { exact: true }),
    ).toBeVisible();

    // Step 4 — selecting Usage Read auto-selects Read → 2/5.
    await permField.getByText(USAGE_READ, { exact: true }).click();
    await expect(
      header.getByText(`2/${N} Permissions`, { exact: true }),
    ).toBeVisible();

    // Step 5 — the Read card is now locked (cursor-not-allowed + Lock icon).
    const lockedRead = permField
      .locator("div.cursor-not-allowed")
      .filter({ hasText: READ });
    await expect(lockedRead).toBeVisible();

    // Step 6 — clicking the locked Read card cannot deselect it: both stay
    // selected (badge remains 2/5).
    await lockedRead.click({ force: true });
    await expect(
      header.getByText(`2/${N} Permissions`, { exact: true }),
    ).toBeVisible();
  });
});
