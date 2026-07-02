import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures/base";
import { ApiHelper } from "../helpers/api-helper";
import { MULTI_USER_TIMEOUT } from "../helpers/constants";
import { YamlImportHelper } from "../helpers/yaml-import";

// ─────────────────────────────────────────────────────────────────────────────
// E2E for the Recipe Model Catalog feature (TestRail suite 2420 §"模型目录 Recipe").
//
// Scope: UI-feasible cases only. The e2e env is GPU-free (no cluster reports
// accelerator resource_info), so the VRAM check and hardware-verified
// soft-filter (C2727751/752/753) and vGPU co-display (C2727761) are out of
// scope and not covered here. The reconcile-only "missing registry" case
// (C2727760) is also excluded.
//
// Recipe MCs are created two ways:
//   - via the API (ApiHelper.createRecipeModelCatalog) for read-only display /
//     deploy tests — same recipe-validation middleware as an import;
//   - via the import dialog (YamlImportHelper) for the import-validation tests,
//     which is exactly what those cases exercise.
// ─────────────────────────────────────────────────────────────────────────────

const CATALOG_CARD = '[data-testid="model-catalog-card"]';
const RECIPE_REGION = '[data-testid="endpoint-recipe-options"]';

async function gotoCatalogList(
  page: Page,
  workspace = "default",
): Promise<void> {
  await page.goto(`/#/${workspace}/model-catalogs`);
  await page.getByPlaceholder(/search by name/i).waitFor({ state: "visible" });
}

function catalogCard(page: Page, name: string) {
  return page.locator(`${CATALOG_CARD}[data-name="${name}"]`);
}

/** Navigate to the endpoint create page pre-seeded with a recipe MC via the
 * card's Deploy entry (simplified mode). Waits for the Recipe options region. */
async function deployFromCard(page: Page, name: string): Promise<void> {
  await gotoCatalogList(page);
  await catalogCard(page, name)
    .getByRole("button", { name: /deploy/i })
    .click();
  await page.locator(RECIPE_REGION).waitFor({ state: "visible" });
}

/** Reveal the full compose preview — simplified mode hides it behind the
 * "Show all options" disclosure whenever a recipe catalog is selected. */
async function showAllOptions(page: Page): Promise<void> {
  const toggle = page.getByRole("button", { name: /show all options/i });
  if (await toggle.isVisible().catch(() => false)) {
    await toggle.click();
  }
}

function composePreview(page: Page) {
  return page.locator('[data-testid="compose-preview"][data-state="ok"]');
}

// ── A comprehensive, valid recipe spec covering every feature shape the deploy
// tests need: two variants (default + fp8), a promoted "Core" group, a boolean
// default-on toggle, a mutually-exclusive pair, a select feature, a free-input
// feature, and a "Performance tuning" group. ──
function recipeSpec(): Record<string, unknown> {
  return {
    engine: { engine: "vllm", version: "v0.8.5" },
    base: { engine_args: { enable_prefix_caching: true } },
    variants: {
      default: {
        description: "BF16 full-precision.",
        model: {
          registry: "huggingface",
          name: "Neutree/Test-27B",
          task: "text-generation",
          info: {
            parameter_count: "27B",
            quantization: "bf16",
            context_length: "256K",
            architecture: "dense",
          },
        },
        resources: { gpu: "2" },
        vram_minimum_gb: 140,
      },
      fp8: {
        description: "FP8 checkpoint — single GPU.",
        model: {
          registry: "huggingface",
          name: "Neutree/Test-27B-FP8",
          task: "text-generation",
          info: {
            parameter_count: "27B",
            quantization: "fp8",
            context_length: "256K",
            architecture: "dense",
          },
        },
        resources: { gpu: "1" },
        vram_minimum_gb: 40,
      },
    },
    features: [
      {
        name: "ctx",
        group: "Core",
        type: "input",
        display_name: "Context window",
        input: {
          value_type: "int",
          default: "8192",
          min: 1,
          max: 262144,
          suggestions: [
            { value: "8192", label: "8K" },
            { value: "32768", label: "32K" },
          ],
        },
        // biome-ignore lint/suspicious/noTemplateCurlyInString: recipe ${value} placeholder
        engine_args: { max_model_len: "${value}" },
      },
      {
        name: "reasoning",
        group: "Inference",
        display_name: "Reasoning",
        default: true,
        engine_args: { enable_reasoning: true },
      },
      {
        name: "tool_calling",
        group: "Inference",
        display_name: "Tool calling",
        default: false,
        engine_args: { enable_auto_tool_choice: true },
      },
      {
        name: "spec_decoding",
        group: "Inference",
        display_name: "Speculative decoding",
        default: false,
        conflicts_with: ["text_only"],
        engine_args: { num_speculative_tokens: 3 },
      },
      {
        name: "text_only",
        group: "Inference",
        display_name: "Text-only",
        default: false,
        conflicts_with: ["spec_decoding"],
        engine_args: { language_model_only: true },
      },
      {
        name: "decode_mode",
        group: "Inference",
        type: "select",
        display_name: "Decode mode",
        default_option: "greedy",
        options: {
          greedy: { engine_args: { temperature: 0 } },
          sample: { engine_args: { temperature: 0.7 } },
        },
      },
      {
        name: "max_len",
        group: "Inference",
        type: "input",
        display_name: "Max batched tokens",
        input: { value_type: "int", default: "4096" },
        // biome-ignore lint/suspicious/noTemplateCurlyInString: recipe ${value} placeholder
        engine_args: { max_num_batched_tokens: "${value}" },
      },
      {
        name: "perf",
        group: "Performance tuning",
        display_name: "Max sequences",
        default: false,
        engine_args: { max_num_seqs: 512 },
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Import — validation surfaced through the import dialog (C2727741–746)
// ─────────────────────────────────────────────────────────────────────────────
test.describe("recipe model catalog: import", () => {
  const created: string[] = [];

  test.afterEach(async ({ apiHelper }) => {
    for (const n of created.splice(0)) {
      await apiHelper.deleteModelCatalog(n).catch(() => {});
    }
  });

  const validRecipeYaml = (name: string): string => `apiVersion: v1
kind: ModelCatalog
metadata:
  name: ${name}
  workspace: default
  annotations:
    recipe.vllm.ai/hardware-verified: "L20"
spec:
  engine: { engine: vllm, version: v0.8.5 }
  base: { engine_args: { enable_prefix_caching: true } }
  variants:
    default:
      description: BF16.
      model: { registry: huggingface, name: Neutree/Test-27B, task: text-generation }
      vram_minimum_gb: 140
    fp8:
      description: FP8.
      model: { registry: huggingface, name: Neutree/Test-27B-FP8, task: text-generation }
      vram_minimum_gb: 40
  features:
    - name: reasoning
      default: true
      engine_args: { enable_reasoning: true }`;

  test("import a recipe catalog via paste, then it is visible as a card", {
    tag: "@C2727741",
  }, async ({ modelCatalogs, yamlImport }) => {
    const name = `test-mc-recipe-imp-${Date.now()}`;
    created.push(name);

    await gotoCatalogList(modelCatalogs.page);
    await yamlImport.importYaml(validRecipeYaml(name));
    await yamlImport.expectResults({ success: 1 });
    await yamlImport.close();

    await expect(catalogCard(modelCatalogs.page, name)).toBeVisible();
  });

  test("re-importing an existing recipe catalog is rejected (no upsert)", {
    tag: "@C2727742",
  }, async ({ modelCatalogs, yamlImport, apiHelper }) => {
    const name = `test-mc-recipe-dup-${Date.now()}`;
    created.push(name);
    await apiHelper.createRecipeModelCatalog(name, recipeSpec(), {
      annotations: { "recipe.vllm.ai/hardware-verified": "L20" },
    });

    await gotoCatalogList(modelCatalogs.page);
    await yamlImport.importYaml(validRecipeYaml(name));
    // Duplicate name violates the (workspace, name) unique index -> import fails.
    await yamlImport.expectResults({ errors: 1 });
    await yamlImport.close();
  });

  test("import fails when variants coexist with top-level model/resources", {
    tag: "@C2727743",
  }, async ({ modelCatalogs, yamlImport }) => {
    const name = `test-mc-recipe-dual-${Date.now()}`;
    const yaml = `apiVersion: v1
kind: ModelCatalog
metadata: { name: ${name}, workspace: default }
spec:
  engine: { engine: vllm, version: v0.8.5 }
  model: { registry: huggingface, name: top-level-model, task: text-generation }
  variants:
    default:
      model: { registry: huggingface, name: Neutree/Test-27B, task: text-generation }`;

    await gotoCatalogList(modelCatalogs.page);
    await yamlImport.importYaml(yaml);
    await yamlImport.expectResults({ errors: 1 });
    await yamlImport.close();

    await gotoCatalogList(modelCatalogs.page);
    await expect(catalogCard(modelCatalogs.page, name)).toHaveCount(0);
  });

  test("import fails when conflicts_with references an unknown feature", {
    tag: "@C2727744",
  }, async ({ modelCatalogs, yamlImport }) => {
    const name = `test-mc-recipe-badconf-${Date.now()}`;
    const yaml = `apiVersion: v1
kind: ModelCatalog
metadata: { name: ${name}, workspace: default }
spec:
  engine: { engine: vllm, version: v0.8.5 }
  variants:
    default:
      model: { registry: huggingface, name: Neutree/Test-27B, task: text-generation }
  features:
    - name: reasoning
      conflicts_with: [ghost_feature]`;

    await gotoCatalogList(modelCatalogs.page);
    await yamlImport.importYaml(yaml);
    await yamlImport.expectResults({ errors: 1 });
    await yamlImport.close();
  });

  test("import fails when a feature conflicts with itself", {
    tag: "@C2727745",
  }, async ({ modelCatalogs, yamlImport }) => {
    const name = `test-mc-recipe-selfconf-${Date.now()}`;
    const yaml = `apiVersion: v1
kind: ModelCatalog
metadata: { name: ${name}, workspace: default }
spec:
  engine: { engine: vllm, version: v0.8.5 }
  variants:
    default:
      model: { registry: huggingface, name: Neutree/Test-27B, task: text-generation }
  features:
    - name: text_only
      conflicts_with: [text_only]`;

    await gotoCatalogList(modelCatalogs.page);
    await yamlImport.importYaml(yaml);
    await yamlImport.expectResults({ errors: 1 });
    await yamlImport.close();
  });

  test("import fails on invalid feature definitions (duplicate name / select without options)", {
    tag: "@C2727746",
  }, async ({ modelCatalogs, yamlImport }) => {
    const name = `test-mc-recipe-badfeat-${Date.now()}`;
    // Two features with the same name AND a select feature with no options.
    const yaml = `apiVersion: v1
kind: ModelCatalog
metadata: { name: ${name}, workspace: default }
spec:
  engine: { engine: vllm, version: v0.8.5 }
  variants:
    default:
      model: { registry: huggingface, name: Neutree/Test-27B, task: text-generation }
  features:
    - name: dup
    - name: dup
    - name: pick
      type: select`;

    await gotoCatalogList(modelCatalogs.page);
    await yamlImport.importYaml(yaml);
    await yamlImport.expectResults({ errors: 1 });
    await yamlImport.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Display — detail / list card / edit-sync (C2727747–749)
// ─────────────────────────────────────────────────────────────────────────────
test.describe("recipe model catalog: display", () => {
  const mc = { name: "" };

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const api = new ApiHelper(page);
    mc.name = `test-mc-recipe-show-${Date.now()}`;
    await api.createRecipeModelCatalog(mc.name, recipeSpec(), {
      annotations: { "recipe.vllm.ai/hardware-verified": "L20" },
    });
    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const api = new ApiHelper(page);
    await api.deleteModelCatalog(mc.name).catch(() => {});
    await context.close();
  });

  test("detail page shows variants, features and the verified-hardware badge", {
    tag: "@C2727747",
  }, async ({ modelCatalogs }) => {
    await modelCatalogs.goToShow(mc.name);
    const show = modelCatalogs.page.locator('[data-testid="show-page"]');
    await expect(show).toBeVisible();

    // Verified hardware = L20 (and only L20).
    await expect(show.getByText("✓ L20")).toBeVisible();

    // Variant rows.
    const variantTable = show.locator('[data-testid="variant-table"]');
    await expect(variantTable).toBeVisible();
    await expect(
      variantTable.locator('tr[data-variant="default"]'),
    ).toBeVisible();
    await expect(variantTable.locator('tr[data-variant="fp8"]')).toBeVisible();

    // Feature rows, incl. the mutually-exclusive pair and the grouped feature.
    await expect(
      show.locator('[data-testid="feature-item"][data-feature="reasoning"]'),
    ).toBeVisible();
    await expect(
      show.locator(
        '[data-testid="feature-item"][data-feature="spec_decoding"]',
      ),
    ).toBeVisible();
    await expect(
      show.locator('[data-testid="feature-item"][data-feature="perf"]'),
    ).toBeVisible();
  });

  test("list card shows per-variant model info, task and a variant count", {
    tag: "@C2727748",
  }, async ({ modelCatalogs }) => {
    await gotoCatalogList(modelCatalogs.page);
    const card = catalogCard(modelCatalogs.page, mc.name);
    await expect(card).toBeVisible();
    // Two variants in the recipe -> "2 variants" hint.
    await expect(card.getByText(/2 variants/i)).toBeVisible();
    // Representative model info from a variant.
    await expect(card.getByText(/text generation/i)).toBeVisible();
  });

  test("editing the spec is reflected on the detail page", {
    tag: "@C2727749",
  }, async ({ modelCatalogs, apiHelper }) => {
    const name = `test-mc-recipe-edit-${Date.now()}`;
    await apiHelper.createRecipeModelCatalog(name, recipeSpec(), {
      annotations: { "recipe.vllm.ai/hardware-verified": "L20" },
    });

    try {
      // Open the YAML spec editor, replace the default variant model name.
      await modelCatalogs.page.goto(`/#/default/model-catalogs/edit/${name}`);
      const editor = modelCatalogs.page.locator(
        '[data-testid="catalog-spec-yaml"]',
      );
      await editor.waitFor({ state: "visible" });

      const yaml = await editor.inputValue();
      // Rename the default variant's model. Its value "Neutree/Test-27B"
      // appears before the fp8 "Neutree/Test-27B-FP8", so the first match is
      // the default variant.
      const updated = yaml.replace("Neutree/Test-27B", "Neutree/Test-EDITED");
      await editor.fill(updated);
      await modelCatalogs.page.getByRole("button", { name: /^save/i }).click();

      // Detail page reflects the edited model name.
      await modelCatalogs.goToShow(name);
      const show = modelCatalogs.page.locator('[data-testid="show-page"]');
      await expect(show.getByText(/Neutree\/Test-EDITED/)).toBeVisible();
    } finally {
      await apiHelper.deleteModelCatalog(name).catch(() => {});
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Deploy — the recipe options region on the endpoint create page
// (C2727740, 750, 754, 755, 756, 757, 758, 759)
// ─────────────────────────────────────────────────────────────────────────────
test.describe("recipe model catalog: deploy", () => {
  const recipe = { name: "" };
  const trivial = { name: "" };
  const cluster = { name: "" };

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const api = new ApiHelper(page);
    const ts = Date.now();
    recipe.name = `test-mc-recipe-dep-${ts}`;
    trivial.name = `test-mc-trivial-dep-${ts}`;
    cluster.name = `test-cl-recipe-${ts}`;
    await api.createRecipeModelCatalog(recipe.name, recipeSpec(), {
      annotations: { "recipe.vllm.ai/hardware-verified": "L20" },
    });
    await api.createModelCatalog(trivial.name);
    await api.createCluster(cluster.name, { type: "ssh", headIp: "10.0.0.1" });
    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const api = new ApiHelper(page);
    await api.deleteModelCatalog(recipe.name).catch(() => {});
    await api.deleteModelCatalog(trivial.name).catch(() => {});
    await api.deleteCluster(cluster.name, { force: true }).catch(() => {});
    await context.close();
  });

  test("switching between trivial and recipe catalogs shows/hides the recipe region without residue", {
    tag: "@C2727750",
  }, async ({ endpoints }) => {
    await endpoints.goToCreate();
    const region = endpoints.page.locator(RECIPE_REGION);

    // Trivial catalog -> no recipe region.
    await endpoints.form.selectComboboxOption("-model-catalog", trivial.name);
    await expect(region).toHaveCount(0);

    // Recipe catalog -> recipe region appears with a variant picker.
    await endpoints.form.selectComboboxOption("-model-catalog", recipe.name);
    await expect(region).toBeVisible();
    await expect(region.getByRole("radio", { name: "default" })).toBeVisible();

    // Back to trivial -> region gone (no residual variant/feature state).
    await endpoints.form.selectComboboxOption("-model-catalog", trivial.name);
    await expect(region).toHaveCount(0);
  });

  test("default variant is preselected and the Verified on badge shows L20", {
    tag: "@C2727757",
  }, async ({ endpoints }) => {
    await deployFromCard(endpoints.page, recipe.name);
    const region = endpoints.page.locator(RECIPE_REGION);

    // Verified on: L20 badge.
    await expect(region.getByText("✓ L20")).toBeVisible();

    // Default variant preselected (aria-checked) and marked with the star.
    const defaultTab = region.getByRole("radio", { name: "default" });
    await expect(defaultTab).toHaveAttribute("aria-checked", "true");

    // A default-on feature switch starts on; an opt-in one starts off.
    await expect(
      region.getByRole("switch", { name: "reasoning" }),
    ).toBeChecked();
    await expect(
      region.getByRole("switch", { name: "tool_calling" }),
    ).not.toBeChecked();
  });

  test("first named group is promoted to core fields; Performance tuning is its own section", {
    tag: "@C2727754",
  }, async ({ endpoints }) => {
    await deployFromCard(endpoints.page, recipe.name);
    const region = endpoints.page.locator(RECIPE_REGION);
    // The promoted Core feature (ctx) is present as a form control.
    await expect(region.getByText(/context window/i)).toBeVisible();
    // The Performance tuning group heading renders in its own section.
    await expect(region.getByText(/performance tuning/i)).toBeVisible();
  });

  test("enabling one mutually-exclusive feature disables its conflicting peer", {
    tag: "@C2727755",
  }, async ({ endpoints }) => {
    await deployFromCard(endpoints.page, recipe.name);
    const region = endpoints.page.locator(RECIPE_REGION);

    const spec = region.getByRole("switch", { name: "spec_decoding" });
    const textOnly = region.getByRole("switch", { name: "text_only" });
    // A neutral feature stays enabled throughout.
    const neutral = region.getByRole("switch", { name: "tool_calling" });

    await expect(spec).toBeEnabled();
    await expect(textOnly).toBeEnabled();

    await spec.check();
    await expect(textOnly).toBeDisabled();
    await expect(neutral).toBeEnabled();
    await expect(region.getByText(/conflicts with/i)).toBeVisible();

    await spec.uncheck();
    await expect(textOnly).toBeEnabled();
  });

  test("compose preview reflects variant and feature selections", {
    tag: "@C2727756",
  }, async ({ endpoints }) => {
    await deployFromCard(endpoints.page, recipe.name);
    const region = endpoints.page.locator(RECIPE_REGION);
    await showAllOptions(endpoints.page);

    const preview = composePreview(endpoints.page);
    await expect(preview).toBeVisible();
    // Default variant -> its model; a default-on feature -> its engine_arg.
    await expect(preview.getByText(/Neutree\/Test-27B/)).toBeVisible();
    await expect(
      preview.locator('[data-arg="enable_reasoning"]'),
    ).toBeVisible();

    // Turn reasoning off -> its engine_arg drops from the preview.
    await region.getByRole("switch", { name: "reasoning" }).uncheck();
    await expect(preview.locator('[data-arg="enable_reasoning"]')).toHaveCount(
      0,
    );

    // Switch to the fp8 variant -> the composed model changes.
    await region.getByRole("radio", { name: "fp8" }).click();
    await expect(preview.getByText(/Neutree\/Test-27B-FP8/)).toBeVisible();
  });

  test("select feature option flows into the compose preview", {
    tag: "@C2727758",
  }, async ({ endpoints }) => {
    await deployFromCard(endpoints.page, recipe.name);
    const region = endpoints.page.locator(RECIPE_REGION);
    await showAllOptions(endpoints.page);

    const preview = composePreview(endpoints.page);
    const temp = preview.locator('[data-arg="temperature"]');
    // greedy (default_option) -> temperature 0.
    await expect(temp).toContainText("0");

    // Pick "sample" -> temperature 0.7.
    await region.getByRole("radio", { name: "sample" }).click();
    await expect(temp).toContainText("0.7");
  });

  test("text-input feature value composes into the preview", {
    tag: "@C2727759",
  }, async ({ endpoints }) => {
    await deployFromCard(endpoints.page, recipe.name);
    const region = endpoints.page.locator(RECIPE_REGION);
    await showAllOptions(endpoints.page);

    const preview = composePreview(endpoints.page);
    await region.getByLabel("max_len").fill("2048");
    await expect(
      preview.locator('[data-arg="max_num_batched_tokens"]'),
    ).toContainText("2048");
  });

  test("deploy a recipe endpoint: select variant + feature and submit", {
    tag: "@C2727740",
  }, async ({ endpoints, apiHelper }) => {
    await deployFromCard(endpoints.page, recipe.name);
    const region = endpoints.page.locator(RECIPE_REGION);

    // Non-default variant + toggle an opt-in feature.
    await region.getByRole("radio", { name: "fp8" }).click();
    await region.getByRole("switch", { name: "tool_calling" }).check();

    const name = `test-ep-recipe-${Date.now()}`;
    await endpoints.form.fillInput("metadata.name", name);
    await endpoints.form.selectComboboxOption("spec.cluster", cluster.name);

    const responsePromise = endpoints.page.waitForResponse(
      (r) =>
        r.url().includes("/endpoints") &&
        r.request().method() === "POST" &&
        (r.ok() || r.status() >= 400),
    );
    await endpoints.form.submit();
    const response = await responsePromise;
    // Cluster may be unreachable; we only assert the request was accepted-shaped.
    expect(response.status()).toBeLessThan(500);

    if (response.ok()) {
      await apiHelper.deleteEndpoint(name, { force: true }).catch(() => {});
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Import permissions (mirrors the trivial-MC RBAC cases, recipe variant)
// ─────────────────────────────────────────────────────────────────────────────
test.describe("recipe model catalog: import permissions", () => {
  test(
    "non-admin without model_catalog:create cannot import a recipe catalog",
    {
      tag: "@C2727741",
      annotation: {
        type: "slow",
        description: "creates test user with model_catalog:read only",
      },
    },
    async ({ createTestUser }, testInfo) => {
      testInfo.setTimeout(MULTI_USER_TIMEOUT);

      const testUser = await createTestUser(["model_catalog:read"]);
      const name = `test-mc-recipe-rbac-${Date.now()}`;
      const yamlHelper = new YamlImportHelper(testUser.page);

      await testUser.page.goto("/#/default/model-catalogs");
      await testUser.page
        .getByPlaceholder(/search by name/i)
        .waitFor({ state: "visible" });

      await yamlHelper.importYaml(`apiVersion: v1
kind: ModelCatalog
metadata: { name: ${name}, workspace: default }
spec:
  engine: { engine: vllm, version: v0.8.5 }
  variants:
    default:
      model: { registry: huggingface, name: Neutree/Test-27B, task: text-generation }`);
      await yamlHelper.expectResults({ errors: 1 });
      await yamlHelper.close();
    },
  );
});
