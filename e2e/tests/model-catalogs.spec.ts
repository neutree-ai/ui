import type { Locator, Page } from "@playwright/test";
import { config } from "../config";
import { expect, test } from "../fixtures/base";
import { ApiHelper } from "../helpers/api-helper";
import { DELETE_TIMEOUT, MULTI_USER_TIMEOUT } from "../helpers/constants";

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
    task: config.model.task,
    modelName: config.model.name,
    modelVersion: config.model.version,
    modelFile: config.model.file,
    engine: config.engine.name,
    engineVersion: config.engine.version,
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
    cpu: "${o.cpu}"
    memory: "${o.memory}"
    gpu: "${o.gpu}"
  replicas:
    num: ${o.replicas}
  deployment_options:
    scheduler:
      type: ${o.schedulerType}
  variables: {}`;
}

// ── Card-surface helpers ──
// The catalog list is a card grid (design §3.7), not a table. These helpers
// locate and act on cards by catalog name via the card's data-testid/data-name,
// replacing the old TableHelper for the model-catalog list surface.
const CATALOG_CARD = '[data-testid="model-catalog-card"]';

async function gotoCatalogList(
  page: Page,
  workspace = "default",
): Promise<void> {
  await page.goto(`/#/${workspace}/model-catalogs`);
  // The search box renders unconditionally once the list page mounts, so it is
  // a reliable "page loaded" signal for a grid that may legitimately be empty.
  await page.getByPlaceholder(/search by name/i).waitFor({ state: "visible" });
}

function catalogCard(page: Page, name: string): Locator {
  return page.locator(`${CATALOG_CARD}[data-name="${name}"]`);
}

// Deletion is controller-reconciled, not instant: the confirm click flips the
// record's status.phase to "Deleted" (or clears it), and the row is only
// actually removed from the list once the controller finishes cleanup — the
// same eventual-consistency shape TableHelper.deleteRow/expectNoRowWithText
// handle for table-surfaced resources via DELETE_TIMEOUT. Card-grid callers
// must wait with the same extended timeout instead of the default 5s.
async function deleteCatalogCardByName(
  page: Page,
  name: string,
): Promise<void> {
  await catalogCard(page, name)
    .getByRole("button", { name: /delete/i })
    .click();
  const dialog = page.getByRole("alertdialog");
  await dialog.waitFor({ state: "visible" });
  await dialog.getByRole("button", { name: /delete/i }).click();
  await dialog.waitFor({ state: "hidden" });
  await expect(catalogCard(page, name)).toHaveCount(0, {
    timeout: DELETE_TIMEOUT,
  });
}

/** Delete a catalog from its show page's action menu, then verify the card is
 * gone from the (card-grid) list. Mirrors ResourcePage.showPageDelete, but that
 * helper's post-delete check waits on a `[data-testid="table"]` list surface —
 * the model-catalog list is a card grid, so we verify via catalogCard instead. */
async function deleteFromShowPageActionMenu(
  page: Page,
  name: string,
): Promise<void> {
  await page.locator('[data-testid="show-actions-trigger"]').click();
  await page.getByRole("menuitem", { name: /delete/i }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.waitFor({ state: "visible" });
  await dialog.getByRole("button", { name: /delete/i }).click();
  await dialog.waitFor({ state: "hidden" });

  await gotoCatalogList(page);
  await expect(catalogCard(page, name)).toHaveCount(0, {
    timeout: DELETE_TIMEOUT,
  });
}

/** Open the model-catalog list's own Import dialog (paste/file/URL tabs with a
 * per-document result table) — distinct from the global navbar "Import YAML".
 * Mirrors the helper of the same name in model-catalogs-recipe.spec.ts. */
async function mcImportPaste(page: Page, yaml: string): Promise<Locator> {
  await page.getByRole("button", { name: "Import", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });
  await dialog.locator("textarea").fill(yaml);
  await dialog.getByRole("button", { name: "Import", exact: true }).click();
  // The per-document result table renders once all creates settle.
  await dialog.locator("table").waitFor({ state: "visible" });
  return dialog;
}

async function closeMcImportDialog(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /cancel/i }).click();
  await dialog.waitFor({ state: "hidden" });
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
  // List tests — the catalog list is a card grid (design §3.7), not a table.
  // The per-column / sort / column-visibility assertions were removed with the
  // table UI; this is a focused smoke test of the card surface.
  // ────────────────────────────────────────────────────────────
  test.describe("list", () => {
    test("list renders a card per catalog with task and deploy/details entries", {
      tag: "@C2613160",
    }, async ({ modelCatalogs }) => {
      await gotoCatalogList(modelCatalogs.page);

      const card = catalogCard(modelCatalogs.page, mcNames.tg);
      await expect(card).toBeVisible();
      await expect(card.getByText("test-model-tg")).toBeVisible();
      await expect(card.getByText("Text Generation")).toBeVisible();
      await expect(card.getByRole("button", { name: /deploy/i })).toBeVisible();
      await expect(
        card.getByRole("button", { name: /details/i }),
      ).toBeVisible();
    });

    test("clicking Details navigates to the catalog detail page", {
      tag: "@C2613162",
    }, async ({ modelCatalogs }) => {
      await gotoCatalogList(modelCatalogs.page);
      await catalogCard(modelCatalogs.page, mcNames.tg)
        .getByRole("button", { name: /details/i })
        .click();

      const showPage = modelCatalogs.page.locator('[data-testid="show-page"]');
      await expect(showPage).toBeVisible();
      await expect(
        showPage.getByText(mcNames.tg, { exact: true }),
      ).toBeVisible();
    });

    test("search filters cards by name", {
      tag: "@C2613180",
    }, async ({ modelCatalogs }) => {
      await gotoCatalogList(modelCatalogs.page);
      await expect(catalogCard(modelCatalogs.page, mcNames.tg)).toBeVisible();

      await modelCatalogs.page
        .getByPlaceholder(/search by name/i)
        .fill(mcNames.te);

      await expect(catalogCard(modelCatalogs.page, mcNames.te)).toBeVisible();
      await expect(catalogCard(modelCatalogs.page, mcNames.tg)).toHaveCount(0);
    });
  });

  // ────────────────────────────────────────────────────────────
  // Detail tests (uses MC_TR — has full resource/replica config)
  // ────────────────────────────────────────────────────────────
  test.describe("detail", () => {
    test("show page displays name, workspace, timestamps, and status", {
      tag: "@C2613178",
    }, async ({ modelCatalogs }) => {
      await modelCatalogs.goToShow(mcNames.tr);

      const showPage = modelCatalogs.page.locator('[data-testid="show-page"]');
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
    });

    test("workspace link navigates to workspace detail", {
      tag: "@C2613184",
    }, async ({ modelCatalogs }) => {
      await modelCatalogs.goToShow(mcNames.tr);

      const showPage = modelCatalogs.page.locator('[data-testid="show-page"]');
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
    });

    test("show page displays engine, model, and task info", {
      tag: "@C2613185",
    }, async ({ modelCatalogs }) => {
      await modelCatalogs.goToShow(mcNames.tr);

      const showPage = modelCatalogs.page.locator('[data-testid="show-page"]');

      // Engine
      const engineDt = showPage.locator("dt", { hasText: /^engine$/i });
      await expect(engineDt).toBeVisible();
      await expect(
        showPage.getByRole("link", {
          name: `${config.engine.name}:${config.engine.version}`,
        }),
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
    });

    test("show page displays deployment config (replicas and scheduler)", {
      tag: "@C2613186",
    }, async ({ modelCatalogs }) => {
      await modelCatalogs.goToShow(mcNames.tr);

      const showPage = modelCatalogs.page.locator('[data-testid="show-page"]');

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
    });

    test("show page displays resources (GPU, CPU, Memory)", {
      tag: "@C2622605",
    }, async ({ modelCatalogs }) => {
      await modelCatalogs.goToShow(mcNames.tr);

      const showPage = modelCatalogs.page.locator('[data-testid="show-page"]');

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
    });
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
        testInfo.setTimeout(MULTI_USER_TIMEOUT);

        const testUser = await createTestUser(["model_catalog:read"]);

        await gotoCatalogList(testUser.page);
        await expect(testUser.page.locator(CATALOG_CARD).first()).toBeVisible();
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
        testInfo.setTimeout(MULTI_USER_TIMEOUT);

        const testUser = await createTestUser(["role:read"]);

        await gotoCatalogList(testUser.page);

        await expect(
          testUser.page.getByText(/no model catalogs/i),
        ).toBeVisible();
      },
    );
  });
});

// ────────────────────────────────────────────────────────────
// Create tests (YAML import)
// ────────────────────────────────────────────────────────────
test.describe("model catalogs create", () => {
  test("no create button on list page, only YAML import supported", {
    tag: "@C2613187",
  }, async ({ modelCatalogs }) => {
    await gotoCatalogList(modelCatalogs.page);

    // No Create link/button
    await expect(
      modelCatalogs.page.getByRole("link", { name: /create/i }),
    ).toBeHidden();

    // The catalog list's own Import dialog trigger should be visible — this
    // page is import-only (see ImportDialog.tsx), distinct from the global
    // navbar "Import YAML" button which imports other resource kinds.
    await expect(
      modelCatalogs.page.getByRole("button", { name: "Import", exact: true }),
    ).toBeVisible();
  });

  test("admin can import model catalog via YAML and verify all fields", {
    tag: ["@C2612861", "@C2613188"],
  }, async ({ modelCatalogs }) => {
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
    await gotoCatalogList(modelCatalogs.page);
    const dialog = await mcImportPaste(modelCatalogs.page, yaml);
    await expect(dialog.getByText("OK", { exact: true })).toBeVisible();
    await closeMcImportDialog(modelCatalogs.page);

    // Verify the card appears, then open its detail page
    await expect(catalogCard(modelCatalogs.page, mcName)).toBeVisible();
    await catalogCard(modelCatalogs.page, mcName)
      .getByRole("button", { name: /details/i })
      .click();
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
      showPage.getByRole("link", {
        name: `${config.engine.name}:${config.engine.version}`,
      }),
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
    await gotoCatalogList(modelCatalogs.page);
    await deleteCatalogCardByName(modelCatalogs.page, mcName);
  });

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
      testInfo.setTimeout(MULTI_USER_TIMEOUT);

      const testUser = await createTestUser([
        "model_catalog:create",
        "model_catalog:read",
      ]);

      const mcName = `test-mc-imp-${Date.now()}`;
      const yaml = modelCatalogYaml(mcName);

      await gotoCatalogList(testUser.page);
      const dialog = await mcImportPaste(testUser.page, yaml);
      await expect(dialog.getByText("OK", { exact: true })).toBeVisible();
      await closeMcImportDialog(testUser.page);

      await expect(catalogCard(testUser.page, mcName)).toBeVisible();

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
      testInfo.setTimeout(MULTI_USER_TIMEOUT);

      const testUser = await createTestUser(["model_catalog:read"]);

      const mcName = `test-mc-imp-${Date.now()}`;
      const yaml = modelCatalogYaml(mcName);

      await gotoCatalogList(testUser.page);
      const dialog = await mcImportPaste(testUser.page, yaml);
      await expect(dialog.getByText("FAIL", { exact: true })).toBeVisible();
      await closeMcImportDialog(testUser.page);

      // Model catalog should NOT appear in the list
      await expect(catalogCard(testUser.page, mcName)).toHaveCount(0);
    },
  );
});

// ────────────────────────────────────────────────────────────
// Delete tests
// ────────────────────────────────────────────────────────────
test.describe("model catalogs delete", () => {
  test("can delete from list card", {
    tag: ["@C2613192", "@C2612870"],
  }, async ({ modelCatalogs, apiHelper }) => {
    const mcName = `test-mc-del-${Date.now()}`;
    await apiHelper.createModelCatalog(mcName);

    await gotoCatalogList(modelCatalogs.page);
    // deleteCatalogCardByName already waits (with DELETE_TIMEOUT) for the
    // controller-reconciled removal before returning.
    await deleteCatalogCardByName(modelCatalogs.page, mcName);
  });

  test("can delete from detail page action menu", {
    tag: "@C2613193",
  }, async ({ modelCatalogs, apiHelper }) => {
    const mcName = `test-mc-del-${Date.now()}`;
    await apiHelper.createModelCatalog(mcName);

    await modelCatalogs.goToShow(mcName);
    await deleteFromShowPageActionMenu(modelCatalogs.page, mcName);
  });

  test("admin can delete model catalog", {
    tag: "@C2613194",
  }, async ({ modelCatalogs, apiHelper }) => {
    const mcName = `test-mc-del-${Date.now()}`;
    await apiHelper.createModelCatalog(mcName);

    await gotoCatalogList(modelCatalogs.page);
    await deleteCatalogCardByName(modelCatalogs.page, mcName);
  });
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
      testInfo.setTimeout(MULTI_USER_TIMEOUT);

      const mcName = `test-mc-del-${Date.now()}`;
      await apiHelper.createModelCatalog(mcName);

      const testUser = await createTestUser([
        "model_catalog:read",
        "model_catalog:delete",
      ]);

      await gotoCatalogList(testUser.page);
      await deleteCatalogCardByName(testUser.page, mcName);
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
      testInfo.setTimeout(MULTI_USER_TIMEOUT);

      const mcName = `test-mc-del-${Date.now()}`;
      await apiHelper.createModelCatalog(mcName);

      const testUser = await createTestUser(["model_catalog:read"]);

      await gotoCatalogList(testUser.page);
      await expect(catalogCard(testUser.page, mcName)).toBeVisible();

      // Attempt delete from the card — API should reject with 403
      await catalogCard(testUser.page, mcName)
        .getByRole("button", { name: /delete/i })
        .click();

      const dialog = testUser.page.getByRole("alertdialog");
      await dialog.waitFor({ state: "visible" });
      await dialog.getByRole("button", { name: /delete/i }).click();

      // Delete should fail — card still visible after the attempt
      await dialog.waitFor({ state: "hidden" });
      await expect(catalogCard(testUser.page, mcName)).toBeVisible();

      // Cleanup
      await apiHelper.deleteModelCatalog(mcName).catch(() => {});
    },
  );
});
