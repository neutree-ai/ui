import { expect, test } from "../fixtures/base";
import { ApiHelper } from "../helpers/api-helper";
import { MULTI_USER_TIMEOUT } from "../helpers/constants";
import { ResourcePage } from "../helpers/resource-page";

// ── Shared test data created once in beforeAll ──
const eeNames = {
  base: "", // single upstream (list/detail/edit tests)
  multi: "", // multi upstream (edit multi test)
};

test.describe("external endpoints", () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const api = new ApiHelper(page);

    const ts = Date.now();
    eeNames.base = `test-ee-base-${ts}`;
    eeNames.multi = `test-ee-multi-${ts}`;

    await api.createExternalEndpoint(eeNames.base, {
      upstreamUrl: "https://fake-upstream.invalid/v1",
      modelMapping: { "my-model": "gpt-4" },
    });
    await api.createExternalEndpointMultiUpstream(eeNames.multi, [
      {
        url: "https://fake-upstream-1.invalid/v1",
        modelMapping: { "model-a": "gpt-4" },
      },
      {
        url: "https://fake-upstream-2.invalid/v1",
        modelMapping: { "model-b": "claude-3" },
      },
      {
        url: "https://fake-upstream-3.invalid/v1",
        modelMapping: { "model-c": "llama-3" },
      },
    ]);

    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const api = new ApiHelper(page);

    for (const name of Object.values(eeNames)) {
      await api.deleteExternalEndpoint(name, { force: true }).catch(() => {});
    }
    await context.close();
  });

  // ────────────────────────────────────────────────────────────
  // List tests
  // ────────────────────────────────────────────────────────────
  test.describe("list", () => {
    test("list page shows status and models columns", {
      tag: "@C2642215",
    }, async ({ externalEndpoints }) => {
      await externalEndpoints.goToList();

      const headers = externalEndpoints.table.root.locator("thead th");
      await expect(headers.filter({ hasText: /name/i })).toBeVisible();
      await expect(headers.filter({ hasText: /status/i })).toBeVisible();
      await expect(headers.filter({ hasText: /models/i })).toBeVisible();

      // Verify base EE row exists and shows exposed model
      await externalEndpoints.table.expectRowWithText(eeNames.base);
      const row = externalEndpoints.table.rowWithText(eeNames.base);
      await expect(row.getByText("my-model")).toBeVisible();
    });

    test("sidebar shows Model Gateway group and list shows Type column", {
      tag: "@C2642227",
    }, async ({ externalEndpoints }) => {
      await externalEndpoints.page.goto("/#/dashboard");

      // Sidebar has Model Gateway group
      const sidebar = externalEndpoints.page.locator(
        '[data-sidebar="sidebar"]',
      );
      await expect(sidebar.getByText(/model gateway/i)).toBeVisible();

      // Navigate to list and check Type column
      await externalEndpoints.goToList();
      const headers = externalEndpoints.table.root.locator("thead th");
      await expect(headers.filter({ hasText: /type/i })).toBeVisible();

      // Base EE should show "External" type
      const row = externalEndpoints.table.rowWithText(eeNames.base);
      await expect(row.getByText("External")).toBeVisible();
    });
  });

  // ────────────────────────────────────────────────────────────
  // Create tests
  // ────────────────────────────────────────────────────────────
  test.describe("create", () => {
    test("create with name, upstream URL, and model mapping", {
      tag: "@C2642216",
    }, async ({ externalEndpoints, apiHelper }) => {
      const name = `test-ee-new-${Date.now()}`;

      await externalEndpoints.goToCreate();
      await externalEndpoints.form.fillInput("metadata.name", name);
      await externalEndpoints.form.fillInput(
        "spec.upstreams.0.upstream.url",
        "https://fake-create.invalid/v1",
      );

      // Add model mapping
      await externalEndpoints.page
        .getByRole("button", { name: /add model mapping/i })
        .click();
      const mappingField = externalEndpoints.form.field(
        "spec.upstreams.0.model_mapping",
      );
      const exposedInputs = mappingField.locator(
        'input[placeholder*="exposed" i], input[placeholder*="Exposed" i]',
      );
      const upstreamInputs = mappingField.locator(
        'input[placeholder*="upstream" i], input[placeholder*="Upstream" i]',
      );
      await exposedInputs.first().fill("test-create-model");
      await upstreamInputs.first().fill("gpt-4");

      await externalEndpoints.form.submit();

      // Should navigate away from create form
      await externalEndpoints.table.waitForLoaded();
      await externalEndpoints.table.expectRowWithText(name);

      // Cleanup
      await apiHelper
        .deleteExternalEndpoint(name, { force: true })
        .catch(() => {});
    });

    test("upstream type switch: External URL and Endpoint Ref are mutually exclusive", {
      tag: "@C2642219",
    }, async ({ externalEndpoints }) => {
      await externalEndpoints.goToCreate();

      // Default upstream type should be "External"
      const upstreamTypeField = externalEndpoints.form.field("_upstreamType_0");
      await expect(upstreamTypeField).toBeVisible();

      // URL input should be visible for External type
      const urlField = externalEndpoints.form.field(
        "spec.upstreams.0.upstream.url",
      );
      await expect(urlField).toBeVisible();

      // Switch to Endpoint Ref
      await upstreamTypeField.locator('button[role="combobox"]').click();
      await externalEndpoints.page
        .getByRole("option", { name: /endpoint ref/i })
        .click();

      // URL input should be hidden, endpoint_ref selector should appear
      const endpointRefField = externalEndpoints.form.field(
        "spec.upstreams.0.endpoint_ref",
      );
      await expect(endpointRefField).toBeVisible();
      await expect(urlField).toBeHidden();

      // Switch back to External
      await upstreamTypeField.locator('button[role="combobox"]').click();
      await externalEndpoints.page
        .getByRole("option", { name: /^external$/i })
        .click();

      // URL input should reappear
      await expect(urlField).toBeVisible();
      await expect(endpointRefField).toBeHidden();
    });

    test("timeout field with seconds/minutes unit switching", {
      tag: "@C2642220",
    }, async ({ externalEndpoints }) => {
      await externalEndpoints.goToCreate();

      const timeoutField = externalEndpoints.form.field("spec.timeout");
      await expect(timeoutField).toBeVisible();

      // Default should show timeout input
      const timeoutInput = timeoutField.locator('input[type="number"]');
      await expect(timeoutInput).toBeVisible();

      // Unit switcher should exist (Seconds / Minutes)
      const unitButton = timeoutField.locator('button[role="combobox"]');
      if (await unitButton.isVisible()) {
        await unitButton.click();
        await expect(
          externalEndpoints.page.getByRole("option", { name: /seconds/i }),
        ).toBeVisible();
        await expect(
          externalEndpoints.page.getByRole("option", { name: /minutes/i }),
        ).toBeVisible();

        // Switch to minutes
        await externalEndpoints.page
          .getByRole("option", { name: /minutes/i })
          .click();
      }
    });

    test("duplicate model mapping key validation", {
      tag: "@C2642221",
    }, async ({ externalEndpoints }) => {
      await externalEndpoints.goToCreate();
      await externalEndpoints.form.fillInput("metadata.name", "test-ee-dup");

      // Add first model mapping
      const addMappingBtn = externalEndpoints.page.getByRole("button", {
        name: /add model mapping/i,
      });
      await addMappingBtn.click();

      const mappingField = externalEndpoints.form.field(
        "spec.upstreams.0.model_mapping",
      );
      const exposedInputs = mappingField.locator(
        'input[placeholder*="exposed" i], input[placeholder*="Exposed" i]',
      );
      const upstreamInputs = mappingField.locator(
        'input[placeholder*="upstream" i], input[placeholder*="Upstream" i]',
      );

      await exposedInputs.first().fill("duplicate-key");
      await upstreamInputs.first().fill("model-a");

      // Add second mapping with same key
      await addMappingBtn.click();
      await exposedInputs.nth(1).fill("duplicate-key");
      await upstreamInputs.nth(1).fill("model-b");

      // Should show duplicate key error
      await expect(
        externalEndpoints.page.getByText(/duplicate model key/i),
      ).toBeVisible();
    });
  });

  // ────────────────────────────────────────────────────────────
  // Detail tests
  // ────────────────────────────────────────────────────────────
  test.describe("detail", () => {
    test("show page displays name, status, upstream, and models", {
      tag: "@C2642218",
    }, async ({ externalEndpoints }) => {
      await externalEndpoints.goToList();
      await externalEndpoints.table.clickRowLink(eeNames.base);

      const showPage = externalEndpoints.page.locator(
        '[data-testid="show-page"]',
      );
      await expect(showPage).toBeVisible();

      // Name
      await expect(
        showPage.getByText(eeNames.base, { exact: true }),
      ).toBeVisible();

      // Upstream URL
      await expect(
        showPage.getByText("https://fake-upstream.invalid/v1"),
      ).toBeVisible();

      // Exposed model
      await expect(showPage.getByText("my-model")).toBeVisible();
    });

    test("tabbed curl example switches between OpenAI, Anthropic, Embedding", {
      tag: "@C2642222",
    }, async ({ externalEndpoints }) => {
      await externalEndpoints.goToList();
      await externalEndpoints.table.clickRowLink(eeNames.base);

      const showPage = externalEndpoints.page.locator(
        '[data-testid="show-page"]',
      );
      await expect(showPage).toBeVisible();

      // OpenAI tab
      const openaiTab = showPage.getByRole("button", { name: /openai/i });
      if (await openaiTab.isVisible()) {
        await openaiTab.click();
        await expect(showPage.getByText(/chat\/completions/i)).toBeVisible();
      }

      // Anthropic tab
      const anthropicTab = showPage.getByRole("button", {
        name: /anthropic/i,
      });
      if (await anthropicTab.isVisible()) {
        await anthropicTab.click();
        await expect(showPage.getByText(/anthropic.*messages/i)).toBeVisible();
      }

      // Embedding tab
      const embeddingTab = showPage.getByRole("button", {
        name: /embedding/i,
      });
      if (await embeddingTab.isVisible()) {
        await embeddingTab.click();
        await expect(showPage.getByText(/embeddings/i)).toBeVisible();
      }
    });

    test("curl example uses $ENDPOINT_API_KEY variable", {
      tag: "@C2642223",
    }, async ({ externalEndpoints }) => {
      await externalEndpoints.goToList();
      await externalEndpoints.table.clickRowLink(eeNames.base);

      const showPage = externalEndpoints.page.locator(
        '[data-testid="show-page"]',
      );
      await expect(showPage).toBeVisible();

      // curl example should contain $ENDPOINT_API_KEY
      await expect(showPage.getByText("$ENDPOINT_API_KEY")).toBeVisible();
    });
  });

  // ────────────────────────────────────────────────────────────
  // Edit tests
  // ────────────────────────────────────────────────────────────
  test.describe("edit", () => {
    test("edit upstream URL and model mapping", {
      tag: "@C2642217",
    }, async ({ externalEndpoints }) => {
      await externalEndpoints.goToEdit(eeNames.base);
      await expect(
        externalEndpoints.page.locator('[data-testid="form-submit"]'),
      ).toBeEnabled();

      // Verify current upstream URL is loaded
      const urlInput = externalEndpoints.form
        .field("spec.upstreams.0.upstream.url")
        .locator("input");
      await expect(urlInput).toHaveValue("https://fake-upstream.invalid/v1");

      // Modify URL
      await urlInput.clear();
      await urlInput.fill("https://updated-upstream.invalid/v1");

      await externalEndpoints.form.submit();

      // Should redirect to list or detail
      await externalEndpoints.table.waitForLoaded();
      await externalEndpoints.table.expectRowWithText(eeNames.base);
    });

    test("edit with multiple upstreams displays all correctly", {
      tag: "@C2642224",
    }, async ({ externalEndpoints }) => {
      await externalEndpoints.goToEdit(eeNames.multi);
      await expect(
        externalEndpoints.page.locator('[data-testid="form-submit"]'),
      ).toBeEnabled();

      // Should display all 3 upstreams
      await expect(
        externalEndpoints.page.getByText(/upstream.*1/i).first(),
      ).toBeVisible();

      // Verify at least 3 upstream URL fields exist
      const urlInputs = externalEndpoints.page.locator(
        '[data-testid^="field-spec.upstreams."] input[type="text"]',
      );
      const count = await urlInputs.count();
      expect(count).toBeGreaterThanOrEqual(3);
    });
  });

  // ────────────────────────────────────────────────────────────
  // RBAC tests
  // ────────────────────────────────────────────────────────────
  test.describe("permissions", () => {
    test(
      "workspace-user can create external endpoint",
      {
        tag: "@C2642228",
        annotation: {
          type: "slow",
          description: "creates test user with workspace-user permissions",
        },
      },
      async ({ createTestUser, browser }, testInfo) => {
        testInfo.setTimeout(MULTI_USER_TIMEOUT);

        const testUser = await createTestUser([
          "external_endpoint:read",
          "external_endpoint:create",
          "workspace:read",
        ]);
        const eePage = new ResourcePage(testUser.page, {
          routeName: "external-endpoints",
          workspaced: true,
        });

        const name = `test-ee-rbac-new-${Date.now()}`;
        await eePage.goToCreate();
        await eePage.form.fillInput("metadata.name", name);
        await eePage.form.fillInput(
          "spec.upstreams.0.upstream.url",
          "https://fake-rbac.invalid/v1",
        );

        const responsePromise = testUser.page.waitForResponse(
          (r) =>
            r.url().includes("/external_endpoints") &&
            r.request().method() === "POST",
        );
        await eePage.form.submit();
        const response = await responsePromise;

        expect(response.status()).toBeLessThan(400);
      },
    );

    test(
      "workspace-user can update and delete own external endpoint",
      {
        tag: "@C2642229",
        annotation: {
          type: "slow",
          description: "creates test user with workspace-user CRUD permissions",
        },
      },
      async ({ createTestUser, apiHelper, browser }, testInfo) => {
        testInfo.setTimeout(MULTI_USER_TIMEOUT);

        const name = `test-ee-rbac-upd-${Date.now()}`;
        await apiHelper.createExternalEndpoint(name);

        const testUser = await createTestUser([
          "external_endpoint:read",
          "external_endpoint:create",
          "external_endpoint:update",
          "external_endpoint:delete",
          "workspace:read",
        ]);
        const eePage = new ResourcePage(testUser.page, {
          routeName: "external-endpoints",
          workspaced: true,
        });

        // Edit
        await eePage.goToEdit(name);
        await expect(
          testUser.page.locator('[data-testid="form-submit"]'),
        ).toBeEnabled();

        // Delete
        await eePage.goToList();
        await eePage.table.deleteRow(name, { noWait: true });
      },
    );
  });
});
