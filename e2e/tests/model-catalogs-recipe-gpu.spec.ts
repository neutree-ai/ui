import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures/base";
import { ApiHelper } from "../helpers/api-helper";

// ─────────────────────────────────────────────────────────────────────────────
// GPU-dependent Recipe Model Catalog cases (TestRail §模型目录 Recipe):
//   C2727751 — Verified-on badge + accelerator soft-filter + Show all options
//   C2727752 — VRAM check sufficient / insufficient, advisory (non-blocking)
//   C2727753 — VRAM unknown → no badge (never a false "insufficient")
//   C2727740 — full deploy of a variant+features endpoint to Running
//
// These need a cluster whose status.resource_info reports a real NVIDIA GPU.
// Gate: set E2E_GPU_CLUSTER to the name of a Running cluster backed by a GPU
// node (e.g. a g4dn/T4 static node), and E2E_GPU_PRODUCT to the bare
// accelerator model token the cluster reports (default "T4").
// ─────────────────────────────────────────────────────────────────────────────

const GPU_CLUSTER = process.env.E2E_GPU_CLUSTER ?? "";
const GPU_PRODUCT = process.env.E2E_GPU_PRODUCT ?? "T4";

const RECIPE_REGION = '[data-testid="endpoint-recipe-options"]';
const VRAM_BADGE = '[data-testid="vram-check-badge"]';

async function gotoCatalogList(page: Page): Promise<void> {
  await page.goto("/#/default/model-catalogs");
  await page.getByPlaceholder(/search by name/i).waitFor({ state: "visible" });
}

async function deployFromCard(page: Page, name: string): Promise<void> {
  await gotoCatalogList(page);
  const card = page.locator(
    `[data-testid="model-catalog-card"][data-name="${name}"]`,
  );
  await card.waitFor({ state: "visible" });
  await card.getByRole("button", { name: /deploy/i }).click();
  await page.locator(RECIPE_REGION).waitFor({ state: "visible" });
}

async function pickAccelerator(page: Page): Promise<void> {
  await page
    .locator('[data-testid="field-spec.resources.accelerator"] button')
    .first()
    .click();
  await page
    .locator('[data-state="open"][role="dialog"]')
    .getByRole("option", { name: new RegExp(GPU_PRODUCT) })
    .first()
    .click();
}

/** Recipe MC whose hardware-verified set intersects the GPU cluster. Variants
 * cover the three VRAM-check outcomes on a ~15 GB card. */
function hwRecipeSpec(registry: string): Record<string, unknown> {
  return {
    engine: { engine: "vllm", version: "v0.8.5" },
    base: { engine_args: { enable_prefix_caching: true, dtype: "half" } },
    variants: {
      default: {
        description: "Fits any modern GPU.",
        model: {
          registry,
          name: "Qwen/Qwen2.5-0.5B-Instruct",
          task: "text-generation",
          info: { parameter_count: "0.5B", quantization: "fp16" },
        },
        resources: { gpu: "1" },
        vram_minimum_gb: 4,
      },
      big: {
        description: "Deliberately larger than any single card here.",
        model: {
          registry,
          name: "Qwen/Qwen2.5-0.5B-Instruct",
          task: "text-generation",
        },
        resources: { gpu: "1" },
        vram_minimum_gb: 999,
      },
      nolimit: {
        description: "No declared VRAM floor.",
        model: {
          registry,
          name: "Qwen/Qwen2.5-0.5B-Instruct",
          task: "text-generation",
        },
        resources: { gpu: "1" },
      },
    },
    features: [
      {
        name: "ctx",
        group: "Core",
        type: "input",
        display_name: "Context window",
        input: { value_type: "int", default: "8192", min: 1, max: 262144 },
        // biome-ignore lint/suspicious/noTemplateCurlyInString: recipe ${value} placeholder
        engine_args: { max_model_len: "${value}" },
      },
      {
        name: "eager",
        group: "Inference",
        display_name: "Eager mode",
        default: false,
        engine_args: { enforce_eager: true },
      },
    ],
  };
}

test.describe("recipe model catalog: GPU cluster", () => {
  test.skip(
    !GPU_CLUSTER,
    "needs E2E_GPU_CLUSTER pointing at a Running GPU-backed cluster",
  );

  const mr = { name: "" };
  const mcHw = { name: "" }; // verified set intersects the cluster (GPU_PRODUCT)
  const mcFar = { name: "" }; // verified set disjoint from the cluster (H100)

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const api = new ApiHelper(page);
    const ts = Date.now();
    mr.name = `test-mr-gpu-${ts}`;
    mcHw.name = `test-mc-gpu-hw-${ts}`;
    mcFar.name = `test-mc-gpu-far-${ts}`;
    await api.createModelRegistry(mr.name);
    await api.createRecipeModelCatalog(mcHw.name, hwRecipeSpec(mr.name), {
      annotations: { "recipe.vllm.ai/hardware-verified": GPU_PRODUCT },
    });
    await api.createRecipeModelCatalog(mcFar.name, hwRecipeSpec(mr.name), {
      annotations: { "recipe.vllm.ai/hardware-verified": "H100" },
    });
    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    test.setTimeout(60_000);
    const context = await browser.newContext();
    const page = await context.newPage();
    const api = new ApiHelper(page);
    await api.deleteModelCatalog(mcHw.name).catch(() => {});
    await api.deleteModelCatalog(mcFar.name).catch(() => {});
    await api
      .deleteModelRegistry(mr.name, { retries: 10 })
      .catch(() => {});
    await context.close();
  });

  test("verified hardware intersecting the cluster keeps the accelerator picker filtered", {
    tag: "@C2727751",
  }, async ({ endpoints }) => {
    await deployFromCard(endpoints.page, mcHw.name);
    const region = endpoints.page.locator(RECIPE_REGION);
    await expect(region.getByText(`✓ ${GPU_PRODUCT}`)).toBeVisible();

    await endpoints.form.selectComboboxOption("spec.cluster", GPU_CLUSTER);

    // Intersection is non-empty -> the picker offers the verified product and
    // the "no validated GPU" notice must NOT appear.
    await expect(
      endpoints.page.getByText(/no validated gpu available/i),
    ).toHaveCount(0);
    await endpoints.page
      .locator('[data-testid="field-spec.resources.accelerator"] button')
      .first()
      .click();
    await expect(
      endpoints.page
        .locator('[data-state="open"][role="dialog"]')
        .getByRole("option", { name: new RegExp(GPU_PRODUCT) })
        .first(),
    ).toBeVisible();
  });

  test("disjoint verified hardware hides the picker until Show all options", {
    tag: "@C2727751",
  }, async ({ endpoints }) => {
    await deployFromCard(endpoints.page, mcFar.name);
    const region = endpoints.page.locator(RECIPE_REGION);
    await expect(region.getByText("✓ H100")).toBeVisible();

    await endpoints.form.selectComboboxOption("spec.cluster", GPU_CLUSTER);

    // No intersection -> picker replaced by the advisory notice with the
    // variant's VRAM floor.
    await expect(
      endpoints.page.getByText(/no validated gpu available/i),
    ).toBeVisible();
    await expect(endpoints.page.getByText(/4 GB VRAM/i)).toBeVisible();

    // Show all options reveals every cluster accelerator (incl. the real one).
    await endpoints.page
      .getByRole("button", { name: /show all options/i })
      .click();
    await endpoints.page
      .locator('[data-testid="field-spec.resources.accelerator"] button')
      .first()
      .click();
    await expect(
      endpoints.page
        .locator('[data-state="open"][role="dialog"]')
        .getByRole("option", { name: new RegExp(GPU_PRODUCT) })
        .first(),
    ).toBeVisible();
  });

  test("VRAM check flips sufficient/insufficient with the variant and stays advisory", {
    tag: "@C2727752",
  }, async ({ endpoints }) => {
    await deployFromCard(endpoints.page, mcHw.name);
    const region = endpoints.page.locator(RECIPE_REGION);
    await endpoints.form.selectComboboxOption("spec.cluster", GPU_CLUSTER);
    // The check needs a picked accelerator (it supplies per-GPU memory).
    await pickAccelerator(endpoints.page);

    // default variant: 15 GB card ≥ 4 GB floor -> sufficient.
    const badge = endpoints.page.locator(VRAM_BADGE);
    await expect(badge).toHaveAttribute("data-state", "sufficient");
    await expect(badge.getByText(/sufficient vram/i)).toBeVisible();

    // big variant: floor 999 GB -> insufficient, but submit stays enabled.
    await region.getByRole("radio", { name: "big" }).click();
    // Variant switch recomposes spec.resources; re-pick if cleared.
    if ((await badge.count()) === 0) {
      await pickAccelerator(endpoints.page);
    }
    await expect(badge).toHaveAttribute("data-state", "insufficient");
    await expect(badge.getByText(/insufficient vram/i)).toBeVisible();
    await expect(
      endpoints.page.locator('[data-testid="form-submit"]'),
    ).toBeEnabled();
  });

  test("variant without a VRAM floor renders no badge (unknown, not insufficient)", {
    tag: "@C2727753",
  }, async ({ endpoints }) => {
    await deployFromCard(endpoints.page, mcHw.name);
    const region = endpoints.page.locator(RECIPE_REGION);
    await endpoints.form.selectComboboxOption("spec.cluster", GPU_CLUSTER);
    await pickAccelerator(endpoints.page);

    await region.getByRole("radio", { name: "nolimit" }).click();
    await expect(endpoints.page.locator(VRAM_BADGE)).toHaveCount(0);
    await expect(endpoints.page.getByText(/insufficient vram/i)).toHaveCount(0);
  });

  test(
    "deploy the default variant to Running on the GPU cluster",
    {
      tag: "@C2727740",
      annotation: {
        type: "slow",
        description: "downloads the model and cold-starts vLLM on the GPU node",
      },
    },
    async ({ endpoints, apiHelper }, testInfo) => {
      testInfo.setTimeout(20 * 60_000);

      await deployFromCard(endpoints.page, mcHw.name);
      const region = endpoints.page.locator(RECIPE_REGION);

      // Keep the memory footprint small on a 16 GB card.
      await region.getByLabel("ctx").fill("8192");
      await region.getByRole("switch", { name: "eager" }).check();

      const name = `test-ep-gpu-${Date.now()}`;
      await endpoints.form.fillInput("metadata.name", name);

      const modelLookup = endpoints.page.waitForResponse((r) =>
        r.url().includes("/models?"),
      );
      await endpoints.form.selectComboboxOption("spec.cluster", GPU_CLUSTER);
      await modelLookup.catch(() => {});
      // Without a picked accelerator the orchestrator falls back to the
      // "cpu" engine image, which does not exist for vllm.
      await pickAccelerator(endpoints.page);

      const responsePromise = endpoints.page.waitForResponse(
        (r) =>
          r.url().includes("/endpoints") &&
          r.request().method() === "POST" &&
          (r.ok() || r.status() >= 400),
      );
      await endpoints.form.submit();
      const response = await responsePromise;
      expect(response.ok()).toBeTruthy();

      try {
        // Reconcile: image start + model download + vLLM cold start.
        await expect
          .poll(
            async () => {
              const rows = (await apiHelper.get(
                `/endpoints?metadata->>name=eq.${name}`,
              )) as Array<{
                status?: { phase?: string; error_message?: string | null };
              }>;
              const st = rows[0]?.status;
              if (st?.phase === "Failed") {
                throw new Error(`endpoint Failed: ${st?.error_message}`);
              }
              return st?.phase ?? "";
            },
            { timeout: 18 * 60_000, intervals: [15_000] },
          )
          .toBe("Running");
      } finally {
        await apiHelper.deleteEndpoint(name, { force: true }).catch(() => {});
      }
    },
  );
});
