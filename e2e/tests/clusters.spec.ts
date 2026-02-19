import { expect, test } from "../fixtures/base";
import { ApiHelper } from "../helpers/api-helper";

// ── Shared test data created once in beforeAll ──
const irName = { value: "" }; // Image registry dependency
const clNames = {
  ssh: "", // SSH type for list/detail/edit
  k8s: "", // K8s type for list/detail/edit
  sort: "", // Second SSH cluster for sort ordering
};

test.describe("clusters", () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const api = new ApiHelper(page);

    const ts = Date.now();
    irName.value = `test-cl-ir-${ts}`;
    clNames.ssh = `test-cl-ssh-${ts}`;
    clNames.k8s = `test-cl-k8s-${ts}`;
    clNames.sort = `test-cl-sort-${ts}`;

    // Create image registry dependency first
    await api.createImageRegistry(irName.value);

    await api.createCluster(clNames.ssh, {
      type: "ssh",
      imageRegistry: irName.value,
    });
    await api.createCluster(clNames.k8s, {
      type: "kubernetes",
      imageRegistry: irName.value,
    });
    await api.createCluster(clNames.sort, {
      type: "ssh",
      imageRegistry: irName.value,
    });

    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const api = new ApiHelper(page);

    for (const name of Object.values(clNames)) {
      await api.deleteCluster(name, { force: true }).catch(() => {});
    }
    await api
      .deleteImageRegistry(irName.value, { force: true })
      .catch(() => {});
    await context.close();
  });

  // ────────────────────────────────────────────────────────────
  // List tests
  // ────────────────────────────────────────────────────────────
  test.describe("list", () => {
    test(
      "list page shows expected columns",
      { tag: "@C2613064" },
      async ({ clusters }) => {
        await clusters.goToList();

        const headers = clusters.table.root.locator("thead th");
        await expect(headers.filter({ hasText: /name/i })).toBeVisible();
        await expect(headers.filter({ hasText: /workspace/i })).toBeVisible();
        await expect(headers.filter({ hasText: /status/i })).toBeVisible();
        await expect(headers.filter({ hasText: /type/i })).toBeVisible();
        await expect(
          headers.filter({ hasText: /image registry/i }),
        ).toBeVisible();
        await expect(headers.filter({ hasText: /updated/i })).toBeVisible();
        await expect(headers.filter({ hasText: /created/i })).toBeVisible();

        await clusters.table.expectRowWithText(clNames.ssh);
      },
    );

    // TODO: shares @C2613068 with "detail > show page displays basic info" — create separate TestRail case
    test(
      "clicking name navigates to detail page",
      { tag: "@C2613068" },
      async ({ clusters }) => {
        await clusters.goToList();
        await clusters.table.clickRowLink(clNames.ssh);

        const showPage = clusters.page.locator('[data-testid="show-page"]');
        await expect(showPage).toBeVisible();
        await expect(
          showPage.getByText(clNames.ssh, { exact: true }),
        ).toBeVisible();
      },
    );

    test("can sort by name", { tag: "@C2612655" }, async ({ clusters }) => {
      await clusters.goToList();
      await clusters.table.sort(/name/i);
    });

    test.skip(
      "can sort by updated at",
      { tag: "@miss" },
      async ({ clusters }) => {
        await clusters.goToList();
        await expect(clusters.table.headerCell(/updated/i)).toBeVisible();
        await clusters.table.sort(/updated/i);
      },
    );

    test.skip(
      "can sort by created at",
      { tag: "@miss" },
      async ({ clusters }) => {
        await clusters.goToList();
        await expect(clusters.table.headerCell(/created/i)).toBeVisible();
        await clusters.table.sort(/created/i);
      },
    );

    test(
      "can toggle column visibility",
      { tag: "@C2612653" },
      async ({ clusters }) => {
        await clusters.goToList();

        await expect(clusters.table.headerCell(/status/i)).toBeVisible();
        await clusters.table.toggleColumn(/status/i);
        await expect(clusters.table.headerCell(/status/i)).toBeHidden();
        await clusters.table.toggleColumn(/status/i);
        await expect(clusters.table.headerCell(/status/i)).toBeVisible();
      },
    );

    test(
      "type column shows correct labels",
      { tag: "@C2612647" },
      async ({ clusters }) => {
        await clusters.goToList();

        const sshRow = clusters.table.rowWithText(clNames.ssh);
        await expect(sshRow.getByText("Static Nodes")).toBeVisible();

        const k8sRow = clusters.table.rowWithText(clNames.k8s);
        await expect(k8sRow.getByText("Kubernetes")).toBeVisible();
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // Detail tests
  // ────────────────────────────────────────────────────────────
  test.describe("detail", () => {
    test(
      "show page displays basic info",
      { tag: "@C2613068" },
      async ({ clusters }) => {
        await clusters.goToShow(clNames.ssh);

        const showPage = clusters.page.locator('[data-testid="show-page"]');
        await expect(showPage).toBeVisible();

        // Name
        await expect(
          showPage.getByText(clNames.ssh, { exact: true }),
        ).toBeVisible();

        // Workspace
        await expect(
          showPage.locator("dt", { hasText: /workspace/i }),
        ).toBeVisible();

        // Status
        await expect(
          showPage.locator("dt", { hasText: /^status$/i }),
        ).toBeVisible();

        // Timestamps
        await expect(
          showPage.getByRole("term").filter({ hasText: /created at/i }),
        ).toBeVisible();
        await expect(
          showPage.getByRole("term").filter({ hasText: /updated at/i }),
        ).toBeVisible();

        // Type
        await expect(
          showPage.locator("dt", { hasText: /^type$/i }),
        ).toBeVisible();
      },
    );

    test(
      "clicking workspace navigates to workspace detail",
      { tag: "@C2612645" },
      async ({ clusters }) => {
        await clusters.goToShow(clNames.ssh);

        const showPage = clusters.page.locator('[data-testid="show-page"]');
        await showPage.getByRole("link", { name: "default" }).click();

        const wsShowPage = clusters.page.locator('[data-testid="show-page"]');
        await expect(wsShowPage).toBeVisible();
        await expect(
          wsShowPage.getByText("default", { exact: true }),
        ).toBeVisible();
      },
    );

    test(
      "K8s show page displays router info",
      { tag: "@C2613074" },
      async ({ clusters }) => {
        await clusters.goToShow(clNames.k8s);

        const showPage = clusters.page.locator('[data-testid="show-page"]');
        await expect(showPage).toBeVisible();

        // Router section fields
        await expect(
          showPage.locator("dt", { hasText: /access mode/i }),
        ).toBeVisible();
        await expect(
          showPage.locator("dt", { hasText: /replicas/i }),
        ).toBeVisible();
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // Create tests
  // ────────────────────────────────────────────────────────────
  test.describe("create", () => {
    test(
      "create form shows basic fields",
      { tag: "@C2612678" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        await expect(clusters.form.field("metadata.name")).toBeVisible();
        await expect(clusters.form.field("metadata.workspace")).toBeVisible();
        await expect(clusters.form.field("spec.image_registry")).toBeVisible();
        await expect(clusters.form.field("spec.type")).toBeVisible();
      },
    );

    test(
      "type selector shows Static Nodes and Kubernetes",
      { tag: "@C2612679" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        const typeField = clusters.form.field("spec.type");
        await typeField.locator('button[role="combobox"]').click();

        await expect(
          clusters.page.getByRole("option", { name: /static nodes/i }),
        ).toBeVisible();
        await expect(
          clusters.page.getByRole("option", { name: /kubernetes/i }),
        ).toBeVisible();
      },
    );

    test(
      "SSH: provider fields visible",
      { tag: "@C2612793" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        // Default type is SSH, so provider fields should be visible
        await expect(clusters.page.getByText("Head Node IP")).toBeVisible();
        await expect(clusters.page.getByText("Worker Node IPs")).toBeVisible();
      },
    );

    test(
      "SSH: auth fields visible",
      { tag: "@C2612801" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        await expect(
          clusters.form.field("spec.config.ssh_config.auth.ssh_user"),
        ).toBeVisible();
        await expect(
          clusters.form.field("spec.config.ssh_config.auth.ssh_private_key"),
        ).toBeVisible();
      },
    );

    test(
      "SSH: model cache section visible",
      { tag: "@C2612804" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        // Model Caches section title and Add button
        await expect(
          clusters.page.getByRole("button", { name: /add model cache/i }),
        ).toBeVisible();
      },
    );

    test(
      "SSH: model cache only has Host Path option",
      { tag: "@C2612805" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        // Add a cache item
        await clusters.page
          .getByRole("button", { name: /add model cache/i })
          .click();

        // The cache type select shows "Host Path" by default — click to open it
        // Navigate from "Cache Type" text to its sibling combobox
        const cacheTypeCombobox = clusters.page
          .getByText("Cache Type")
          .locator("..")
          .locator('button[role="combobox"]');
        await cacheTypeCombobox.click();

        // Only Host Path should be available
        await expect(
          clusters.page.getByRole("option", { name: /host path/i }),
        ).toBeVisible();

        // Should have exactly 1 option
        const options = clusters.page.getByRole("option");
        await expect(options).toHaveCount(1);
      },
    );

    test(
      "K8s: kubeconfig field visible",
      { tag: "@C2612765" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        // Switch to Kubernetes type
        await clusters.form.selectOption("spec.type", "Kubernetes");

        await expect(
          clusters.form.field("spec.config.kubernetes_config.kubeconfig"),
        ).toBeVisible();
      },
    );

    test(
      "K8s: router fields visible",
      { tag: "@C2623069" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        // Switch to Kubernetes type
        await clusters.form.selectOption("spec.type", "Kubernetes");

        await expect(
          clusters.form.field(
            "spec.config.kubernetes_config.router.access_mode",
          ),
        ).toBeVisible();
        await expect(
          clusters.form.field("spec.config.kubernetes_config.router.replicas"),
        ).toBeVisible();
        await expect(
          clusters.form.field(
            "spec.config.kubernetes_config.router.resources.cpu",
          ),
        ).toBeVisible();
        await expect(
          clusters.form.field(
            "spec.config.kubernetes_config.router.resources.memory",
          ),
        ).toBeVisible();
      },
    );

    test(
      "K8s: model cache has Host Path, NFS, PVC options",
      { tag: "@C2612778" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        // Switch to Kubernetes type
        await clusters.form.selectOption("spec.type", "Kubernetes");

        // Add a cache item
        await clusters.page
          .getByRole("button", { name: /add model cache/i })
          .click();

        // The cache type select shows "Host Path" by default — click to open it
        const cacheTypeCombobox = clusters.page
          .getByText("Cache Type")
          .locator("..")
          .locator('button[role="combobox"]');
        await cacheTypeCombobox.click();

        await expect(
          clusters.page.getByRole("option", { name: /host path/i }),
        ).toBeVisible();
        await expect(
          clusters.page.getByRole("option", { name: /nfs/i }),
        ).toBeVisible();
        await expect(
          clusters.page.getByRole("option", { name: /pvc/i }),
        ).toBeVisible();
      },
    );

    test.skip(
      "cancel does not create resource",
      { tag: "@miss" },
      async ({ clusters }) => {
        const name = `test-cl-cancel-${Date.now()}`;

        await clusters.goToCreate();

        await clusters.form.fillInput("metadata.name", name);

        // Accept browser dialog if warnWhenUnsavedChanges fires
        clusters.page.on("dialog", (dialog) => dialog.accept());
        await clusters.form.cancel();

        // Navigate to list and verify no row was created
        await clusters.goToList();
        await clusters.table.expectNoRowWithText(name);
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // Edit tests
  // ────────────────────────────────────────────────────────────
  test.describe("edit", () => {
    // TODO: shares @C2613080 with "K8s edit: name, workspace, type disabled" — create separate TestRail case
    test(
      "SSH edit: name, workspace, type, image registry disabled",
      { tag: "@C2613080" },
      async ({ clusters }) => {
        await clusters.goToEdit(clNames.ssh);
        await expect(
          clusters.page.locator('[data-testid="form-submit"]'),
        ).toBeEnabled();

        // Name disabled
        const nameInput = clusters.form.field("metadata.name").locator("input");
        await expect(nameInput).toBeDisabled();

        // Workspace disabled
        const wsButton = clusters.form
          .field("metadata.workspace")
          .locator('button[role="combobox"]');
        await expect(wsButton).toBeDisabled();

        // Type disabled
        const typeButton = clusters.form
          .field("spec.type")
          .locator('button[role="combobox"]');
        await expect(typeButton).toBeDisabled();

        // Image registry disabled
        const irButton = clusters.form
          .field("spec.image_registry")
          .locator("button");
        await expect(irButton).toBeDisabled();
      },
    );

    test(
      "SSH edit: provider, auth, and cache fields disabled",
      { tag: "@C2612829" },
      async ({ clusters }) => {
        await clusters.goToEdit(clNames.ssh);
        await expect(
          clusters.page.locator('[data-testid="form-submit"]'),
        ).toBeEnabled();

        // Provider: Head IP input should be disabled
        const headNodeCard = clusters.page
          .getByText("Head Node IP")
          .locator("xpath=ancestor::*[contains(@class,'border')]")
          .first();
        await expect(headNodeCard.locator("input")).toBeDisabled();

        // Provider: Worker IP "Add" section should be hidden (disabled hides it)
        await expect(
          clusters.page.getByRole("button", { name: /add/i }).filter({
            has: clusters.page.locator("svg"),
          }),
        ).toBeHidden();

        // Auth: ssh_user disabled
        const sshUserInput = clusters.form
          .field("spec.config.ssh_config.auth.ssh_user")
          .locator("input");
        await expect(sshUserInput).toBeDisabled();

        // Auth: ssh_private_key disabled
        const sshKeyTextarea = clusters.form
          .field("spec.config.ssh_config.auth.ssh_private_key")
          .locator("textarea");
        await expect(sshKeyTextarea).toBeDisabled();

        // Auth: "Leave empty to keep" message
        await expect(
          clusters.page.getByText(/leave empty to keep/i).first(),
        ).toBeVisible();

        // Cache: "Add Model Cache" button should not be visible when disabled
        await expect(
          clusters.page.getByRole("button", { name: /add model cache/i }),
        ).toBeHidden();
      },
    );

    test(
      "K8s edit: name, workspace, type disabled; kubeconfig disabled",
      { tag: "@C2613080" },
      async ({ clusters }) => {
        await clusters.goToEdit(clNames.k8s);
        await expect(
          clusters.page.locator('[data-testid="form-submit"]'),
        ).toBeEnabled();

        // Name disabled
        const nameInput = clusters.form.field("metadata.name").locator("input");
        await expect(nameInput).toBeDisabled();

        // Workspace disabled
        const wsButton = clusters.form
          .field("metadata.workspace")
          .locator('button[role="combobox"]');
        await expect(wsButton).toBeDisabled();

        // Type disabled
        const typeButton = clusters.form
          .field("spec.type")
          .locator('button[role="combobox"]');
        await expect(typeButton).toBeDisabled();

        // Kubeconfig disabled
        const kubeconfigTextarea = clusters.form
          .field("spec.config.kubernetes_config.kubeconfig")
          .locator("textarea");
        await expect(kubeconfigTextarea).toBeDisabled();

        // "Leave empty to keep" message
        await expect(
          clusters.page.getByText(/leave empty to keep/i).first(),
        ).toBeVisible();
      },
    );

    test(
      "K8s edit: router fields editable",
      { tag: "@C2612832" },
      async ({ clusters }) => {
        await clusters.goToEdit(clNames.k8s);
        await expect(
          clusters.page.locator('[data-testid="form-submit"]'),
        ).toBeEnabled();

        // Access mode should be enabled
        const accessModeButton = clusters.form
          .field("spec.config.kubernetes_config.router.access_mode")
          .locator('button[role="combobox"]');
        await expect(accessModeButton).toBeEnabled();

        // Replicas input should be enabled
        const replicasInput = clusters.form
          .field("spec.config.kubernetes_config.router.replicas")
          .locator("input");
        await expect(replicasInput).toBeEnabled();

        // CPU input should be enabled
        const cpuInput = clusters.form
          .field("spec.config.kubernetes_config.router.resources.cpu")
          .locator("input");
        await expect(cpuInput).toBeEnabled();

        // Memory input should be enabled
        const memoryInput = clusters.form
          .field("spec.config.kubernetes_config.router.resources.memory")
          .locator("input");
        await expect(memoryInput).toBeEnabled();
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
});
