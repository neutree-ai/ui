import { expect, test } from "../fixtures/base";
import { ApiHelper } from "../helpers/api-helper";
import { MULTI_USER_TIMEOUT } from "../helpers/constants";
import { ResourcePage } from "../helpers/resource-page";

const irName = { value: "" };

test.describe("clusters - permissions & delete", () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const api = new ApiHelper(page);

    irName.value = `test-cl-ir-${Date.now()}`;
    await api.createImageRegistry(irName.value);

    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const api = new ApiHelper(page);

    await api
      .deleteImageRegistry(irName.value, { force: true })
      .catch(() => {});
    await context.close();
  });

  // ────────────────────────────────────────────────────────────
  // List permissions (multi-user)
  // ────────────────────────────────────────────────────────────
  test.describe("list permissions", () => {
    test(
      "non-admin with global cluster:read can see list",
      {
        tag: "@C2613065",
        annotation: {
          type: "slow",
          description: "creates test user with cluster:read permission",
        },
      },
      async ({ createTestUser }, testInfo) => {
        testInfo.setTimeout(MULTI_USER_TIMEOUT);

        const testUser = await createTestUser(["cluster:read"]);
        const clPage = new ResourcePage(testUser.page, {
          routeName: "clusters",
          workspaced: true,
        });

        await clPage.goToList();

        // User with cluster:read should see cluster rows
        const rowCount = await clPage.table.rows().count();
        expect(rowCount).toBeGreaterThan(0);
      },
    );

    test(
      "non-admin without cluster:read sees empty list",
      {
        tag: "@C2613067",
        annotation: {
          type: "slow",
          description: "creates test user without cluster:read permission",
        },
      },
      async ({ createTestUser }, testInfo) => {
        testInfo.setTimeout(MULTI_USER_TIMEOUT);

        // Give an unrelated permission so the user can log in
        const testUser = await createTestUser(["role:read"]);
        const clPage = new ResourcePage(testUser.page, {
          routeName: "clusters",
          workspaced: true,
        });

        await testUser.page.goto("/#/default/clusters");
        await clPage.table.waitForLoaded();

        // User without cluster:read should see empty table
        await expect(
          testUser.page.locator('[data-testid="table-empty"]'),
        ).toBeVisible();
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // Create permissions (multi-user)
  // ────────────────────────────────────────────────────────────
  test.describe("create permissions", () => {
    test(
      "admin can create cluster",
      { tag: "@C2613081" },
      async ({ clusters, apiHelper }) => {
        const name = `test-cl-adm-new-${Date.now()}`;

        await clusters.goToCreate();
        await clusters.form.fillInput("metadata.name", name);
        await clusters.form.selectComboboxOption(
          "spec.image_registry",
          irName.value,
        );

        // Use K8s type (simpler — just kubeconfig)
        await clusters.form.selectOption("spec.type", "Kubernetes");
        await clusters.form.fillTextarea(
          "spec.config.kubernetes_config.kubeconfig",
          "apiVersion: v1\nkind: Config\nclusters: []\ncontexts: []\nusers: []",
        );

        const responsePromise = clusters.page.waitForResponse(
          (r) =>
            r.url().includes("/clusters") &&
            r.request().method() === "POST" &&
            (r.ok() || r.status() >= 400),
        );
        await clusters.form.submit();
        const response = await responsePromise;

        // Admin should be able to create successfully
        expect(response.ok()).toBe(true);

        // Cleanup
        await apiHelper.deleteCluster(name, { force: true }).catch(() => {});
      },
    );

    test(
      "non-admin with global cluster:create can create",
      {
        tag: ["@C2613082", "@C2613083"],
        annotation: {
          type: "slow",
          description: "creates test user with cluster:read+create permissions",
        },
      },
      async ({ createTestUser, apiHelper }, testInfo) => {
        testInfo.setTimeout(MULTI_USER_TIMEOUT);

        const testUser = await createTestUser([
          "cluster:read",
          "cluster:create",
          "image_registry:read",
        ]);
        const clPage = new ResourcePage(testUser.page, {
          routeName: "clusters",
          workspaced: true,
        });

        const name = `test-cl-glb-new-${Date.now()}`;
        await clPage.goToCreate();
        await clPage.form.fillInput("metadata.name", name);
        await clPage.form.selectComboboxOption(
          "spec.image_registry",
          irName.value,
        );

        await clPage.form.selectOption("spec.type", "Kubernetes");
        await clPage.form.fillTextarea(
          "spec.config.kubernetes_config.kubeconfig",
          "apiVersion: v1\nkind: Config\nclusters: []\ncontexts: []\nusers: []",
        );

        const responsePromise = testUser.page.waitForResponse(
          (r) =>
            r.url().includes("/clusters") &&
            r.request().method() === "POST" &&
            (r.ok() || r.status() >= 400),
        );
        await clPage.form.submit();
        const response = await responsePromise;

        expect(response.ok()).toBe(true);

        // Cleanup
        await apiHelper.deleteCluster(name, { force: true }).catch(() => {});
      },
    );

    test(
      "non-admin without cluster:create cannot create",
      {
        tag: "@C2613084",
        annotation: {
          type: "slow",
          description: "creates test user with cluster:read only",
        },
      },
      async ({ createTestUser }, testInfo) => {
        testInfo.setTimeout(MULTI_USER_TIMEOUT);

        const testUser = await createTestUser([
          "cluster:read",
          "image_registry:read",
        ]);
        const clPage = new ResourcePage(testUser.page, {
          routeName: "clusters",
          workspaced: true,
        });

        const name = `test-cl-no-new-${Date.now()}`;
        await clPage.goToCreate();
        await clPage.form.fillInput("metadata.name", name);
        await clPage.form.selectComboboxOption(
          "spec.image_registry",
          irName.value,
        );

        await clPage.form.selectOption("spec.type", "Kubernetes");
        await clPage.form.fillTextarea(
          "spec.config.kubernetes_config.kubeconfig",
          "apiVersion: v1\nkind: Config\nclusters: []\ncontexts: []\nusers: []",
        );

        const responsePromise = testUser.page.waitForResponse(
          (r) =>
            r.url().includes("/clusters") &&
            r.request().method() === "POST" &&
            !r.ok(),
        );
        await clPage.form.submit();
        await responsePromise;

        // Form should stay visible (submission rejected by server)
        await expect(
          testUser.page.locator('[data-testid="form"]'),
        ).toBeVisible();
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // Edit permissions (multi-user)
  // ────────────────────────────────────────────────────────────
  test.describe("edit permissions", () => {
    test(
      "admin can edit cluster",
      { tag: "@C2613087" },
      async ({ clusters, apiHelper }) => {
        const name = `test-cl-adm-upd-${Date.now()}`;
        await apiHelper.createCluster(name, {
          type: "kubernetes",
          imageRegistry: irName.value,
        });

        await clusters.goToEdit(name);
        await expect(
          clusters.page.locator('[data-testid="form-submit"]'),
        ).toBeEnabled();

        // Change replicas to verify edit works
        const replicasInput = clusters.form
          .field("spec.config.kubernetes_config.router.replicas")
          .locator("input");
        await replicasInput.clear();
        await replicasInput.fill("3");

        await clusters.form.submit();

        // Should redirect to list
        await clusters.table.waitForLoaded();
        await clusters.table.expectRowWithText(name);

        // Cleanup
        await apiHelper.deleteCluster(name, { force: true }).catch(() => {});
      },
    );

    test(
      "non-admin with global cluster:update can edit",
      {
        tag: ["@C2613088", "@C2613089"],
        annotation: {
          type: "slow",
          description: "creates test user with cluster:read+update permissions",
        },
      },
      async ({ createTestUser, apiHelper }, testInfo) => {
        testInfo.setTimeout(MULTI_USER_TIMEOUT);

        const name = `test-cl-glb-upd-${Date.now()}`;
        await apiHelper.createCluster(name, {
          type: "kubernetes",
          imageRegistry: irName.value,
        });

        const testUser = await createTestUser([
          "cluster:read",
          "cluster:update",
        ]);
        const clPage = new ResourcePage(testUser.page, {
          routeName: "clusters",
          workspaced: true,
        });

        await clPage.goToEdit(name);
        await expect(
          testUser.page.locator('[data-testid="form-submit"]'),
        ).toBeEnabled();

        const replicasInput = clPage.form
          .field("spec.config.kubernetes_config.router.replicas")
          .locator("input");
        await replicasInput.clear();
        await replicasInput.fill("3");

        await clPage.form.submit();

        // Should redirect to list
        await clPage.table.waitForLoaded();
        await clPage.table.expectRowWithText(name);

        // Cleanup
        await apiHelper.deleteCluster(name, { force: true }).catch(() => {});
      },
    );

    test(
      "non-admin without cluster:update cannot edit",
      {
        tag: "@C2613090",
        annotation: {
          type: "slow",
          description: "creates test user with cluster:read only",
        },
      },
      async ({ createTestUser, apiHelper }, testInfo) => {
        testInfo.setTimeout(MULTI_USER_TIMEOUT);

        const name = `test-cl-no-upd-${Date.now()}`;
        await apiHelper.createCluster(name, {
          type: "kubernetes",
          imageRegistry: irName.value,
        });

        const testUser = await createTestUser(["cluster:read"]);
        const clPage = new ResourcePage(testUser.page, {
          routeName: "clusters",
          workspaced: true,
        });

        await clPage.goToEdit(name);
        await expect(
          testUser.page.locator('[data-testid="form-submit"]'),
        ).toBeEnabled();

        const replicasInput = clPage.form
          .field("spec.config.kubernetes_config.router.replicas")
          .locator("input");
        await replicasInput.clear();
        await replicasInput.fill("3");

        await clPage.form.submit();

        // Should show error (permission denied)
        await expect(
          testUser.page.getByText(/error|denied|forbidden|fail/i).first(),
        ).toBeVisible({ timeout: 10_000 });

        // Cleanup
        await apiHelper.deleteCluster(name, { force: true }).catch(() => {});
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // Delete tests
  // ────────────────────────────────────────────────────────────
  test.describe("delete", () => {
    test(
      "delete from list -> confirm -> dialog closes",
      { tag: "@C2613098" },
      async ({ clusters, apiHelper }) => {
        const name = `test-cl-del-${Date.now()}`;
        await apiHelper.createCluster(name, {
          imageRegistry: irName.value,
        });

        await clusters.goToList();
        await clusters.table.deleteRow(name, { noWait: true });

        // Cleanup via API in case backend GC is slow
        await apiHelper.deleteCluster(name, { force: true }).catch(() => {});
      },
    );

    test(
      "delete from detail action menu",
      { tag: "@C2613099" },
      async ({ clusters, apiHelper }) => {
        const name = `test-cl-del-detail-${Date.now()}`;
        await apiHelper.createCluster(name, {
          imageRegistry: irName.value,
        });

        await clusters.goToShow(name);

        // Open show page actions, click delete
        await clusters.page
          .locator('[data-testid="show-actions-trigger"]')
          .click();
        await clusters.page.getByRole("menuitem", { name: /delete/i }).click();

        // Confirm delete dialog
        const dialog = clusters.page.getByRole("alertdialog");
        await dialog.waitFor({ state: "visible" });
        await dialog.getByRole("button", { name: /delete/i }).click();
        await dialog.waitFor({ state: "hidden" });

        // Cleanup via API in case backend GC is slow
        await apiHelper.deleteCluster(name, { force: true }).catch(() => {});
      },
    );

    test.skip(
      "delete -> cancel -> row still exists",
      { tag: "@miss" },
      async ({ clusters, apiHelper }) => {
        const name = `test-cl-del-cancel-${Date.now()}`;
        await apiHelper.createCluster(name, {
          imageRegistry: irName.value,
        });

        await clusters.goToList();
        await clusters.table.waitForLoaded();

        // Open row actions, click delete
        await clusters.table
          .rowWithText(name)
          .locator('[data-testid="row-actions-trigger"]')
          .click();
        await clusters.page
          .locator('[role="menu"]')
          .waitFor({ state: "visible" });
        await clusters.page.getByRole("menuitem", { name: /delete/i }).click();

        // Cancel the dialog
        const dialog = clusters.page.getByRole("alertdialog");
        await dialog.waitFor({ state: "visible" });
        await dialog.getByRole("button", { name: /cancel/i }).click();
        await dialog.waitFor({ state: "hidden" });

        // Row should still be there
        await clusters.table.expectRowWithText(name);

        // Cleanup
        await apiHelper.deleteCluster(name, { force: true }).catch(() => {});
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // Delete permissions (multi-user)
  // ────────────────────────────────────────────────────────────
  test.describe("delete permissions", () => {
    test(
      "admin can delete cluster",
      { tag: "@C2613093" },
      async ({ clusters, apiHelper }) => {
        const name = `test-cl-adm-rm-${Date.now()}`;
        await apiHelper.createCluster(name, {
          imageRegistry: irName.value,
        });

        await clusters.goToList();
        await clusters.table.deleteRow(name, { noWait: true });

        // Cleanup via API in case backend GC is slow
        await apiHelper.deleteCluster(name, { force: true }).catch(() => {});
      },
    );

    test(
      "non-admin with global cluster:delete can delete",
      {
        tag: ["@C2613094", "@C2613095"],
        annotation: {
          type: "slow",
          description: "creates test user with cluster:read+delete permissions",
        },
      },
      async ({ createTestUser, apiHelper }, testInfo) => {
        testInfo.setTimeout(MULTI_USER_TIMEOUT);

        const name = `test-cl-glb-rm-${Date.now()}`;
        await apiHelper.createCluster(name, {
          imageRegistry: irName.value,
        });

        const testUser = await createTestUser([
          "cluster:read",
          "cluster:delete",
        ]);
        const clPage = new ResourcePage(testUser.page, {
          routeName: "clusters",
          workspaced: true,
        });

        await clPage.goToList();
        await clPage.table.deleteRow(name, { noWait: true });

        // Cleanup via API in case backend GC is slow
        await apiHelper.deleteCluster(name, { force: true }).catch(() => {});
      },
    );

    test(
      "non-admin without cluster:delete cannot delete",
      {
        tag: "@C2613096",
        annotation: {
          type: "slow",
          description: "creates test user with cluster:read only",
        },
      },
      async ({ createTestUser, apiHelper }, testInfo) => {
        testInfo.setTimeout(MULTI_USER_TIMEOUT);

        const name = `test-cl-no-rm-${Date.now()}`;
        await apiHelper.createCluster(name, {
          imageRegistry: irName.value,
        });

        const testUser = await createTestUser(["cluster:read"]);
        const clPage = new ResourcePage(testUser.page, {
          routeName: "clusters",
          workspaced: true,
        });

        await clPage.goToList();
        await clPage.table.expectRowWithText(name);

        // Attempt delete
        await clPage.table
          .rowWithText(name)
          .locator('[data-testid="row-actions-trigger"]')
          .click();
        await testUser.page
          .locator('[role="menu"]')
          .waitFor({ state: "visible" });
        await testUser.page.getByRole("menuitem", { name: /delete/i }).click();

        const dialog = testUser.page.getByRole("alertdialog");
        await dialog.waitFor({ state: "visible" });
        await dialog.getByRole("button", { name: /delete/i }).click();
        await dialog.waitFor({ state: "hidden" });

        // Row should still exist (delete failed)
        await clPage.table.expectRowWithText(name);

        // Cleanup
        await apiHelper.deleteCluster(name, { force: true }).catch(() => {});
      },
    );
  });
});
