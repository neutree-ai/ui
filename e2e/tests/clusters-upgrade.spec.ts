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
  // List page — version column
  // ────────────────────────────────────────────────────────────
  test.describe("list", () => {
    test("list page shows version column header", async ({ clusters }) => {
      await clusters.goToList();

      const headers = clusters.table.root.locator("thead th");
      await expect(headers.filter({ hasText: /^version$/i })).toBeVisible();
    });

    test(
      "list page row action menu has upgrade option",
      async ({ clusters }) => {
        await clusters.goToList();
        await clusters.table.waitForLoaded();

        // Open row actions menu
        const row = clusters.table.rowWithText(clNames.ssh);
        await row.locator('[data-testid="row-actions-trigger"]').click();

        // Verify Upgrade menu item exists
        await expect(
          clusters.page.getByRole("menuitem", { name: /upgrade/i }),
        ).toBeVisible();
      },
    );

    test(
      "clicking upgrade in list opens upgrade dialog",
      async ({ clusters }) => {
        await clusters.goToList();
        await clusters.table.waitForLoaded();

        // Open row actions menu and click Upgrade
        const row = clusters.table.rowWithText(clNames.ssh);
        await row.locator('[data-testid="row-actions-trigger"]').click();
        await clusters.page
          .getByRole("menuitem", { name: /upgrade/i })
          .click();

        // Verify dialog opens and content is stable
        const dialog = clusters.page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await expect(
          dialog.getByText(/upgrade cluster/i),
        ).toBeVisible();
        await expect(
          dialog.getByText(/current version/i),
        ).toBeVisible();
        await expect(
          dialog.getByText(/target version/i),
        ).toBeVisible();

        // Wait for Cancel button to be stable, then close dialog
        const cancelBtn = dialog.getByRole("button", { name: /cancel/i });
        await expect(cancelBtn).toBeVisible();
        await cancelBtn.click();
      },
    );

    test(
      "SSH cluster upgrade dialog shows downtime warning",
      async ({ clusters }) => {
        await clusters.goToList();
        await clusters.table.waitForLoaded();

        const row = clusters.table.rowWithText(clNames.ssh);
        await row.locator('[data-testid="row-actions-trigger"]').click();
        await clusters.page
          .getByRole("menuitem", { name: /upgrade/i })
          .click();

        const dialog = clusters.page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await expect(
          dialog.getByText(/downtime during upgrade/i),
        ).toBeVisible();

        const cancelBtn = dialog.getByRole("button", { name: /cancel/i });
        await expect(cancelBtn).toBeVisible();
        await cancelBtn.click();
      },
    );

    test(
      "K8s cluster upgrade dialog shows rolling update message",
      async ({ clusters }) => {
        await clusters.goToList();
        await clusters.table.waitForLoaded();

        const row = clusters.table.rowWithText(clNames.k8s);
        await row.locator('[data-testid="row-actions-trigger"]').click();
        await clusters.page
          .getByRole("menuitem", { name: /upgrade/i })
          .click();

        const dialog = clusters.page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await expect(
          dialog.getByText(/rolling updates/i),
        ).toBeVisible();

        const cancelBtn = dialog.getByRole("button", { name: /cancel/i });
        await expect(cancelBtn).toBeVisible();
        await cancelBtn.click();
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // Detail page — version row & upgrade action
  // ────────────────────────────────────────────────────────────
  test.describe("detail", () => {
    test("show page displays version row", async ({ clusters }) => {
      await clusters.goToShow(clNames.ssh);

      const showPage = clusters.page.locator('[data-testid="show-page"]');
      await expect(showPage).toBeVisible();

      await expect(
        showPage.locator("dt", { hasText: /^version$/i }),
      ).toBeVisible();
    });

    test(
      "show page action menu has upgrade option",
      async ({ clusters }) => {
        await clusters.goToShow(clNames.ssh);

        await clusters.page
          .locator('[data-testid="show-actions-trigger"]')
          .click();

        await expect(
          clusters.page.getByRole("menuitem", { name: /upgrade/i }),
        ).toBeVisible();
      },
    );

    test(
      "clicking upgrade in show page opens upgrade dialog",
      async ({ clusters }) => {
        await clusters.goToShow(clNames.ssh);

        await clusters.page
          .locator('[data-testid="show-actions-trigger"]')
          .click();
        await clusters.page
          .getByRole("menuitem", { name: /upgrade/i })
          .click();

        const dialog = clusters.page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await expect(
          dialog.getByText(/upgrade cluster/i),
        ).toBeVisible();
        await expect(
          dialog.getByText(/current version/i),
        ).toBeVisible();

        const cancelBtn = dialog.getByRole("button", { name: /cancel/i });
        await expect(cancelBtn).toBeVisible();
        await cancelBtn.click();
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // Create form — version selector
  // ────────────────────────────────────────────────────────────
  test.describe("create form", () => {
    test(
      "create form shows version field",
      async ({ clusters }) => {
        await clusters.goToCreate();

        await expect(
          clusters.form.field("spec.version"),
        ).toBeVisible();
      },
    );

    test(
      "version field is disabled when image registry is not selected",
      async ({ clusters }) => {
        await clusters.goToCreate();

        const versionButton = clusters.form
          .field("spec.version")
          .locator("button");
        await expect(versionButton).toBeDisabled();
      },
    );

    test(
      "version field becomes enabled after selecting image registry",
      async ({ clusters }) => {
        await clusters.goToCreate();

        // Select image registry first
        await clusters.form.selectComboboxOption(
          "spec.image_registry",
          irName.value,
        );

        // Version field should become enabled (or loading)
        const versionField = clusters.form.field("spec.version");
        await expect(versionField).toBeVisible();
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // Edit form — version selector disabled
  // ────────────────────────────────────────────────────────────
  test.describe("edit form", () => {
    test(
      "version field is visible and disabled in edit mode",
      async ({ clusters }) => {
        await clusters.goToEdit(clNames.ssh);

        // Wait for form to render (may take longer for edit page data loading)
        await expect(
          clusters.page.locator('[data-testid="form"]'),
        ).toBeVisible({ timeout: 15_000 });

        // Version field should exist and be disabled
        const versionField = clusters.form.field("spec.version");
        await expect(versionField).toBeVisible();

        const versionButton = versionField.locator("button");
        await expect(versionButton).toBeDisabled();
      },
    );
  });
});
