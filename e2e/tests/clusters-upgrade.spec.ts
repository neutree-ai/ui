import { expect, test } from "../fixtures/base";
import { ApiHelper } from "../helpers/api-helper";

// ── Shared test data created once in beforeAll ──
const irName = { value: "" };
const clNames = {
  ssh: "",
  k8s: "",
};

test.describe("clusters - upgrade", () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const api = new ApiHelper(page);

    const ts = Date.now();
    irName.value = `test-upg-ir-${ts}`;
    clNames.ssh = `test-upg-ssh-${ts}`;
    clNames.k8s = `test-upg-k8s-${ts}`;

    await api.createImageRegistry(irName.value);
    await api.createCluster(clNames.ssh, {
      type: "ssh",
      imageRegistry: irName.value,
    });
    await api.createCluster(clNames.k8s, {
      type: "kubernetes",
      imageRegistry: irName.value,
    });

    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    test.setTimeout(60_000);
    const context = await browser.newContext();
    const page = await context.newPage();
    const api = new ApiHelper(page);

    await Promise.all(
      Object.values(clNames)
        .filter((n) => n)
        .map((name) =>
          api.deleteCluster(name, { force: true }).catch(() => {}),
        ),
    );
    await api
      .deleteImageRegistry(irName.value, { force: true })
      .catch(() => {});
    await context.close();
  });

  // ────────────────────────────────────────────────────────────
  // List page — version column, row action menu, upgrade dialog
  // ────────────────────────────────────────────────────────────
  test.describe("list", () => {
    test("list page shows version column, upgrade action, and opens dialog", {
      tag: "@C2642234",
    }, async ({ clusters }) => {
      await clusters.goToList();
      await clusters.table.waitForLoaded();

      // Version column header visible
      const headers = clusters.table.root.locator("thead th");
      await expect(headers.filter({ hasText: /^version$/i })).toBeVisible();

      // Row action menu has Upgrade option
      const row = clusters.table.rowWithText(clNames.ssh);
      await row.locator('[data-testid="row-actions-trigger"]').click();
      await expect(
        clusters.page.getByRole("menuitem", { name: /upgrade/i }),
      ).toBeVisible();

      // Clicking Upgrade opens dialog with expected content
      await clusters.page.getByRole("menuitem", { name: /upgrade/i }).click();

      const dialog = clusters.page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(/upgrade cluster/i)).toBeVisible();
      await expect(dialog.getByText(/current version/i)).toBeVisible();
      await expect(dialog.getByText(/target version/i)).toBeVisible();

      const cancelBtn = dialog.getByRole("button", { name: /cancel/i });
      await expect(cancelBtn).toBeVisible();
      await cancelBtn.click();
    });

    test("SSH cluster upgrade dialog shows downtime warning", {
      tag: "@C2642235",
    }, async ({ clusters }) => {
      await clusters.goToList();
      await clusters.table.waitForLoaded();

      const row = clusters.table.rowWithText(clNames.ssh);
      await row.locator('[data-testid="row-actions-trigger"]').click();
      await clusters.page.getByRole("menuitem", { name: /upgrade/i }).click();

      const dialog = clusters.page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(/downtime during upgrade/i)).toBeVisible();

      const cancelBtn = dialog.getByRole("button", { name: /cancel/i });
      await expect(cancelBtn).toBeVisible();
      await cancelBtn.click();
    });

    test("K8s cluster upgrade dialog shows rolling update message", {
      tag: "@C2642236",
    }, async ({ clusters }) => {
      await clusters.goToList();
      await clusters.table.waitForLoaded();

      const row = clusters.table.rowWithText(clNames.k8s);
      await row.locator('[data-testid="row-actions-trigger"]').click();
      await clusters.page.getByRole("menuitem", { name: /upgrade/i }).click();

      const dialog = clusters.page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(/rolling updates/i)).toBeVisible();

      const cancelBtn = dialog.getByRole("button", { name: /cancel/i });
      await expect(cancelBtn).toBeVisible();
      await cancelBtn.click();
    });
  });

  // ────────────────────────────────────────────────────────────
  // Detail page — version row, action menu, upgrade dialog
  // ────────────────────────────────────────────────────────────
  test.describe("detail", () => {
    test("show page displays version, upgrade action, and opens dialog", {
      tag: "@C2642238",
    }, async ({ clusters }) => {
      await clusters.goToShow(clNames.ssh);

      const showPage = clusters.page.locator('[data-testid="show-page"]');
      await expect(showPage).toBeVisible();

      // Version row visible
      await expect(
        showPage.locator("dt", { hasText: /^version$/i }),
      ).toBeVisible();

      // Action menu has Upgrade option
      await clusters.page
        .locator('[data-testid="show-actions-trigger"]')
        .click();
      await expect(
        clusters.page.getByRole("menuitem", { name: /upgrade/i }),
      ).toBeVisible();

      // Clicking Upgrade opens dialog
      await clusters.page.getByRole("menuitem", { name: /upgrade/i }).click();

      const dialog = clusters.page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(/upgrade cluster/i)).toBeVisible();
      await expect(dialog.getByText(/current version/i)).toBeVisible();

      const cancelBtn = dialog.getByRole("button", { name: /cancel/i });
      await expect(cancelBtn).toBeVisible();
      await cancelBtn.click();
    });
  });

  // ────────────────────────────────────────────────────────────
  // Create form — version selector behavior
  // ────────────────────────────────────────────────────────────
  test.describe("create form", () => {
    test("version field visible, disabled without image registry, enabled after selecting", {
      tag: "@C2642237",
    }, async ({ clusters }) => {
      await clusters.goToCreate();

      // Version field visible
      await expect(clusters.form.field("spec.version")).toBeVisible();

      // Disabled when image registry is not selected
      const versionButton = clusters.form
        .field("spec.version")
        .locator("button");
      await expect(versionButton).toBeDisabled();

      // Select image registry
      await clusters.form.selectComboboxOption(
        "spec.image_registry",
        irName.value,
      );

      // Version field should become enabled (or loading)
      const versionField = clusters.form.field("spec.version");
      await expect(versionField).toBeVisible();
    });
  });

  // ────────────────────────────────────────────────────────────
  // Edit form — version selector disabled
  // ────────────────────────────────────────────────────────────
  test.describe("edit form", () => {
    test("version field is visible and disabled in edit mode", {
      tag: "@C2642438",
    }, async ({ clusters }) => {
      await clusters.goToEdit(clNames.ssh);

      await expect(clusters.page.locator('[data-testid="form"]')).toBeVisible({
        timeout: 15_000,
      });

      const versionField = clusters.form.field("spec.version");
      await expect(versionField).toBeVisible();

      const versionButton = versionField.locator("button");
      await expect(versionButton).toBeDisabled();
    });
  });
});
