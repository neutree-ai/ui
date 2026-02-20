import { expect, test } from "../fixtures/base";
import { ApiHelper } from "../helpers/api-helper";
import { CONNECTION_TIMEOUT, MULTI_USER_TIMEOUT } from "../helpers/constants";
import { ResourcePage } from "../helpers/resource-page";

// ── Shared test data created once in beforeAll ──
const mrNames = {
  base: "", // HuggingFace public (list/detail/edit tests)
  sort: "", // second item for sort ordering
  fail: "", // bad URL → Failed status
  conn: "", // HuggingFace valid → Connected status
};

test.describe("model registries", () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const api = new ApiHelper(page);

    const ts = Date.now();
    mrNames.base = `test-mr-base-${ts}`;
    mrNames.sort = `test-mr-sort-${ts}`;
    mrNames.fail = `test-mr-fail-${ts}`;
    mrNames.conn = `test-mr-conn-${ts}`;

    await api.createModelRegistry(mrNames.base);
    await api.createModelRegistry(mrNames.sort, {
      url: "https://huggingface.co/models",
    });
    await api.createModelRegistry(mrNames.fail, {
      url: "https://fake-hf-registry.invalid",
    });
    await api.createModelRegistry(mrNames.conn, {
      url: "https://huggingface.co",
    });

    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const api = new ApiHelper(page);

    for (const name of Object.values(mrNames)) {
      await api.deleteModelRegistry(name).catch(() => {});
    }
    await context.close();
  });

  // ────────────────────────────────────────────────────────────
  // List tests
  // ────────────────────────────────────────────────────────────
  test.describe("list", () => {
    test(
      "list page shows expected columns",
      { tag: "@C2612576" },
      async ({ modelRegistries }) => {
        await modelRegistries.goToList();

        const headers = modelRegistries.table.root.locator("thead th");
        await expect(headers.filter({ hasText: /name/i })).toBeVisible();
        await expect(headers.filter({ hasText: /workspace/i })).toBeVisible();
        await expect(headers.filter({ hasText: /status/i })).toBeVisible();
        await expect(headers.filter({ hasText: /type/i })).toBeVisible();
        await expect(headers.filter({ hasText: /updated/i })).toBeVisible();
        await expect(headers.filter({ hasText: /created/i })).toBeVisible();

        await modelRegistries.table.expectRowWithText(mrNames.base);
      },
    );

    test(
      "clicking name navigates to detail page",
      { tag: "@C2612584" },
      async ({ modelRegistries }) => {
        await modelRegistries.goToList();
        await modelRegistries.table.clickRowLink(mrNames.base);

        const showPage = modelRegistries.page.locator(
          '[data-testid="show-page"]',
        );
        await expect(showPage).toBeVisible();
        await expect(
          showPage.getByText(mrNames.base, { exact: true }),
        ).toBeVisible();
      },
    );

    test(
      "can sort by name",
      { tag: "@C2612594" },
      async ({ modelRegistries }) => {
        await modelRegistries.goToList();
        await modelRegistries.table.sort(/name/i);
      },
    );

    test(
      "clicking workspace navigates to workspace detail",
      { tag: "@C2612585" },
      async ({ modelRegistries }) => {
        await modelRegistries.goToList();

        const row = modelRegistries.table.rowWithText(mrNames.base);
        await row.getByRole("link", { name: "default" }).click();

        const showPage = modelRegistries.page.locator(
          '[data-testid="show-page"]',
        );
        await expect(showPage).toBeVisible();
        await expect(
          showPage.getByText("default", { exact: true }),
        ).toBeVisible();
      },
    );

    test(
      "status column shows Connected for valid HuggingFace URL",
      { tag: "@C2612586" },
      async ({ modelRegistries }) => {
        await modelRegistries.goToList();

        const row = modelRegistries.table.rowWithText(mrNames.conn);
        await expect(row.getByText("Connected")).toBeVisible({
          timeout: CONNECTION_TIMEOUT,
        });
      },
    );

    test(
      "status column shows Failed for invalid URL",
      { tag: "@C2612603" },
      async ({ modelRegistries }) => {
        await modelRegistries.goToList();

        const row = modelRegistries.table.rowWithText(mrNames.fail);
        await expect(row.getByText("Failed")).toBeVisible({
          timeout: CONNECTION_TIMEOUT,
        });
      },
    );

    test(
      "type column shows Hugging Face",
      { tag: "@C2612587" },
      async ({ modelRegistries }) => {
        await modelRegistries.goToList();

        const row = modelRegistries.table.rowWithText(mrNames.base);
        await expect(row.getByText("Hugging Face")).toBeVisible();
      },
    );

    test(
      "can sort by updated at and timestamp is displayed",
      { tag: "@C2612588" },
      async ({ modelRegistries }) => {
        await modelRegistries.goToList();
        await expect(
          modelRegistries.table.headerCell(/updated/i),
        ).toBeVisible();
        await modelRegistries.table.sort(/updated/i);
      },
    );

    test(
      "can sort by created at and timestamp is displayed",
      { tag: "@C2612589" },
      async ({ modelRegistries }) => {
        await modelRegistries.goToList();
        await expect(
          modelRegistries.table.headerCell(/created/i),
        ).toBeVisible();
        await modelRegistries.table.sort(/created/i);
      },
    );

    test(
      "can toggle column visibility",
      { tag: "@C2612592" },
      async ({ modelRegistries }) => {
        await modelRegistries.goToList();

        await expect(modelRegistries.table.headerCell(/status/i)).toBeVisible();
        await modelRegistries.table.toggleColumn(/status/i);
        await expect(modelRegistries.table.headerCell(/status/i)).toBeHidden();
        await modelRegistries.table.toggleColumn(/status/i);
        await expect(modelRegistries.table.headerCell(/status/i)).toBeVisible();
      },
    );

    test(
      "admin user sees all registries",
      { tag: "@C2612552" },
      async ({ modelRegistries }) => {
        await modelRegistries.goToList();
        const rowCount = await modelRegistries.table.rows().count();
        expect(rowCount).toBeGreaterThan(0);
        await modelRegistries.table.expectRowWithText(mrNames.base);
      },
    );

    test(
      "clicking Failed status shows error message",
      { tag: "@C2613788" },
      async ({ modelRegistries }) => {
        await modelRegistries.goToList();

        const row = modelRegistries.table.rowWithText(mrNames.fail);
        await expect(row.getByText("Failed")).toBeVisible({
          timeout: CONNECTION_TIMEOUT,
        });

        // Click the Failed badge to see error details (tooltip)
        await row.getByText("Failed").click();

        // Error message should be visible (in a tooltip)
        await expect(
          modelRegistries.page.getByText(/error|fail|connect/i).first(),
        ).toBeVisible();
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // Detail tests
  // ────────────────────────────────────────────────────────────
  test.describe("detail", () => {
    test(
      "show page displays name, workspace, status, timestamps, type, and URL",
      { tag: "@C2612600" },
      async ({ modelRegistries }) => {
        await modelRegistries.goToShow(mrNames.base);

        const showPage = modelRegistries.page.locator(
          '[data-testid="show-page"]',
        );
        await expect(showPage).toBeVisible();

        // Name
        await expect(
          showPage.getByText(mrNames.base, { exact: true }),
        ).toBeVisible();

        // Workspace
        const workspaceDt = showPage.locator("dt", {
          hasText: /workspace/i,
        });
        await expect(workspaceDt).toBeVisible();

        // Status
        const statusDt = showPage.locator("dt", { hasText: /^status$/i });
        await expect(statusDt).toBeVisible();

        // Timestamps
        await expect(
          showPage.getByRole("term").filter({ hasText: /created at/i }),
        ).toBeVisible();
        await expect(
          showPage.getByRole("term").filter({ hasText: /updated at/i }),
        ).toBeVisible();

        // Type
        const typeDt = showPage.locator("dt", { hasText: /^type$/i });
        await expect(typeDt).toBeVisible();

        // URL
        await expect(
          showPage.getByText("https://huggingface.co"),
        ).toBeVisible();
      },
    );

    test(
      "clicking workspace navigates to workspace detail",
      { tag: "@C2612601" },
      async ({ modelRegistries }) => {
        await modelRegistries.goToShow(mrNames.base);

        const showPage = modelRegistries.page.locator(
          '[data-testid="show-page"]',
        );
        await showPage.getByRole("link", { name: "default" }).click();

        const wsShowPage = modelRegistries.page.locator(
          '[data-testid="show-page"]',
        );
        await expect(wsShowPage).toBeVisible();
        await expect(
          wsShowPage.getByText("default", { exact: true }),
        ).toBeVisible();
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // Create tests
  // ────────────────────────────────────────────────────────────
  test.describe("create", () => {
    test(
      "name format: must be lowercase alphanumeric + '-' / '.'",
      { tag: "@C2612577" },
      async ({ modelRegistries }) => {
        await modelRegistries.goToCreate();

        await modelRegistries.form.fillInput("metadata.name", "INVALID_NAME");
        await modelRegistries.form.fillInput(
          "spec.url",
          "https://huggingface.co",
        );

        // Server-side validation rejects invalid name format
        const responsePromise = modelRegistries.page.waitForResponse(
          (resp) =>
            resp.url().includes("model_registries") &&
            resp.request().method() === "POST",
        );
        await modelRegistries.form.submit();
        const response = await responsePromise;
        expect(response.status()).toBeGreaterThanOrEqual(400);

        // Form stays visible (no redirect)
        await expect(modelRegistries.form.root).toBeVisible();
      },
    );

    test(
      "name empty → cannot save",
      { tag: "@C2612606" },
      async ({ modelRegistries }) => {
        await modelRegistries.goToCreate();

        // Leave name empty, fill other required fields
        await modelRegistries.form.fillInput(
          "spec.url",
          "https://huggingface.co",
        );

        const responsePromise = modelRegistries.page.waitForResponse(
          (resp) =>
            resp.url().includes("model_registries") &&
            resp.request().method() === "POST",
        );
        await modelRegistries.form.submit();
        const response = await responsePromise;
        expect(response.status()).toBeGreaterThanOrEqual(400);

        await expect(modelRegistries.form.root).toBeVisible();
      },
    );

    test(
      "workspace binding works for default workspace",
      { tag: "@C2612578" },
      async ({ modelRegistries }) => {
        await modelRegistries.goToCreate();

        const wsField = modelRegistries.form.field("metadata.workspace");
        await expect(wsField.getByText("default")).toBeVisible();
      },
    );

    test(
      "workspace required",
      { tag: "@C2612605" },
      async ({ modelRegistries }) => {
        await modelRegistries.goToCreate();

        const wsField = modelRegistries.form.field("metadata.workspace");
        await expect(wsField).toBeVisible();
      },
    );

    test(
      "type selector shows HuggingFace and File System options",
      { tag: "@C2612579" },
      async ({ modelRegistries }) => {
        await modelRegistries.goToCreate();

        const typeField = modelRegistries.form.field("spec.type");
        await expect(typeField).toBeVisible();

        // Open the select dropdown
        await typeField.locator('button[role="combobox"]').click();

        // Verify both options are available
        await expect(
          modelRegistries.page.getByRole("option", {
            name: /hugging face/i,
          }),
        ).toBeVisible();
        await expect(
          modelRegistries.page.getByRole("option", {
            name: /file system/i,
          }),
        ).toBeVisible();
      },
    );

    test(
      "URL required → client validation",
      { tag: "@C2612604" },
      async ({ modelRegistries }) => {
        await modelRegistries.goToCreate();

        await modelRegistries.form.fillInput("metadata.name", "test-mr-url");

        // Leave URL empty and submit
        await modelRegistries.form.submit();

        // Client-side validation shows error message
        await expect(
          modelRegistries.page.getByText(/url is required/i),
        ).toBeVisible();

        // Form stays visible
        await expect(modelRegistries.form.root).toBeVisible();
      },
    );

    test(
      "save → all params visible on detail page",
      { tag: "@C2612582" },
      async ({ modelRegistries, apiHelper }) => {
        const name = `test-mr-params-${Date.now()}`;
        await modelRegistries.goToCreate();

        await modelRegistries.form.fillInput("metadata.name", name);
        await modelRegistries.form.fillInput(
          "spec.url",
          "https://huggingface.co",
        );
        await modelRegistries.form.submit();

        // Redirects to list → navigate to show page
        await modelRegistries.table.waitForLoaded();
        await modelRegistries.table.clickRowLink(name);

        const showPage = modelRegistries.page.locator(
          '[data-testid="show-page"]',
        );
        await expect(showPage).toBeVisible();
        await expect(showPage.getByText(name, { exact: true })).toBeVisible();
        await expect(
          showPage.getByText("https://huggingface.co"),
        ).toBeVisible();
        await expect(showPage.getByText("Hugging Face")).toBeVisible();

        // Cleanup
        await apiHelper.deleteModelRegistry(name).catch(() => {});
      },
    );

    test(
      "cancel → no registry created",
      { tag: "@C2612583" },
      async ({ modelRegistries }) => {
        const name = `test-mr-cancel-${Date.now()}`;

        // Go to list first, then click Create so "back" returns to list
        await modelRegistries.goToList();
        await modelRegistries.clickCreate();

        await modelRegistries.form.fillInput("metadata.name", name);
        await modelRegistries.form.fillInput(
          "spec.url",
          "https://huggingface.co",
        );

        // Accept browser dialog if warnWhenUnsavedChanges fires
        modelRegistries.page.on("dialog", (dialog) => dialog.accept());
        await modelRegistries.form.cancel();

        // Should navigate back to list
        await modelRegistries.table.waitForLoaded();
        await modelRegistries.table.expectNoRowWithText(name);
      },
    );

    test(
      "admin user can create",
      { tag: "@C2613121" },
      async ({ modelRegistries, apiHelper }) => {
        const name = `test-mr-admin-${Date.now()}`;
        await modelRegistries.goToCreate();

        await modelRegistries.form.fillInput("metadata.name", name);
        await modelRegistries.form.fillInput(
          "spec.url",
          "https://huggingface.co",
        );
        await modelRegistries.form.submit();

        // Redirects to list → row should exist
        await modelRegistries.table.waitForLoaded();
        await modelRegistries.table.expectRowWithText(name);

        // Cleanup
        await apiHelper.deleteModelRegistry(name).catch(() => {});
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // Edit tests
  // ────────────────────────────────────────────────────────────
  test.describe("edit", () => {
    test(
      "type can be changed in edit mode",
      { tag: "@C2612595" },
      async ({ modelRegistries }) => {
        await modelRegistries.goToEdit(mrNames.base);
        await expect(
          modelRegistries.page.locator('[data-testid="form-submit"]'),
        ).toBeEnabled();

        const typeField = modelRegistries.form.field("spec.type");
        await expect(typeField).toBeVisible();

        // Type select should be editable (not disabled)
        const typeButton = typeField.locator('button[role="combobox"]');
        await expect(typeButton).toBeEnabled();
      },
    );

    test(
      "name and workspace fields disabled in edit",
      { tag: "@C2612598" },
      async ({ modelRegistries }) => {
        await modelRegistries.goToEdit(mrNames.base);
        await expect(
          modelRegistries.page.locator('[data-testid="form-submit"]'),
        ).toBeEnabled();

        const nameInput = modelRegistries.form
          .field("metadata.name")
          .locator("input");
        await expect(nameInput).toBeDisabled();

        const wsField = modelRegistries.form.field("metadata.workspace");
        const wsButton = wsField.locator('button[role="combobox"]');
        await expect(wsButton).toBeDisabled();
      },
    );

    test(
      "admin user can edit",
      { tag: "@C2613125" },
      async ({ modelRegistries, apiHelper }) => {
        const name = `test-mr-admedit-${Date.now()}`;
        await apiHelper.createModelRegistry(name);

        await modelRegistries.goToEdit(name);
        await expect(
          modelRegistries.page.locator('[data-testid="form-submit"]'),
        ).toBeEnabled();

        await modelRegistries.form.fillInput(
          "spec.url",
          "https://huggingface.co/models",
        );
        await modelRegistries.form.submit();

        // Edit redirects to list → use direct navigation to avoid cache
        await modelRegistries.table.waitForLoaded();
        await modelRegistries.goToShow(name);

        const showPage = modelRegistries.page.locator(
          '[data-testid="show-page"]',
        );
        await expect(showPage).toBeVisible();
        await expect(
          showPage.getByText("https://huggingface.co/models"),
        ).toBeVisible();

        // Cleanup
        await apiHelper.deleteModelRegistry(name).catch(() => {});
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // Delete tests
  // ────────────────────────────────────────────────────────────
  test.describe("delete", () => {
    test(
      "delete from list → confirm → row disappears",
      { tag: "@C2612607" },
      async ({ modelRegistries, apiHelper }) => {
        const name = `test-mr-del-${Date.now()}`;
        await apiHelper.createModelRegistry(name);

        await modelRegistries.goToList();
        await modelRegistries.table.deleteRow(name);
        await modelRegistries.table.expectNoRowWithText(name);
      },
    );

    test(
      "delete → cancel → row still exists",
      { tag: "@C2612608" },
      async ({ modelRegistries, apiHelper }) => {
        const name = `test-mr-del-cancel-${Date.now()}`;
        await apiHelper.createModelRegistry(name);

        await modelRegistries.goToList();
        await modelRegistries.table.waitForLoaded();

        // Open row actions, click delete
        await modelRegistries.table
          .rowWithText(name)
          .locator('[data-testid="row-actions-trigger"]')
          .click();
        await modelRegistries.page
          .locator('[role="menu"]')
          .waitFor({ state: "visible" });
        await modelRegistries.page
          .getByRole("menuitem", { name: /delete/i })
          .click();

        // Cancel the dialog
        const dialog = modelRegistries.page.getByRole("alertdialog");
        await dialog.waitFor({ state: "visible" });
        await dialog.getByRole("button", { name: /cancel/i }).click();
        await dialog.waitFor({ state: "hidden" });

        // Row should still be there
        await modelRegistries.table.expectRowWithText(name);

        // Cleanup
        await apiHelper.deleteModelRegistry(name).catch(() => {});
      },
    );

    test(
      "admin user can delete",
      { tag: "@C2613129" },
      async ({ modelRegistries, apiHelper }) => {
        const name = `test-mr-admdel-${Date.now()}`;
        await apiHelper.createModelRegistry(name);

        await modelRegistries.goToList();
        await modelRegistries.table.deleteRow(name);
        await modelRegistries.table.expectNoRowWithText(name);
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // Connection and status tests
  // ────────────────────────────────────────────────────────────
  test.describe("connection and status", () => {
    test(
      "create → initial status shows '-' or Pending",
      { tag: "@C2613138" },
      async ({ modelRegistries, apiHelper }) => {
        const name = `test-mr-pending-${Date.now()}`;

        // Go to list first so create → back goes to list
        await modelRegistries.goToList();
        await modelRegistries.clickCreate();

        await modelRegistries.form.fillInput("metadata.name", name);
        await modelRegistries.form.fillInput(
          "spec.url",
          "https://huggingface.co",
        );
        await modelRegistries.form.submit();

        // Redirects to list → check initial status
        await modelRegistries.table.waitForLoaded();
        const row = modelRegistries.table.rowWithText(name);
        await expect(row).toBeVisible();

        // Status should be "-" or "Pending" initially (not yet Connected/Failed)
        await expect(row.getByText("Connected")).toBeHidden();
        await expect(row.getByText("Failed")).toBeHidden();

        // Cleanup
        await apiHelper.deleteModelRegistry(name).catch(() => {});
      },
    );

    test(
      "valid HuggingFace URL → status becomes Connected",
      { tag: "@C2613139" },
      async ({ modelRegistries }) => {
        await modelRegistries.goToList();

        const row = modelRegistries.table.rowWithText(mrNames.conn);
        await expect(row.getByText("Connected")).toBeVisible({
          timeout: CONNECTION_TIMEOUT,
        });
      },
    );

    test(
      "invalid URL → status becomes Failed",
      { tag: "@C2613140" },
      async ({ modelRegistries }) => {
        await modelRegistries.goToList();

        const row = modelRegistries.table.rowWithText(mrNames.fail);
        await expect(row.getByText("Failed")).toBeVisible({
          timeout: CONNECTION_TIMEOUT,
        });
      },
    );

    test(
      "Failed → fix URL → status becomes Connected",
      { tag: "@C2613141" },
      async ({ modelRegistries, apiHelper }) => {
        const name = `test-mr-reconnect-${Date.now()}`;
        await apiHelper.createModelRegistry(name, {
          url: "https://fake-hf.invalid",
        });

        await modelRegistries.goToList();

        // Wait for Failed status
        const row = modelRegistries.table.rowWithText(name);
        await expect(row.getByText("Failed")).toBeVisible({
          timeout: CONNECTION_TIMEOUT,
        });

        // Edit to fix the URL
        await modelRegistries.table.editRow(name);
        await expect(
          modelRegistries.page.locator('[data-testid="form-submit"]'),
        ).toBeEnabled();
        await modelRegistries.form.fillInput(
          "spec.url",
          "https://huggingface.co",
        );
        await modelRegistries.form.submit();

        // Wait for Connected status
        await modelRegistries.table.waitForLoaded();
        const updatedRow = modelRegistries.table.rowWithText(name);
        await expect(updatedRow.getByText("Connected")).toBeVisible({
          timeout: CONNECTION_TIMEOUT,
        });

        // Cleanup
        await apiHelper.deleteModelRegistry(name).catch(() => {});
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // Security tests
  // ────────────────────────────────────────────────────────────
  test.describe("security", () => {
    test(
      "edit form: credentials field always empty (not pre-filled)",
      { tag: "@C2613135" },
      async ({ modelRegistries, apiHelper }) => {
        const name = `test-mr-secret-${Date.now()}`;
        await apiHelper.createModelRegistry(name, {
          credentials: "hf_test_token_12345",
        });

        await modelRegistries.goToEdit(name);
        await expect(
          modelRegistries.page.locator('[data-testid="form-submit"]'),
        ).toBeEnabled();

        const credInput = modelRegistries.form
          .field("spec.credentials")
          .locator("input");
        await expect(credInput).toHaveAttribute("type", "password");

        // Credentials should NOT be pre-filled (backend should not return them)
        const credValue = await credInput.inputValue();
        expect(credValue).toBe("");

        // "Leave empty to keep value" message should be visible
        await expect(
          modelRegistries.page.getByText(/leave empty to keep/i).first(),
        ).toBeVisible();

        // Cleanup
        modelRegistries.page.on("dialog", (dialog) => dialog.accept());
        await apiHelper.deleteModelRegistry(name).catch(() => {});
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // List permissions (multi-user)
  // ────────────────────────────────────────────────────────────
  test.describe("list permissions", () => {
    test(
      "non-admin with global model_registry:read can see list",
      {
        tag: "@C2612553",
        annotation: {
          type: "slow",
          description: "creates test user with model_registry:read permission",
        },
      },
      async ({ createTestUser }, testInfo) => {
        testInfo.setTimeout(MULTI_USER_TIMEOUT);

        const testUser = await createTestUser(["model_registry:read"]);
        const mrPage = new ResourcePage(testUser.page, {
          routeName: "model-registries",
          workspaced: true,
        });

        await mrPage.goToList();

        // User with model_registry:read should see registry rows
        const rowCount = await mrPage.table.rows().count();
        expect(rowCount).toBeGreaterThan(0);
      },
    );

    test(
      "non-admin without model_registry:read sees empty list",
      {
        tag: "@C2613120",
        annotation: {
          type: "slow",
          description:
            "creates test user without model_registry:read permission",
        },
      },
      async ({ createTestUser }, testInfo) => {
        testInfo.setTimeout(MULTI_USER_TIMEOUT);

        // Give an unrelated permission so the user can log in
        const testUser = await createTestUser(["role:read"]);
        const mrPage = new ResourcePage(testUser.page, {
          routeName: "model-registries",
          workspaced: true,
        });

        await testUser.page.goto("/#/default/model-registries");
        await mrPage.table.waitForLoaded();

        // User without model_registry:read should see empty table
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
      "non-admin with global model_registry:create can create",
      {
        tag: ["@C2613122", "@C2613123"],
        annotation: {
          type: "slow",
          description:
            "creates test user with model_registry:read+create permissions",
        },
      },
      async ({ createTestUser, apiHelper }, testInfo) => {
        testInfo.setTimeout(MULTI_USER_TIMEOUT);

        const testUser = await createTestUser([
          "model_registry:read",
          "model_registry:create",
        ]);
        const mrPage = new ResourcePage(testUser.page, {
          routeName: "model-registries",
          workspaced: true,
        });

        const name = `test-mr-glb-new-${Date.now()}`;
        await mrPage.goToCreate();
        await mrPage.form.fillInput("metadata.name", name);
        await mrPage.form.fillInput("spec.url", "https://huggingface.co");
        await mrPage.form.submit();

        // Should redirect to list
        await mrPage.table.waitForLoaded();
        await mrPage.table.expectRowWithText(name);

        // Cleanup
        await apiHelper.deleteModelRegistry(name).catch(() => {});
      },
    );

    test(
      "non-admin without model_registry:create cannot create",
      {
        tag: "@C2613124",
        annotation: {
          type: "slow",
          description: "creates test user with model_registry:read only",
        },
      },
      async ({ createTestUser }, testInfo) => {
        testInfo.setTimeout(MULTI_USER_TIMEOUT);

        const testUser = await createTestUser(["model_registry:read"]);
        const mrPage = new ResourcePage(testUser.page, {
          routeName: "model-registries",
          workspaced: true,
        });

        const name = `test-mr-no-new-${Date.now()}`;
        await mrPage.goToCreate();
        await mrPage.form.fillInput("metadata.name", name);
        await mrPage.form.fillInput("spec.url", "https://huggingface.co");

        const responsePromise = testUser.page.waitForResponse(
          (r) =>
            r.url().includes("/model_registries") &&
            r.request().method() === "POST" &&
            !r.ok(),
        );
        await mrPage.form.submit();
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
      "non-admin with global model_registry:update can edit",
      {
        tag: ["@C2613126", "@C2613127"],
        annotation: {
          type: "slow",
          description:
            "creates test user with model_registry:read+update permissions",
        },
      },
      async ({ createTestUser, apiHelper }, testInfo) => {
        testInfo.setTimeout(MULTI_USER_TIMEOUT);

        const name = `test-mr-glb-upd-${Date.now()}`;
        await apiHelper.createModelRegistry(name);

        const testUser = await createTestUser([
          "model_registry:read",
          "model_registry:update",
        ]);
        const mrPage = new ResourcePage(testUser.page, {
          routeName: "model-registries",
          workspaced: true,
        });

        await mrPage.goToEdit(name);
        await expect(
          testUser.page.locator('[data-testid="form-submit"]'),
        ).toBeEnabled();

        await mrPage.form.fillInput(
          "spec.url",
          "https://huggingface.co/models",
        );
        await mrPage.form.submit();

        // Should redirect to list
        await mrPage.table.waitForLoaded();
        await mrPage.table.expectRowWithText(name);

        // Cleanup
        await apiHelper.deleteModelRegistry(name).catch(() => {});
      },
    );

    test(
      "non-admin without model_registry:update cannot edit",
      {
        tag: "@C2613128",
        annotation: {
          type: "slow",
          description: "creates test user with model_registry:read only",
        },
      },
      async ({ createTestUser, apiHelper }, testInfo) => {
        testInfo.setTimeout(MULTI_USER_TIMEOUT);

        const name = `test-mr-no-upd-${Date.now()}`;
        await apiHelper.createModelRegistry(name);

        const testUser = await createTestUser(["model_registry:read"]);
        const mrPage = new ResourcePage(testUser.page, {
          routeName: "model-registries",
          workspaced: true,
        });

        await mrPage.goToEdit(name);
        await expect(
          testUser.page.locator('[data-testid="form-submit"]'),
        ).toBeEnabled();

        await mrPage.form.fillInput(
          "spec.url",
          "https://huggingface.co/models",
        );
        await mrPage.form.submit();

        // Should show error (permission denied)
        await expect(
          testUser.page.getByText(/error|denied|forbidden|fail/i).first(),
        ).toBeVisible({ timeout: 10_000 });

        // Cleanup
        await apiHelper.deleteModelRegistry(name).catch(() => {});
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // Delete dependency tests
  // ────────────────────────────────────────────────────────────
  test.describe("delete dependency", () => {
    test(
      "delete blocked when endpoint references model registry",
      { tag: "@C2612544" },
      async ({ modelRegistries, apiHelper }, testInfo) => {
        testInfo.setTimeout(90_000);

        const ts = Date.now();
        const irName = `test-ir-mrdep-${ts}`;
        const clName = `test-cl-mrdep-${ts}`;
        const mrName = `test-mr-dep-${ts}`;
        const epName = `test-ep-mrdep-${ts}`;

        // Create full dependency chain: IR → Cluster, MR, Endpoint (references cluster + MR)
        await apiHelper.createImageRegistry(irName);
        await apiHelper.createCluster(clName, { imageRegistry: irName });
        await apiHelper.createModelRegistry(mrName);
        await apiHelper.createEndpoint(epName, {
          cluster: clName,
          modelRegistry: mrName,
        });

        await modelRegistries.goToList();
        await modelRegistries.table.waitForLoaded();

        // Attempt to delete the model registry
        await modelRegistries.table
          .rowWithText(mrName)
          .locator('[data-testid="row-actions-trigger"]')
          .click();
        await modelRegistries.page
          .locator('[role="menu"]')
          .waitFor({ state: "visible" });
        await modelRegistries.page
          .getByRole("menuitem", { name: /delete/i })
          .click();

        // Confirm deletion
        const dialog = modelRegistries.page.getByRole("alertdialog");
        await dialog.waitFor({ state: "visible" });
        await dialog.getByRole("button", { name: /delete/i }).click();
        await dialog.waitFor({ state: "hidden" });

        // Wait for backend to process, then verify MR row still exists
        // (soft-delete accepted but hard-delete blocked by endpoint dependency)
        await modelRegistries.page.waitForTimeout(3000);
        await modelRegistries.page.reload();
        await modelRegistries.table.waitForLoaded();
        await modelRegistries.table.expectRowWithText(mrName);

        // Cleanup in dependency order
        await apiHelper.deleteEndpoint(epName, { force: true }).catch(() => {});
        await apiHelper.deleteCluster(clName, { force: true }).catch(() => {});
        await apiHelper
          .deleteModelRegistry(mrName, { force: true })
          .catch(() => {});
        await apiHelper
          .deleteImageRegistry(irName, { force: true })
          .catch(() => {});
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // Delete permissions (multi-user)
  // ────────────────────────────────────────────────────────────
  test.describe("delete permissions", () => {
    test(
      "non-admin with global model_registry:delete can delete",
      {
        tag: ["@C2613130", "@C2613131"],
        annotation: {
          type: "slow",
          description:
            "creates test user with model_registry:read+delete permissions",
        },
      },
      async ({ createTestUser, apiHelper }, testInfo) => {
        testInfo.setTimeout(MULTI_USER_TIMEOUT);

        const name = `test-mr-glb-rm-${Date.now()}`;
        await apiHelper.createModelRegistry(name);

        const testUser = await createTestUser([
          "model_registry:read",
          "model_registry:delete",
        ]);
        const mrPage = new ResourcePage(testUser.page, {
          routeName: "model-registries",
          workspaced: true,
        });

        await mrPage.goToList();
        await mrPage.table.deleteRow(name);
        await mrPage.table.expectNoRowWithText(name);
      },
    );

    test(
      "non-admin without model_registry:delete cannot delete",
      {
        tag: "@C2613132",
        annotation: {
          type: "slow",
          description: "creates test user with model_registry:read only",
        },
      },
      async ({ createTestUser, apiHelper }, testInfo) => {
        testInfo.setTimeout(MULTI_USER_TIMEOUT);

        const name = `test-mr-no-rm-${Date.now()}`;
        await apiHelper.createModelRegistry(name);

        const testUser = await createTestUser(["model_registry:read"]);
        const mrPage = new ResourcePage(testUser.page, {
          routeName: "model-registries",
          workspaced: true,
        });

        await mrPage.goToList();
        await mrPage.table.expectRowWithText(name);

        // Attempt delete
        await mrPage.table
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
        await mrPage.table.expectRowWithText(name);

        // Cleanup
        await apiHelper.deleteModelRegistry(name).catch(() => {});
      },
    );
  });
});
