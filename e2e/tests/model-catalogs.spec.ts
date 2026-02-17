import { expect, test } from "../fixtures/base";
import { ApiHelper } from "../helpers/api-helper";
import { ResourcePage } from "../helpers/resource-page";
import { YamlImportHelper } from "../helpers/yaml-import";

/** Build a ModelCatalog YAML document for import */
function modelCatalogYaml(
  name: string,
  options?: {
    workspace?: string;
    task?: string;
    modelName?: string;
    modelVersion?: string;
    modelFile?: string;
    engine?: string;
    engineVersion?: string;
    cpu?: number;
    memory?: number;
    gpu?: number;
    replicas?: number;
    schedulerType?: string;
  },
): string {
  const o = {
    workspace: "default",
    task: "text-generation",
    modelName: "test-model",
    modelVersion: "1.0",
    modelFile: "model.safetensors",
    engine: "vllm",
    engineVersion: "v0.8.5",
    cpu: 2,
    memory: 4,
    gpu: 1,
    replicas: 1,
    schedulerType: "roundrobin",
    ...options,
  };
  return `apiVersion: v1
kind: ModelCatalog
metadata:
  name: ${name}
  workspace: ${o.workspace}
spec:
  model:
    registry: huggingface
    name: ${o.modelName}
    version: "${o.modelVersion}"
    task: ${o.task}
    file: ${o.modelFile}
  engine:
    engine: ${o.engine}
    version: ${o.engineVersion}
  resources:
    cpu: ${o.cpu}
    memory: ${o.memory}
    gpu: ${o.gpu}
  replicas:
    num: ${o.replicas}
  deployment_options:
    scheduler:
      type: ${o.schedulerType}
  variables: {}`;
}

// ── Shared test data for list + detail tests ──
// Created once in beforeAll, cleaned up in afterAll.
const mcNames = {
  tg: "", // text-generation
  te: "", // text-embedding
  tr: "", // text-rerank (also used for detail tests — has full resource/replica config)
};

test.describe("model catalogs", () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const api = new ApiHelper(page);

    const ts = Date.now();
    mcNames.tg = `test-mc-tg-${ts}`;
    mcNames.te = `test-mc-te-${ts}`;
    mcNames.tr = `test-mc-tr-${ts}`;

    await api.createModelCatalog(mcNames.tg, {
      task: "text-generation",
      modelName: "test-model-tg",
      modelVersion: "1.0",
      modelFile: "model-tg.safetensors",
    });
    await api.createModelCatalog(mcNames.te, {
      task: "text-embedding",
      modelName: "test-model-te",
      modelVersion: "2.0",
      modelFile: "model-te.safetensors",
    });
    await api.createModelCatalog(mcNames.tr, {
      task: "text-rerank",
      modelName: "test-model-tr",
      modelVersion: "3.0",
      modelFile: "model-tr.safetensors",
      cpu: 4,
      memory: 8,
      gpu: 1,
      replicas: 2,
    });

    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const api = new ApiHelper(page);

    for (const name of Object.values(mcNames)) {
      await api.deleteModelCatalog(name).catch(() => {});
    }
    await context.close();
  });

  // ────────────────────────────────────────────────────────────
  // List tests
  // ────────────────────────────────────────────────────────────
  test.describe("list", () => {
    test(
      "list page shows expected columns and model catalogs",
      {
        tag: "@C2613160",
      },
      async ({ modelCatalogs }) => {
        await modelCatalogs.goToList();

        const headers = modelCatalogs.table.root.locator("thead th");
        await expect(headers.filter({ hasText: /name/i })).toBeVisible();
        await expect(headers.filter({ hasText: /workspace/i })).toBeVisible();
        await expect(headers.filter({ hasText: /model/i })).toBeVisible();
        await expect(headers.filter({ hasText: /task/i })).toBeVisible();
        await expect(headers.filter({ hasText: /engine/i })).toBeVisible();
        await expect(headers.filter({ hasText: /status/i })).toBeVisible();
        await expect(headers.filter({ hasText: /updated/i })).toBeVisible();

        await modelCatalogs.table.expectRowWithText(mcNames.tg);
      },
    );

    test(
      "can sort by name",
      {
        tag: "@C2613161",
      },
      async ({ modelCatalogs }) => {
        await modelCatalogs.goToList();
        await modelCatalogs.table.sort(/name/i);
      },
    );

    test(
      "clicking name navigates to detail page",
      {
        tag: "@C2613162",
      },
      async ({ modelCatalogs }) => {
        await modelCatalogs.goToList();
        await modelCatalogs.table.clickRowLink(mcNames.tg);

        const showPage = modelCatalogs.page.locator(
          '[data-testid="show-page"]',
        );
        await expect(showPage).toBeVisible();
        await expect(
          showPage.getByText(mcNames.tg, { exact: true }),
        ).toBeVisible();
      },
    );

    test(
      "clicking workspace navigates to workspace detail",
      {
        tag: "@C2613163",
      },
      async ({ modelCatalogs }) => {
        await modelCatalogs.goToList();

        const row = modelCatalogs.table.rowWithText(mcNames.tg);
        await row.getByRole("link", { name: "default" }).click();

        const showPage = modelCatalogs.page.locator(
          '[data-testid="show-page"]',
        );
        await expect(showPage).toBeVisible();
        await expect(
          showPage.getByText("default", { exact: true }),
        ).toBeVisible();
      },
    );

    test(
      "model column shows name:version format",
      {
        tag: "@C2613164",
      },
      async ({ modelCatalogs }) => {
        await modelCatalogs.goToList();

        const row = modelCatalogs.table.rowWithText(mcNames.tg);
        await expect(row.getByText("test-model-tg:1.0")).toBeVisible();
      },
    );

    test(
      "task column shows Text Generation badge",
      {
        tag: "@C2613165",
      },
      async ({ modelCatalogs }) => {
        await modelCatalogs.goToList();

        const row = modelCatalogs.table.rowWithText(mcNames.tg);
        await expect(row.getByText("Text Generation")).toBeVisible();
      },
    );

    test(
      "task column shows Text Embedding badge",
      {
        tag: "@C2613166",
      },
      async ({ modelCatalogs }) => {
        await modelCatalogs.goToList();

        const row = modelCatalogs.table.rowWithText(mcNames.te);
        await expect(row.getByText("Text Embedding")).toBeVisible();
      },
    );

    test(
      "task column shows Text Rerank badge",
      {
        tag: "@C2613167",
      },
      async ({ modelCatalogs }) => {
        await modelCatalogs.goToList();

        const row = modelCatalogs.table.rowWithText(mcNames.tr);
        await expect(row.getByText("Text Rerank")).toBeVisible();
      },
    );

    test(
      "engine column shows engine:version as link",
      {
        tag: "@C2613168",
      },
      async ({ modelCatalogs }) => {
        await modelCatalogs.goToList();

        const row = modelCatalogs.table.rowWithText(mcNames.tg);
        const engineLink = row.getByRole("link", { name: "vllm:v0.8.5" });
        await expect(engineLink).toBeVisible();
      },
    );

    test(
      "status column shows engine phase",
      {
        tag: "@C2613169",
      },
      async ({ modelCatalogs }) => {
        await modelCatalogs.goToList();

        const row = modelCatalogs.table.rowWithText(mcNames.tg);
        // Status should show a phase (Pending, Ready, Failed, etc.)
        await expect(row).toBeVisible();
        await expect(modelCatalogs.table.headerCell(/status/i)).toBeVisible();
      },
    );

    test(
      "updated at column visible and sortable",
      {
        tag: ["@C2613170", "@C2613171"],
      },
      async ({ modelCatalogs }) => {
        await modelCatalogs.goToList();
        await expect(modelCatalogs.table.headerCell(/updated/i)).toBeVisible();
        await modelCatalogs.table.sort(/updated/i);
      },
    );

    test(
      "created at column visible and sortable",
      {
        tag: ["@C2613172", "@C2613173"],
      },
      async ({ modelCatalogs }) => {
        await modelCatalogs.goToList();
        await expect(modelCatalogs.table.headerCell(/created/i)).toBeVisible();
        await modelCatalogs.table.sort(/created/i);
      },
    );

    test(
      "can toggle column visibility",
      {
        tag: "@C2613174",
      },
      async ({ modelCatalogs }) => {
        await modelCatalogs.goToList();
        // Status column is visible by default
        await expect(modelCatalogs.table.headerCell(/status/i)).toBeVisible();
        // Toggle it hidden
        await modelCatalogs.table.toggleColumn(/status/i);
        await expect(modelCatalogs.table.headerCell(/status/i)).toBeHidden();
        // Toggle it visible again
        await modelCatalogs.table.toggleColumn(/status/i);
        await expect(modelCatalogs.table.headerCell(/status/i)).toBeVisible();
      },
    );

    test(
      "admin can see all model catalogs",
      {
        tag: "@C2613180",
      },
      async ({ modelCatalogs }) => {
        await modelCatalogs.goToList();
        const rowCount = await modelCatalogs.table.rows().count();
        expect(rowCount).toBeGreaterThan(0);
        await modelCatalogs.table.expectRowWithText(mcNames.tg);
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // Detail tests (uses MC_TR — has full resource/replica config)
  // ────────────────────────────────────────────────────────────
  test.describe("detail", () => {
    test(
      "show page displays name, workspace, timestamps, and status",
      {
        tag: "@C2613178",
      },
      async ({ modelCatalogs }) => {
        await modelCatalogs.goToShow(mcNames.tr);

        const showPage = modelCatalogs.page.locator(
          '[data-testid="show-page"]',
        );
        await expect(showPage).toBeVisible();

        // Name
        await expect(
          showPage.getByText(mcNames.tr, { exact: true }),
        ).toBeVisible();

        // Workspace
        const workspaceDt = showPage.locator("dt", {
          hasText: /workspace/i,
        });
        await expect(workspaceDt).toBeVisible();

        // Timestamps (use role="term" to scope to <dt> elements)
        await expect(
          showPage.getByRole("term").filter({ hasText: /created at/i }),
        ).toBeVisible();
        await expect(
          showPage.getByRole("term").filter({ hasText: /updated at/i }),
        ).toBeVisible();

        // Status
        const statusDt = showPage.locator("dt", { hasText: /^status$/i });
        await expect(statusDt).toBeVisible();
      },
    );

    test(
      "workspace link navigates to workspace detail",
      {
        tag: "@C2613184",
      },
      async ({ modelCatalogs }) => {
        await modelCatalogs.goToShow(mcNames.tr);

        const showPage = modelCatalogs.page.locator(
          '[data-testid="show-page"]',
        );
        const workspaceDt = showPage.locator("dt", {
          hasText: /workspace/i,
        });
        const workspaceDd = workspaceDt.locator("~ dd").first();
        await workspaceDd.getByRole("link").click();

        // Should navigate to workspace show page
        const wsShowPage = modelCatalogs.page.locator(
          '[data-testid="show-page"]',
        );
        await expect(wsShowPage).toBeVisible();
        await expect(
          wsShowPage.getByText("default", { exact: true }),
        ).toBeVisible();
      },
    );

    test(
      "show page displays engine, model, and task info",
      {
        tag: "@C2613185",
      },
      async ({ modelCatalogs }) => {
        await modelCatalogs.goToShow(mcNames.tr);

        const showPage = modelCatalogs.page.locator(
          '[data-testid="show-page"]',
        );

        // Engine
        const engineDt = showPage.locator("dt", { hasText: /^engine$/i });
        await expect(engineDt).toBeVisible();
        await expect(
          showPage.getByRole("link", { name: "vllm:v0.8.5" }),
        ).toBeVisible();

        // Model
        const modelDt = showPage.locator("dt", { hasText: /^model$/i });
        await expect(modelDt).toBeVisible();
        await expect(showPage.getByText("test-model-tr:3.0")).toBeVisible();

        // Task
        const taskDt = showPage.locator("dt", { hasText: /^task$/i });
        await expect(taskDt).toBeVisible();
        await expect(showPage.getByText("Text Rerank")).toBeVisible();

        // Model File
        const modelFileDt = showPage.locator("dt", {
          hasText: /model file/i,
        });
        await expect(modelFileDt).toBeVisible();
        await expect(showPage.getByText("model-tr.safetensors")).toBeVisible();
      },
    );

    test(
      "show page displays deployment config (replicas and scheduler)",
      {
        tag: "@C2613186",
      },
      async ({ modelCatalogs }) => {
        await modelCatalogs.goToShow(mcNames.tr);

        const showPage = modelCatalogs.page.locator(
          '[data-testid="show-page"]',
        );

        // Replica
        const replicaDt = showPage.locator("dt", { hasText: /replica/i });
        await expect(replicaDt).toBeVisible();
        const replicaDd = replicaDt.locator("~ dd").first();
        await expect(replicaDd.getByText("2")).toBeVisible();

        // Scheduler
        const schedulerDt = showPage.locator("dt", {
          hasText: /scheduler/i,
        });
        await expect(schedulerDt).toBeVisible();
        const schedulerDd = schedulerDt.locator("~ dd").first();
        await expect(schedulerDd.getByText("Round robin")).toBeVisible();
      },
    );

    test(
      "show page displays resources (GPU, CPU, Memory)",
      {
        tag: "@C2622605",
      },
      async ({ modelCatalogs }) => {
        await modelCatalogs.goToShow(mcNames.tr);

        const showPage = modelCatalogs.page.locator(
          '[data-testid="show-page"]',
        );

        // GPU
        const gpuDt = showPage.locator("dt", { hasText: /^gpu$/i });
        await expect(gpuDt).toBeVisible();
        const gpuDd = gpuDt.locator("~ dd").first();
        await expect(gpuDd.getByText("1")).toBeVisible();

        // CPU
        const cpuDt = showPage.locator("dt", { hasText: /^cpu$/i });
        await expect(cpuDt).toBeVisible();
        const cpuDd = cpuDt.locator("~ dd").first();
        await expect(cpuDd.getByText("4")).toBeVisible();

        // Memory
        const memDt = showPage.locator("dt", { hasText: /^memory$/i });
        await expect(memDt).toBeVisible();
        const memDd = memDt.locator("~ dd").first();
        await expect(memDd.getByText("8")).toBeVisible();
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // List permission tests (multi-user)
  // ────────────────────────────────────────────────────────────
  test.describe("list permissions", () => {
    test(
      "non-admin with model_catalog:read can see model catalogs",
      {
        tag: "@C2613181",
        annotation: {
          type: "slow",
          description: "creates test user with model_catalog:read permission",
        },
      },
      async ({ createTestUser }, testInfo) => {
        testInfo.setTimeout(60_000);

        const testUser = await createTestUser(["model_catalog:read"]);
        const mcPage = new ResourcePage(testUser.page, {
          routeName: "model-catalogs",
          workspaced: true,
        });

        await mcPage.goToList();
        const rowCount = await mcPage.table.rows().count();
        expect(rowCount).toBeGreaterThan(0);
      },
    );

    test(
      "non-admin without model_catalog:read sees empty list",
      {
        tag: "@C2613183",
        annotation: {
          type: "slow",
          description:
            "creates test user without model_catalog:read permission",
        },
      },
      async ({ createTestUser }, testInfo) => {
        testInfo.setTimeout(60_000);

        const testUser = await createTestUser(["role:read"]);
        const mcPage = new ResourcePage(testUser.page, {
          routeName: "model-catalogs",
          workspaced: true,
        });

        await testUser.page.goto("/#/default/model-catalogs");
        await mcPage.table.waitForLoaded();

        await expect(
          testUser.page.locator('[data-testid="table-empty"]'),
        ).toBeVisible();
      },
    );
  });
});

// ────────────────────────────────────────────────────────────
// Create tests (YAML import)
// ────────────────────────────────────────────────────────────
test.describe("model catalogs create", () => {
  test(
    "no create button on list page, only YAML import supported",
    {
      tag: "@C2613187",
    },
    async ({ modelCatalogs }) => {
      await modelCatalogs.goToList();

      // No Create link/button
      await expect(
        modelCatalogs.page.getByRole("link", { name: /create/i }),
      ).toBeHidden();

      // Import YAML button should be visible in the navbar
      await expect(
        modelCatalogs.page.getByRole("button", { name: /import yaml/i }),
      ).toBeVisible();
    },
  );

  test(
    "admin can import model catalog via YAML and verify all fields",
    {
      tag: ["@C2612861", "@C2613188"],
    },
    async ({ modelCatalogs, yamlImport, apiHelper }) => {
      const mcName = `test-mc-imp-${Date.now()}`;
      const yaml = modelCatalogYaml(mcName, {
        modelName: "import-test-model",
        modelVersion: "2.5",
        modelFile: "imported.safetensors",
        task: "text-embedding",
        cpu: 4,
        memory: 8,
        gpu: 1,
        replicas: 3,
        schedulerType: "consistent_hash",
      });

      // Import via YAML
      await modelCatalogs.goToList();
      await yamlImport.importYaml(yaml);
      await yamlImport.expectResults({ success: 1 });
      await yamlImport.close();

      // Verify in list
      await modelCatalogs.table.expectRowWithText(mcName);

      // Navigate to detail page and verify all fields
      await modelCatalogs.table.clickRowLink(mcName);
      const showPage = modelCatalogs.page.locator('[data-testid="show-page"]');
      await expect(showPage).toBeVisible();

      // Name
      await expect(showPage.getByText(mcName, { exact: true })).toBeVisible();

      // Model info
      await expect(showPage.getByText("import-test-model:2.5")).toBeVisible();
      await expect(showPage.getByText("Text Embedding")).toBeVisible();
      await expect(showPage.getByText("imported.safetensors")).toBeVisible();

      // Engine
      await expect(
        showPage.getByRole("link", { name: "vllm:v0.8.5" }),
      ).toBeVisible();

      // Resources
      const gpuDd = showPage
        .locator("dt", { hasText: /^gpu$/i })
        .locator("~ dd")
        .first();
      await expect(gpuDd.getByText("1")).toBeVisible();
      const cpuDd = showPage
        .locator("dt", { hasText: /^cpu$/i })
        .locator("~ dd")
        .first();
      await expect(cpuDd.getByText("4")).toBeVisible();
      const memDd = showPage
        .locator("dt", { hasText: /^memory$/i })
        .locator("~ dd")
        .first();
      await expect(memDd.getByText("8")).toBeVisible();

      // Deployment config
      const replicaDd = showPage
        .locator("dt", { hasText: /replica/i })
        .locator("~ dd")
        .first();
      await expect(replicaDd.getByText("3")).toBeVisible();
      await expect(showPage.getByText("Consistent hashing")).toBeVisible();

      // Cleanup
      await modelCatalogs.goToList();
      await modelCatalogs.table.deleteRow(mcName, { noWait: true });
    },
  );

  test(
    "non-admin with model_catalog:create can import via YAML",
    {
      tag: "@C2613189",
      annotation: {
        type: "slow",
        description:
          "creates test user with model_catalog:create+read permissions",
      },
    },
    async ({ createTestUser, apiHelper }, testInfo) => {
      testInfo.setTimeout(60_000);

      const testUser = await createTestUser([
        "model_catalog:create",
        "model_catalog:read",
      ]);

      const mcName = `test-mc-imp-${Date.now()}`;
      const yaml = modelCatalogYaml(mcName);
      const yamlHelper = new YamlImportHelper(testUser.page);
      const mcPage = new ResourcePage(testUser.page, {
        routeName: "model-catalogs",
        workspaced: true,
      });

      await mcPage.goToList();
      await yamlHelper.importYaml(yaml);
      await yamlHelper.expectResults({ success: 1 });
      await yamlHelper.close();

      await mcPage.table.expectRowWithText(mcName);

      // Cleanup (admin deletes)
      await apiHelper.deleteModelCatalog(mcName).catch(() => {});
    },
  );

  test(
    "non-admin without model_catalog:create cannot import",
    {
      tag: "@C2613191",
      annotation: {
        type: "slow",
        description: "creates test user with model_catalog:read only",
      },
    },
    async ({ createTestUser }, testInfo) => {
      testInfo.setTimeout(60_000);

      const testUser = await createTestUser(["model_catalog:read"]);

      const mcName = `test-mc-imp-${Date.now()}`;
      const yaml = modelCatalogYaml(mcName);
      const yamlHelper = new YamlImportHelper(testUser.page);
      const mcPage = new ResourcePage(testUser.page, {
        routeName: "model-catalogs",
        workspaced: true,
      });

      await mcPage.goToList();
      await yamlHelper.importYaml(yaml);
      await yamlHelper.expectResults({ errors: 1 });
      await yamlHelper.close();

      // Model catalog should NOT appear in the list
      await mcPage.table.expectNoRowWithText(mcName);
    },
  );
});

// ────────────────────────────────────────────────────────────
// Delete tests
// ────────────────────────────────────────────────────────────
test.describe("model catalogs delete", () => {
  test(
    "can delete from list action menu",
    {
      tag: ["@C2613192", "@C2612870"],
    },
    async ({ modelCatalogs, apiHelper }) => {
      const mcName = `test-mc-del-${Date.now()}`;
      await apiHelper.createModelCatalog(mcName);

      await modelCatalogs.goToList();
      await modelCatalogs.table.deleteRow(mcName);
      await modelCatalogs.table.expectNoRowWithText(mcName);
    },
  );

  test(
    "can delete from detail page action menu",
    {
      tag: "@C2613193",
    },
    async ({ modelCatalogs, apiHelper }) => {
      const mcName = `test-mc-del-${Date.now()}`;
      await apiHelper.createModelCatalog(mcName);

      await modelCatalogs.goToShow(mcName);
      await modelCatalogs.showPageDelete(mcName);
    },
  );

  test(
    "admin can delete model catalog",
    {
      tag: "@C2613194",
    },
    async ({ modelCatalogs, apiHelper }) => {
      const mcName = `test-mc-del-${Date.now()}`;
      await apiHelper.createModelCatalog(mcName);

      await modelCatalogs.goToList();
      await modelCatalogs.table.deleteRow(mcName);
      await modelCatalogs.table.expectNoRowWithText(mcName);
    },
  );
});

// ────────────────────────────────────────────────────────────
// Delete permission tests (multi-user)
// ────────────────────────────────────────────────────────────
test.describe("model catalogs delete permissions", () => {
  test(
    "non-admin with model_catalog:delete can delete",
    {
      tag: "@C2613195",
      annotation: {
        type: "slow",
        description:
          "creates test user with model_catalog:read+delete permissions",
      },
    },
    async ({ createTestUser, apiHelper }, testInfo) => {
      testInfo.setTimeout(60_000);

      const mcName = `test-mc-del-${Date.now()}`;
      await apiHelper.createModelCatalog(mcName);

      const testUser = await createTestUser([
        "model_catalog:read",
        "model_catalog:delete",
      ]);
      const mcPage = new ResourcePage(testUser.page, {
        routeName: "model-catalogs",
        workspaced: true,
      });

      await mcPage.goToList();
      await mcPage.table.deleteRow(mcName);
      await mcPage.table.expectNoRowWithText(mcName);
    },
  );

  test(
    "non-admin without model_catalog:delete cannot delete",
    {
      tag: "@C2613197",
      annotation: {
        type: "slow",
        description: "creates test user with model_catalog:read only",
      },
    },
    async ({ createTestUser, apiHelper }, testInfo) => {
      testInfo.setTimeout(60_000);

      const mcName = `test-mc-del-${Date.now()}`;
      await apiHelper.createModelCatalog(mcName);

      const testUser = await createTestUser(["model_catalog:read"]);
      const mcPage = new ResourcePage(testUser.page, {
        routeName: "model-catalogs",
        workspaced: true,
      });

      await mcPage.goToList();
      await mcPage.table.expectRowWithText(mcName);

      // Attempt delete — API should reject with 403
      await mcPage.table
        .rowWithText(mcName)
        .locator('[data-testid="row-actions-trigger"]')
        .click();
      await testUser.page
        .locator('[role="menu"]')
        .waitFor({ state: "visible" });
      await testUser.page.getByRole("menuitem", { name: /delete/i }).click();

      const dialog = testUser.page.getByRole("alertdialog");
      await dialog.waitFor({ state: "visible" });
      await dialog.getByRole("button", { name: /delete/i }).click();

      // Delete should fail — row still visible after the attempt
      await dialog.waitFor({ state: "hidden" });
      await mcPage.table.expectRowWithText(mcName);

      // Cleanup
      await apiHelper.deleteModelCatalog(mcName).catch(() => {});
    },
  );
});
