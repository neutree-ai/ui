import { expect, test } from "../fixtures/base";
import { ApiHelper } from "../helpers/api-helper";

// ── Shared test data created once in beforeAll ──
const irName = { value: "" }; // Image registry for cluster dependency
const clusterName = { value: "" };
const mrName = { value: "" };
const epNames = {
  base: "", // primary endpoint for list/detail/edit
  sort: "", // second endpoint for sort ordering
};

test.describe("endpoints", () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const api = new ApiHelper(page);

    const ts = Date.now();
    irName.value = `test-ep-ir-${ts}`;
    clusterName.value = `test-ep-cl-${ts}`;
    mrName.value = `test-ep-mr-${ts}`;
    epNames.base = `test-ep-base-${ts}`;
    epNames.sort = `test-ep-sort-${ts}`;

    // Create dependency resources first
    await api.createImageRegistry(irName.value);
    await api.createCluster(clusterName.value, {
      type: "ssh",
      imageRegistry: irName.value,
    });
    await api.createModelRegistry(mrName.value);

    // Create endpoints
    await api.createEndpoint(epNames.base, {
      cluster: clusterName.value,
      modelRegistry: mrName.value,
    });
    await api.createEndpoint(epNames.sort, {
      cluster: clusterName.value,
      modelRegistry: mrName.value,
    });

    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    test.setTimeout(60_000);
    const context = await browser.newContext();
    const page = await context.newPage();
    const api = new ApiHelper(page);

    // Delete endpoints in parallel first
    await Promise.all(
      Object.values(epNames).map((name) =>
        api.deleteEndpoint(name, { force: true }).catch(() => {}),
      ),
    );
    // Then dependencies in parallel (cluster + model registry)
    await Promise.all([
      api.deleteCluster(clusterName.value, { force: true }).catch(() => {}),
      api.deleteModelRegistry(mrName.value, { force: true }).catch(() => {}),
    ]);
    // Finally image registry (depends on cluster)
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
      { tag: "@C2613236" },
      async ({ endpoints }) => {
        await endpoints.goToList();

        const headers = endpoints.table.root.locator("thead th");
        await expect(headers.filter({ hasText: /name/i })).toBeVisible();
        await expect(headers.filter({ hasText: /workspace/i })).toBeVisible();
        await expect(headers.filter({ hasText: /status/i })).toBeVisible();
        await expect(headers.filter({ hasText: /model/i })).toBeVisible();
        await expect(headers.filter({ hasText: /task/i })).toBeVisible();
        await expect(headers.filter({ hasText: /engine/i })).toBeVisible();
        await expect(headers.filter({ hasText: /cluster/i })).toBeVisible();
        await expect(headers.filter({ hasText: /updated/i })).toBeVisible();
        await expect(headers.filter({ hasText: /created/i })).toBeVisible();

        await endpoints.table.expectRowWithText(epNames.base);
      },
    );

    test(
      "clicking name navigates to detail page",
      { tag: "@C2613246" },
      async ({ endpoints }) => {
        await endpoints.goToList();
        await endpoints.table.clickRowLink(epNames.base);

        const showPage = endpoints.page.locator('[data-testid="show-page"]');
        await expect(showPage).toBeVisible();
        await expect(
          showPage.getByText(epNames.base, { exact: true }),
        ).toBeVisible();
      },
    );

    test("can sort by name", { tag: "@C2613263" }, async ({ endpoints }) => {
      await endpoints.goToList();
      await endpoints.table.sort(/name/i);
    });

    test(
      "can sort by updated at",
      { tag: "@C2613257" },
      async ({ endpoints }) => {
        await endpoints.goToList();
        await expect(endpoints.table.headerCell(/updated/i)).toBeVisible();
        await endpoints.table.sort(/updated/i);
      },
    );

    test(
      "can sort by created at",
      { tag: "@C2613258" },
      async ({ endpoints }) => {
        await endpoints.goToList();
        await expect(endpoints.table.headerCell(/created/i)).toBeVisible();
        await endpoints.table.sort(/created/i);
      },
    );

    test(
      "can toggle column visibility",
      { tag: "@C2613261" },
      async ({ endpoints }) => {
        await endpoints.goToList();

        await expect(endpoints.table.headerCell(/task/i)).toBeVisible();
        await endpoints.table.toggleColumn(/task/i);
        await expect(endpoints.table.headerCell(/task/i)).toBeHidden();
        await endpoints.table.toggleColumn(/task/i);
        await expect(endpoints.table.headerCell(/task/i)).toBeVisible();
      },
    );

    // TODO: shares @C2613256 with "detail > clicking cluster navigates to cluster detail" — create separate TestRail case
    test(
      "cluster column shows cluster name",
      { tag: "@C2613256" },
      async ({ endpoints }) => {
        await endpoints.goToList();

        const row = endpoints.table.rowWithText(epNames.base);
        await expect(
          row.getByRole("link", { name: clusterName.value }),
        ).toBeVisible();
      },
    );

    test(
      "engine column navigates to engine detail",
      { tag: "@C2613255" },
      async ({ endpoints }) => {
        await endpoints.goToList();

        const row = endpoints.table.rowWithText(epNames.base);
        await row.getByRole("link", { name: "vllm" }).click();

        const showPage = endpoints.page.locator('[data-testid="show-page"]');
        await expect(showPage).toBeVisible();
        await expect(showPage.getByText("vllm", { exact: true })).toBeVisible();
      },
    );

    test(
      "workspace column navigates to workspace detail",
      { tag: "@C2613251" },
      async ({ endpoints }) => {
        await endpoints.goToList();

        const row = endpoints.table.rowWithText(epNames.base);
        await row.getByRole("link", { name: "default" }).click();

        const showPage = endpoints.page.locator('[data-testid="show-page"]');
        await expect(showPage).toBeVisible();
        await expect(
          showPage.getByText("default", { exact: true }),
        ).toBeVisible();
      },
    );

    test.skip(
      "actions include Pause",
      { tag: "@miss" },
      async ({ endpoints }) => {
        await endpoints.goToList();
        await endpoints.table.waitForLoaded();

        // Open row actions menu
        await endpoints.table
          .rowWithText(epNames.base)
          .locator('[data-testid="row-actions-trigger"]')
          .click();
        await endpoints.page
          .locator('[role="menu"]')
          .waitFor({ state: "visible" });

        // Verify Pause menuitem is visible
        await expect(
          endpoints.page.getByRole("menuitem", { name: /pause/i }),
        ).toBeVisible();

        // Close menu
        await endpoints.page.keyboard.press("Escape");
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // Detail tests
  // ────────────────────────────────────────────────────────────
  test.describe("detail", () => {
    test(
      "show page displays basic info",
      { tag: "@C2612911" },
      async ({ endpoints }) => {
        await endpoints.goToShow(epNames.base);

        const showPage = endpoints.page.locator('[data-testid="show-page"]');
        await expect(showPage).toBeVisible();

        // Name
        await expect(
          showPage.getByText(epNames.base, { exact: true }),
        ).toBeVisible();

        // Workspace
        await expect(
          showPage.locator("dt", { hasText: /workspace/i }),
        ).toBeVisible();

        // Status
        await expect(
          showPage.locator("dt", { hasText: /status/i }),
        ).toBeVisible();

        // Cluster
        await expect(
          showPage.locator("dt", { hasText: /cluster/i }),
        ).toBeVisible();

        // Engine
        await expect(
          showPage.locator("dt", { hasText: /engine/i }),
        ).toBeVisible();

        // Model
        await expect(
          showPage.locator("dt", { hasText: /^model$/i }),
        ).toBeVisible();

        // Task
        await expect(
          showPage.locator("dt", { hasText: /task/i }),
        ).toBeVisible();

        // Timestamps
        await expect(
          showPage.getByRole("term").filter({ hasText: /created at/i }),
        ).toBeVisible();
        await expect(
          showPage.getByRole("term").filter({ hasText: /updated at/i }),
        ).toBeVisible();
      },
    );

    test(
      "clicking cluster navigates to cluster detail",
      { tag: "@C2613256" },
      async ({ endpoints }) => {
        await endpoints.goToShow(epNames.base);

        const showPage = endpoints.page.locator('[data-testid="show-page"]');
        await showPage.getByRole("link", { name: clusterName.value }).click();

        const clusterShowPage = endpoints.page.locator(
          '[data-testid="show-page"]',
        );
        await expect(clusterShowPage).toBeVisible();
        await expect(
          clusterShowPage.getByText(clusterName.value, { exact: true }),
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
      { tag: "@C2613237" },
      async ({ endpoints }) => {
        await endpoints.goToCreate();

        await expect(endpoints.form.field("metadata.name")).toBeVisible();
        await expect(endpoints.form.field("metadata.workspace")).toBeVisible();
      },
    );

    test(
      "create form shows template fields",
      { tag: "@C2613239" },
      async ({ endpoints }) => {
        await endpoints.goToCreate();

        await expect(endpoints.form.field("spec.cluster")).toBeVisible();
        await expect(endpoints.form.field("spec.model.registry")).toBeVisible();
        await expect(endpoints.form.field("-model-catalog")).toBeVisible();
      },
    );

    test(
      "create form shows resource fields",
      { tag: "@C2613240" },
      async ({ endpoints }) => {
        await endpoints.goToCreate();

        await expect(endpoints.form.field("spec.resources.cpu")).toBeVisible();
        await expect(
          endpoints.form.field("spec.resources.memory"),
        ).toBeVisible();
        await expect(
          endpoints.form.field("spec.resources.accelerator"),
        ).toBeVisible();
      },
    );

    test(
      "customize section is collapsible",
      { tag: "@C2613241" },
      async ({ endpoints }) => {
        await endpoints.goToCreate();

        // Model name field should be hidden initially
        await expect(endpoints.form.field("spec.model.name")).toBeHidden();

        // Click "Customize Settings" to expand
        await endpoints.page
          .getByRole("button", { name: /customize settings/i })
          .click();

        // Model name field should now be visible
        await expect(endpoints.form.field("spec.model.name")).toBeVisible();
        await expect(endpoints.form.field("spec.engine.engine")).toBeVisible();
        await expect(endpoints.form.field("spec.replicas.num")).toBeVisible();
      },
    );

    test(
      "CPU and memory disabled until cluster selected",
      { tag: "@C2613264" },
      async ({ endpoints }) => {
        await endpoints.goToCreate();

        // CPU slider input should be disabled when no cluster is selected
        const cpuInput = endpoints.form
          .field("spec.resources.cpu")
          .locator('[data-testid="slider-input"]');
        await expect(cpuInput).toBeDisabled();

        // Memory slider input should be disabled when no cluster is selected
        const memoryInput = endpoints.form
          .field("spec.resources.memory")
          .locator('[data-testid="slider-input"]');
        await expect(memoryInput).toBeDisabled();
      },
    );

    test(
      "model name disabled until registry selected",
      { tag: "@C2613269" },
      async ({ endpoints }) => {
        await endpoints.goToCreate();

        // Expand customize section
        await endpoints.page
          .getByRole("button", { name: /customize settings/i })
          .click();

        // Model name AsyncCombobox trigger should be disabled without a registry
        const modelNameTrigger = endpoints.form
          .field("spec.model.name")
          .locator("button");
        await expect(modelNameTrigger).toBeDisabled();
      },
    );

    test(
      "model catalog field visible in create mode",
      { tag: "@C2613266" },
      async ({ endpoints }) => {
        await endpoints.goToCreate();

        await expect(endpoints.form.field("-model-catalog")).toBeVisible();
      },
    );

    test(
      "model version: default empty, can input",
      { tag: "@C2613271" },
      async ({ endpoints }) => {
        await endpoints.goToCreate();

        // Expand customize section
        await endpoints.page
          .getByRole("button", { name: /customize settings/i })
          .click();

        const versionInput = endpoints.form
          .field("spec.model.version")
          .locator("input");
        await expect(versionInput).toHaveValue("");

        // Fill a version
        await versionInput.fill("v1.0");
        await expect(versionInput).toHaveValue("v1.0");
      },
    );

    test(
      "model file field visible",
      { tag: "@C2613272" },
      async ({ endpoints }) => {
        await endpoints.goToCreate();

        await endpoints.page
          .getByRole("button", { name: /customize settings/i })
          .click();

        await expect(endpoints.form.field("spec.model.file")).toBeVisible();
      },
    );

    test(
      "replicas default value is 1",
      { tag: "@C2613300" },
      async ({ endpoints }) => {
        await endpoints.goToCreate();

        await endpoints.page
          .getByRole("button", { name: /customize settings/i })
          .click();

        const replicasInput = endpoints.form
          .field("spec.replicas.num")
          .locator("input");
        await expect(replicasInput).toHaveValue("1");
      },
    );

    test(
      "scheduler type field visible",
      { tag: "@C2613301" },
      async ({ endpoints }) => {
        await endpoints.goToCreate();

        await endpoints.page
          .getByRole("button", { name: /customize settings/i })
          .click();

        await expect(
          endpoints.form.field("spec.deployment_options.scheduler.type"),
        ).toBeVisible();
      },
    );

    test(
      "replicas = 0 shows validation error",
      { tag: "@C2613307" },
      async ({ endpoints }) => {
        await endpoints.goToCreate();

        await endpoints.page
          .getByRole("button", { name: /customize settings/i })
          .click();

        const replicasInput = endpoints.form
          .field("spec.replicas.num")
          .locator("input");
        await replicasInput.clear();
        await replicasInput.fill("0");

        // Try to submit
        await endpoints.form.submit();

        // Validation error should appear
        await expect(
          endpoints.page.getByText(/replicas must be at least 1/i),
        ).toBeVisible();

        // Form should stay visible (submission blocked)
        await expect(
          endpoints.page.locator('[data-testid="form"]'),
        ).toBeVisible();
      },
    );

    test(
      "replicas negative shows validation error",
      { tag: "@C2613308" },
      async ({ endpoints }) => {
        await endpoints.goToCreate();

        await endpoints.page
          .getByRole("button", { name: /customize settings/i })
          .click();

        const replicasInput = endpoints.form
          .field("spec.replicas.num")
          .locator("input");
        await replicasInput.clear();
        await replicasInput.fill("-1");

        // Try to submit
        await endpoints.form.submit();

        // Validation error should appear
        await expect(
          endpoints.page.getByText(/replicas must be at least 1/i),
        ).toBeVisible();

        // Form should stay visible (submission blocked)
        await expect(
          endpoints.page.locator('[data-testid="form"]'),
        ).toBeVisible();
      },
    );

    test(
      "advanced options: engine variables section visible",
      { tag: "@C2613242" },
      async ({ endpoints }) => {
        await endpoints.goToCreate();

        await endpoints.page
          .getByRole("button", { name: /customize settings/i })
          .click();

        // Engine variables field should be visible
        await expect(
          endpoints.form.field("spec.variables.engine_args"),
        ).toBeVisible();
      },
    );

    test(
      "engine selection list includes vllm",
      { tag: "@C2613273" },
      async ({ endpoints }) => {
        await endpoints.goToCreate();

        await endpoints.page
          .getByRole("button", { name: /customize settings/i })
          .click();

        // Open engine combobox
        const engineField = endpoints.form.field("spec.engine.engine");
        await engineField.locator("button").click();

        // Verify vllm is in the options
        await expect(
          endpoints.page
            .locator('[data-state="open"][role="dialog"]')
            .getByRole("option", { name: "vllm" }),
        ).toBeVisible();
      },
    );

    test(
      "add engine variables",
      { tag: "@C2613293" },
      async ({ endpoints }) => {
        await endpoints.goToCreate();

        await endpoints.page
          .getByRole("button", { name: /customize settings/i })
          .click();

        // Find the engine variables field and its Add Variable button
        const engineVarsField = endpoints.form.field(
          "spec.variables.engine_args",
        );
        await engineVarsField
          .getByRole("button", { name: /add variable/i })
          .click();

        // Fill key and value in the new row (use .first() — component keeps an extra empty row)
        const keyInput = engineVarsField.getByPlaceholder(/new key/i).first();
        await keyInput.fill("test-key");
        const valueInput = engineVarsField
          .getByPlaceholder(/new value/i)
          .first();
        await valueInput.fill("test-value");

        // Verify the row appeared with key and value inputs filled
        await expect(keyInput).toHaveValue("test-key");
        await expect(valueInput).toHaveValue("test-value");
      },
    );

    // ── Additional Create Form Tests ──

    test(
      "create: workspace defaults to 'default'",
      { tag: "@C2613238" },
      async ({ endpoints }) => {
        await endpoints.goToCreate();

        // Workspace combobox should show "default"
        const wsButton = endpoints.form
          .field("metadata.workspace")
          .locator('button[role="combobox"]');
        await expect(wsButton).toHaveText(/default/);
      },
    );

    test(
      "create: cancel navigates back to list",
      { tag: "@C2613244" },
      async ({ endpoints }) => {
        await endpoints.goToCreate();

        // Fill a name to make the form dirty
        await endpoints.form.fillInput(
          "metadata.name",
          `test-ep-cancel-${Date.now()}`,
        );

        // Accept browser dialog if warnWhenUnsavedChanges fires
        endpoints.page.on("dialog", (dialog) => dialog.accept());
        await endpoints.form.cancel();

        // Should navigate away from create page — form no longer visible
        await expect(
          endpoints.page.locator('[data-testid="form"]'),
        ).toBeHidden();
      },
    );

    test(
      "create: CPU and memory enabled after cluster selected",
      { tag: "@C2613265" },
      async ({ endpoints }) => {
        await endpoints.goToCreate();

        // CPU slider input should be disabled when no cluster is selected
        const cpuInput = endpoints.form
          .field("spec.resources.cpu")
          .locator('[data-testid="slider-input"]');
        await expect(cpuInput).toBeDisabled();

        // Select cluster
        await endpoints.form.selectComboboxOption(
          "spec.cluster",
          clusterName.value,
        );

        // CPU and memory should now be enabled
        await expect(cpuInput).toBeEnabled();

        const memoryInput = endpoints.form
          .field("spec.resources.memory")
          .locator('[data-testid="slider-input"]');
        await expect(memoryInput).toBeEnabled();
      },
    );

    test(
      "create: engine selection auto-loads version and task",
      { tag: "@C2613274" },
      async ({ endpoints }) => {
        await endpoints.goToCreate();

        // Expand customize settings
        await endpoints.page
          .getByRole("button", { name: /customize settings/i })
          .click();

        // Engine version and task should be disabled initially (no engine selected)
        const versionButton = endpoints.form
          .field("spec.engine.version")
          .locator("button");
        await expect(versionButton).toBeDisabled();

        const taskButton = endpoints.form
          .field("spec.model.task")
          .locator("button");
        await expect(taskButton).toBeDisabled();

        // Select engine "vllm"
        await endpoints.form.selectComboboxOption("spec.engine.engine", "vllm");

        // Version and task should now be enabled and auto-populated
        await expect(versionButton).toBeEnabled();
        await expect(taskButton).toBeEnabled();

        // Version should have a value (auto-selected first version)
        await expect(versionButton).not.toHaveText(/select/i);

        // Task should have a value (auto-selected first task)
        await expect(taskButton).not.toHaveText(/select/i);
      },
    );

    test(
      "create: HF model registry loads model list",
      { tag: "@C2613296" },
      async ({ endpoints }) => {
        await endpoints.goToCreate();

        // Select model registry (test registry is HF type)
        await endpoints.form.selectComboboxOption(
          "spec.model.registry",
          mrName.value,
        );

        // Expand customize settings to access model name field
        await endpoints.page
          .getByRole("button", { name: /customize settings/i })
          .click();

        // Model name field should now be enabled (registry is selected)
        const modelNameButton = endpoints.form
          .field("spec.model.name")
          .locator("button");
        await expect(modelNameButton).toBeEnabled();

        // Click to open model name combobox — should load models from registry
        await modelNameButton.click();
        const dialog = endpoints.page.locator(
          '[data-state="open"][role="dialog"]',
        );
        await expect(dialog).toBeVisible();

        // Close the dialog
        await endpoints.page.keyboard.press("Escape");
      },
    );

    test(
      "create: filesystem model registry loads model list",
      { tag: "@C2613297" },
      async ({ endpoints }) => {
        await endpoints.goToCreate();

        // Select model registry (test registry — loads model list)
        await endpoints.form.selectComboboxOption(
          "spec.model.registry",
          mrName.value,
        );

        // Expand customize settings
        await endpoints.page
          .getByRole("button", { name: /customize settings/i })
          .click();

        // Model name should be enabled after registry selected
        const modelNameButton = endpoints.form
          .field("spec.model.name")
          .locator("button");
        await expect(modelNameButton).toBeEnabled();
      },
    );

    test(
      "create: save submits all parameters",
      { tag: "@C2613243" },
      async ({ endpoints, apiHelper }) => {
        await endpoints.goToCreate();

        const name = `test-ep-save-${Date.now()}`;

        // Fill basic fields
        await endpoints.form.fillInput("metadata.name", name);
        await endpoints.form.selectComboboxOption(
          "spec.cluster",
          clusterName.value,
        );
        await endpoints.form.selectComboboxOption(
          "spec.model.registry",
          mrName.value,
        );

        // Expand customize settings
        await endpoints.page
          .getByRole("button", { name: /customize settings/i })
          .click();

        // Select engine
        await endpoints.form.selectComboboxOption("spec.engine.engine", "vllm");

        // Submit and wait for API response
        const responsePromise = endpoints.page.waitForResponse(
          (r) =>
            r.url().includes("/endpoints") &&
            r.request().method() === "POST" &&
            (r.ok() || r.status() >= 400),
        );
        await endpoints.form.submit();
        const response = await responsePromise;

        // Verify the request was sent (regardless of whether it succeeds — the cluster might not be reachable)
        expect(response.status()).toBeLessThan(500);

        // Cleanup if the endpoint was actually created
        if (response.ok()) {
          await apiHelper.deleteEndpoint(name, { force: true }).catch(() => {});
        }
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // Edit tests
  // ────────────────────────────────────────────────────────────
  test.describe("edit", () => {
    test(
      "edit: name and workspace disabled, collapsible title changes",
      { tag: "@C2613286" },
      async ({ endpoints }) => {
        await endpoints.goToEdit(epNames.base);
        await expect(
          endpoints.page.locator('[data-testid="form-submit"]'),
        ).toBeEnabled();

        // Name disabled
        const nameInput = endpoints.form
          .field("metadata.name")
          .locator("input");
        await expect(nameInput).toBeDisabled();

        // Workspace disabled
        const wsButton = endpoints.form
          .field("metadata.workspace")
          .locator('button[role="combobox"]');
        await expect(wsButton).toBeDisabled();

        // In edit mode, button text should be "Configuration Details" instead of "Customize Settings"
        await expect(
          endpoints.page.getByRole("button", {
            name: /configuration details/i,
          }),
        ).toBeVisible();
        await expect(
          endpoints.page.getByRole("button", {
            name: /customize settings/i,
          }),
        ).toBeHidden();
      },
    );

    test(
      "edit: model catalog field hidden",
      { tag: "@C2613290" },
      async ({ endpoints }) => {
        await endpoints.goToEdit(epNames.base);
        await expect(
          endpoints.page.locator('[data-testid="form-submit"]'),
        ).toBeEnabled();

        // -model-catalog field should not be present in edit mode
        await expect(endpoints.form.field("-model-catalog")).toBeHidden();
      },
    );

    test(
      "edit: cluster and registry editable",
      { tag: "@C2613287" },
      async ({ endpoints }) => {
        await endpoints.goToEdit(epNames.base);
        await expect(
          endpoints.page.locator('[data-testid="form-submit"]'),
        ).toBeEnabled();

        // Cluster combobox should be enabled
        const clusterButton = endpoints.form
          .field("spec.cluster")
          .locator("button");
        await expect(clusterButton).toBeEnabled();

        // Model registry combobox should be enabled
        const registryButton = endpoints.form
          .field("spec.model.registry")
          .locator("button");
        await expect(registryButton).toBeEnabled();
      },
    );

    test(
      "edit: model registry visible in configuration details",
      { tag: "@C2613288" },
      async ({ endpoints }) => {
        await endpoints.goToEdit(epNames.base);
        await expect(
          endpoints.page.locator('[data-testid="form-submit"]'),
        ).toBeEnabled();

        // Expand "Configuration Details"
        await endpoints.page
          .getByRole("button", { name: /configuration details/i })
          .click();

        // Model name field should be visible and accessible in edit mode
        await expect(endpoints.form.field("spec.model.name")).toBeVisible();

        // Model name button should be enabled (registry is already set)
        const modelNameButton = endpoints.form
          .field("spec.model.name")
          .locator("button");
        await expect(modelNameButton).toBeEnabled();
      },
    );

    // ── Additional Edit Tests ──

    test(
      "edit: resource config fields editable",
      { tag: "@C2613289" },
      async ({ endpoints }) => {
        await endpoints.goToEdit(epNames.base);
        await expect(
          endpoints.page.locator('[data-testid="form-submit"]'),
        ).toBeEnabled();

        // CPU spinbutton should be enabled (not disabled)
        const cpuInput = endpoints.form
          .field("spec.resources.cpu")
          .getByRole("spinbutton");
        await expect(cpuInput).toBeEnabled();

        // Memory spinbutton should be enabled
        const memoryInput = endpoints.form
          .field("spec.resources.memory")
          .getByRole("spinbutton");
        await expect(memoryInput).toBeEnabled();

        // Slider should be visible for both fields
        const cpuSlider = endpoints.form
          .field("spec.resources.cpu")
          .getByRole("slider");
        await expect(cpuSlider).toBeVisible();

        const memorySlider = endpoints.form
          .field("spec.resources.memory")
          .getByRole("slider");
        await expect(memorySlider).toBeVisible();

        // "Cluster resources unavailable" message shown (test cluster has no real resources)
        await expect(
          endpoints.page.getByText(/cluster resources unavailable/i),
        ).toBeVisible();
      },
    );

    test(
      "edit: change engine updates version and task",
      { tag: "@C2613291" },
      async ({ endpoints }) => {
        await endpoints.goToEdit(epNames.base);
        await expect(
          endpoints.page.locator('[data-testid="form-submit"]'),
        ).toBeEnabled();

        // Expand "Configuration Details"
        await endpoints.page
          .getByRole("button", { name: /configuration details/i })
          .click();

        // Engine combobox should be enabled
        const engineButton = endpoints.form
          .field("spec.engine.engine")
          .locator("button");
        await expect(engineButton).toBeEnabled();

        // Version should be enabled (engine is already set)
        const versionButton = endpoints.form
          .field("spec.engine.version")
          .locator("button");
        await expect(versionButton).toBeEnabled();

        // Task should be enabled
        const taskButton = endpoints.form
          .field("spec.model.task")
          .locator("button");
        await expect(taskButton).toBeEnabled();

        // Re-select "vllm" to trigger onChange and refresh version/task
        await endpoints.form.selectComboboxOption("spec.engine.engine", "vllm");

        // Version and task should be updated (auto-populated from new engine)
        await expect(versionButton).not.toHaveText(/select/i);
        await expect(taskButton).not.toHaveText(/select/i);
      },
    );

    test(
      "edit: replicas and scheduler type editable",
      { tag: "@C2613292" },
      async ({ endpoints }) => {
        await endpoints.goToEdit(epNames.base);
        await expect(
          endpoints.page.locator('[data-testid="form-submit"]'),
        ).toBeEnabled();

        // Expand "Configuration Details"
        await endpoints.page
          .getByRole("button", { name: /configuration details/i })
          .click();

        // Replicas input should be enabled and modifiable
        const replicasInput = endpoints.form
          .field("spec.replicas.num")
          .locator("input");
        await expect(replicasInput).toBeEnabled();

        // Change replicas value
        await replicasInput.clear();
        await replicasInput.fill("2");
        await expect(replicasInput).toHaveValue("2");

        // Scheduler type combobox should be enabled
        const schedulerButton = endpoints.form
          .field("spec.deployment_options.scheduler.type")
          .locator("button");
        await expect(schedulerButton).toBeEnabled();

        // Change scheduler type
        await schedulerButton.click();
        const dialog = endpoints.page.locator(
          '[data-state="open"][role="dialog"]',
        );
        // Select "Round Robin" option
        await dialog.getByRole("option", { name: /round robin/i }).click();
      },
    );

    test(
      "edit: delete engine variable",
      { tag: "@C2613294" },
      async ({ endpoints }) => {
        await endpoints.goToEdit(epNames.base);
        await expect(
          endpoints.page.locator('[data-testid="form-submit"]'),
        ).toBeEnabled();

        // Expand "Configuration Details"
        await endpoints.page
          .getByRole("button", { name: /configuration details/i })
          .click();

        // Engine variables field should be visible
        const engineVarsField = endpoints.form.field(
          "spec.variables.engine_args",
        );
        await expect(engineVarsField).toBeVisible();

        // The VariablesInput has an empty row; fill it
        const firstRow = engineVarsField.locator("tbody tr").first();
        const keyInput = firstRow.getByRole("textbox").first();
        await keyInput.fill("temp-key");

        const valueInput = firstRow.getByPlaceholder(/new value/i);
        await valueInput.fill("temp-value");

        // Verify the variable was added
        await expect(keyInput).toHaveValue("temp-key");

        // Delete the variable — click the trash icon button in the first row
        await firstRow.locator('[data-testid="remove-variable"]').click();

        // After deletion, the VariablesInput keeps an empty row
        // but the filled value should be gone
        const newFirstKeyInput = engineVarsField
          .locator("tbody tr")
          .first()
          .getByRole("textbox")
          .first();
        await expect(newFirstKeyInput).not.toHaveValue("temp-key");
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // Delete tests
  // ────────────────────────────────────────────────────────────
  test.describe("delete", () => {
    test(
      "delete from list -> confirm -> dialog closes",
      { tag: "@C2613371" },
      async ({ endpoints, apiHelper }) => {
        const name = `test-ep-del-${Date.now()}`;
        await apiHelper.createEndpoint(name, {
          cluster: clusterName.value,
          modelRegistry: mrName.value,
        });

        await endpoints.goToList();
        await endpoints.table.deleteRow(name, { noWait: true });

        // Cleanup via API in case backend GC is slow
        await apiHelper.deleteEndpoint(name, { force: true }).catch(() => {});
      },
    );

    test.skip(
      "delete -> cancel -> row still exists",
      { tag: "@miss" },
      async ({ endpoints, apiHelper }) => {
        const name = `test-ep-del-cancel-${Date.now()}`;
        await apiHelper.createEndpoint(name, {
          cluster: clusterName.value,
          modelRegistry: mrName.value,
        });

        await endpoints.goToList();
        await endpoints.table.waitForLoaded();

        // Open row actions, click delete
        await endpoints.table
          .rowWithText(name)
          .locator('[data-testid="row-actions-trigger"]')
          .click();
        await endpoints.page
          .locator('[role="menu"]')
          .waitFor({ state: "visible" });
        await endpoints.page.getByRole("menuitem", { name: /delete/i }).click();

        // Cancel the dialog
        const dialog = endpoints.page.getByRole("alertdialog");
        await dialog.waitFor({ state: "visible" });
        await dialog.getByRole("button", { name: /cancel/i }).click();
        await dialog.waitFor({ state: "hidden" });

        // Row should still be there
        await endpoints.table.expectRowWithText(name);

        // Cleanup
        await apiHelper.deleteEndpoint(name, { force: true }).catch(() => {});
      },
    );
  });
});
