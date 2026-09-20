import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures/base";
import { MULTI_USER_TIMEOUT } from "../helpers/constants";
import { YamlImportHelper } from "../helpers/yaml-import";

/** Known engines that exist in the test environment */
const ENGINE_LLAMA = "llama-cpp";
const ENGINE_VLLM = "vllm";

const ENGINE_CARD = '[data-testid="engine-card"]';

// The engines list is a card grid, not a table: one card per engine, with the
// newest version and a hover list of the rest. Column sorting, column
// visibility and the workspace column no longer exist on this page, so the
// cases that asserted them were dropped rather than rewritten.
async function gotoEngineList(
  page: Page,
  workspace = "default",
): Promise<void> {
  await page.goto(`/#/${workspace}/engines`);
  await page.getByPlaceholder(/search by name/i).waitFor({ state: "visible" });
}

function engineCard(page: Page, name: string) {
  return page.locator(`${ENGINE_CARD}[data-name="${name}"]`);
}

/** Build an Engine YAML document for import */
function engineYaml(
  name: string,
  opts?: { workspace?: string; version?: string },
): string {
  return `apiVersion: v1
kind: Engine
metadata:
  name: ${name}
  workspace: ${opts?.workspace ?? "default"}
spec:
  versions:
    - version: "${opts?.version ?? "v1.0"}"
      values_schema: {}
  supported_tasks:
    - text-generation`;
}

test.describe("engines list", () => {
  test("list page shows the known engines as cards", {
    tag: ["@C2613049", "@C2613204"],
  }, async ({ engines }) => {
    await gotoEngineList(engines.page);

    await expect(engineCard(engines.page, ENGINE_LLAMA)).toBeVisible();
    await expect(engineCard(engines.page, ENGINE_VLLM)).toBeVisible();
    // The card title is the resource name, not a display name.
    await expect(
      engineCard(engines.page, ENGINE_LLAMA).getByRole("heading", {
        name: ENGINE_LLAMA,
      }),
    ).toBeVisible();
  });

  test("search narrows the grid by engine name", async ({ engines }) => {
    await gotoEngineList(engines.page);

    await engines.page.getByPlaceholder(/search by name/i).fill(ENGINE_VLLM);

    await expect(engineCard(engines.page, ENGINE_VLLM)).toBeVisible();
    await expect(engineCard(engines.page, ENGINE_LLAMA)).toBeHidden();
  });

  test("clicking a card opens the detail page", {
    tag: "@C2613050",
  }, async ({ engines }) => {
    await gotoEngineList(engines.page);
    await engineCard(engines.page, ENGINE_LLAMA).click();

    const showPage = engines.page.locator('[data-testid="show-page"]');
    await expect(showPage).toBeVisible();
    await expect(
      showPage.getByRole("heading", { name: ENGINE_LLAMA }),
    ).toBeVisible();
  });

  test("steady engines hide the status badge", {
    tag: "@C2613052",
  }, async ({ engines }) => {
    await gotoEngineList(engines.page);

    // Built-in engines are Created, the steady phase, which the card hides.
    const card = engineCard(engines.page, ENGINE_LLAMA);
    await expect(card.getByText("Created")).toBeHidden();
    await expect(card.getByText("Failed")).toBeHidden();
  });

  test("card summarizes versions and lists them on hover", {
    tag: "@C2613053",
  }, async ({ engines }) => {
    await gotoEngineList(engines.page);

    const card = engineCard(engines.page, ENGINE_VLLM);
    // The card headlines the newest version, not the one the API returned first.
    await expect(card.getByText("v0.24.0")).toBeVisible();

    const versionTrigger = card.getByRole("button", { name: /versions/i });
    await expect(versionTrigger).toBeVisible();
    await versionTrigger.hover();

    const hoverCard = engines.page.locator(
      '[data-testid="engine-versions-hover-card"]',
    );
    await expect(hoverCard.getByText("All versions")).toBeVisible();
    await expect(hoverCard.getByText("v0.17.1")).toBeVisible();
    await expect(hoverCard.getByText("v0.24.0")).toBeVisible();
  });

  test("single-version engine has no version entry point", async ({
    engines,
  }) => {
    await gotoEngineList(engines.page);

    const card = engineCard(engines.page, ENGINE_LLAMA);
    await expect(card.getByText("v0.3.7")).toBeVisible();
    await expect(card.getByRole("button", { name: /versions/i })).toBeHidden();
  });

  test("no per-card actions", {
    tag: "@C2613233",
  }, async ({ engines }) => {
    await gotoEngineList(engines.page);

    // canEdit/canDelete are both false for engines: the only interactive
    // element inside a card is the version summary.
    const card = engineCard(engines.page, ENGINE_VLLM);
    await expect(
      card.getByRole("button", { name: /edit|delete|actions|options/i }),
    ).toBeHidden();
  });
});

test.describe("engines detail", () => {
  test("detail page shows engine info and supported tasks", {
    tag: "@C2613208",
  }, async ({ engines }) => {
    await engines.goToShow(ENGINE_LLAMA);

    const showPage = engines.page.locator('[data-testid="show-page"]');

    await expect(
      showPage.getByRole("heading", { name: ENGINE_LLAMA }),
    ).toBeVisible();

    // Created is the steady phase, so the header shows no status badge.
    await expect(showPage.getByText("Created")).toBeHidden();

    await expect(
      showPage.getByRole("heading", { name: /supported tasks/i }),
    ).toBeVisible();
    await expect(
      showPage.getByRole("heading", { name: /^versions$/i }),
    ).toBeVisible();
    await expect(
      showPage.getByText("text-generation", { exact: true }).first(),
    ).toBeVisible();
  });

  test("detail page shows values schema for engine version", {
    tag: "@C2613210",
  }, async ({ engines }) => {
    await engines.goToShow(ENGINE_VLLM);

    const showPage = engines.page.locator('[data-testid="show-page"]');

    // The newest version is selected by default and the schema is rendered.
    const versionList = showPage.getByRole("navigation", {
      name: /all versions/i,
    });
    await expect(versionList).toBeVisible();
    await expect(
      versionList.getByRole("link", { name: /v0\.24\.0/ }),
    ).toHaveAttribute("aria-current", "true");
    await expect(
      showPage.locator("dt", { hasText: /values schema/i }),
    ).toBeVisible();
  });

  test("can switch version in detail page", {
    tag: "@C2613211",
  }, async ({ engines }) => {
    // vLLM has multiple maintained versions (v0.17.1, v0.24.0).
    await engines.goToShow(ENGINE_VLLM);

    const showPage = engines.page.locator('[data-testid="show-page"]');
    const versionList = showPage.getByRole("navigation", {
      name: /all versions/i,
    });
    const older = versionList.getByRole("link", { name: /v0\.17\.1/ });
    await older.click();

    await expect(older).toHaveAttribute("aria-current", "true");
    await expect(engines.page).toHaveURL(/version=v0\.17\.1/);
    await expect(
      showPage.locator("dt", { hasText: /values schema/i }),
    ).toBeVisible();
  });

  test("no actions menu on detail page", {
    tag: ["@C2613214", "@C2613215"],
  }, async ({ engines }) => {
    await engines.goToShow(ENGINE_LLAMA);

    // canEdit=false, canDelete=false → no actions trigger
    await expect(
      engines.page.locator('[data-testid="show-actions-trigger"]'),
    ).toBeHidden();
  });
});

// ────────────────────────────────────────────────────────────
// Multi-user permission tests
// ────────────────────────────────────────────────────────────
test.describe("engines multi-user permissions", () => {
  test(
    "user with engine:read can see engines list",
    {
      tag: "@C2613205",
      annotation: {
        type: "slow",
        description: "creates test user with engine:read permission",
      },
    },
    async ({ createTestUser }, testInfo) => {
      testInfo.setTimeout(MULTI_USER_TIMEOUT);

      const testUser = await createTestUser(["engine:read"]);
      await gotoEngineList(testUser.page);

      expect(await testUser.page.locator(ENGINE_CARD).count()).toBeGreaterThan(
        0,
      );
    },
  );

  test(
    "user without engine:read sees an empty engines list",
    {
      tag: "@C2613207",
      annotation: {
        type: "slow",
        description: "creates test user without engine:read permission",
      },
    },
    async ({ createTestUser }, testInfo) => {
      testInfo.setTimeout(MULTI_USER_TIMEOUT);

      // Give an unrelated permission so the user can log in
      const testUser = await createTestUser(["role:read"]);
      await testUser.page.goto("/#/default/engines");

      await expect(
        testUser.page.getByText(/no engines in this workspace/i),
      ).toBeVisible();
      expect(await testUser.page.locator(ENGINE_CARD).count()).toBe(0);
    },
  );
});

// ────────────────────────────────────────────────────────────
// Create permissions (YAML import)
// ────────────────────────────────────────────────────────────
test.describe("engines create permissions", () => {
  test("admin can create engine via YAML import", {
    tag: ["@C2613228", "@C2613229"],
  }, async ({ engines, yamlImport, apiHelper }) => {
    const name = `test-eng-adm-new-${Date.now()}`;

    await gotoEngineList(engines.page);
    await yamlImport.importYaml(engineYaml(name));
    await yamlImport.expectResults({ success: 1 });
    await yamlImport.close();

    await expect(engineCard(engines.page, name)).toBeVisible();

    // Cleanup
    await apiHelper.deleteEngine(name).catch(() => {});
  });

  test(
    "non-admin with global engine:create can create via YAML import",
    {
      tag: "@C2613230",
      annotation: {
        type: "slow",
        description: "creates test user with engine:create+read permissions",
      },
    },
    async ({ createTestUser, apiHelper }, testInfo) => {
      testInfo.setTimeout(MULTI_USER_TIMEOUT);

      const testUser = await createTestUser(["engine:create", "engine:read"]);

      const name = `test-eng-glb-new-${Date.now()}`;
      const yamlHelper = new YamlImportHelper(testUser.page);

      await gotoEngineList(testUser.page);
      await yamlHelper.importYaml(engineYaml(name));
      await yamlHelper.expectResults({ success: 1 });
      await yamlHelper.close();

      await expect(engineCard(testUser.page, name)).toBeVisible();

      // Cleanup (admin deletes)
      await apiHelper.deleteEngine(name).catch(() => {});
    },
  );

  test.skip("workspace-scoped engine:create can create (enterprise)", {
    tag: "@C2613231",
  }, async () => {
    // Enterprise-only feature — skipped
  });

  test(
    "non-admin without engine:create cannot create via YAML import",
    {
      tag: "@C2613232",
      annotation: {
        type: "slow",
        description: "creates test user with engine:read only",
      },
    },
    async ({ createTestUser }, testInfo) => {
      testInfo.setTimeout(MULTI_USER_TIMEOUT);

      const testUser = await createTestUser(["engine:read"]);

      const name = `test-eng-no-new-${Date.now()}`;
      const yamlHelper = new YamlImportHelper(testUser.page);

      await gotoEngineList(testUser.page);
      await yamlHelper.importYaml(engineYaml(name));
      await yamlHelper.expectResults({ errors: 1 });
      await yamlHelper.close();

      // Engine should NOT appear in the list
      await expect(engineCard(testUser.page, name)).toHaveCount(0);
    },
  );
});

// ────────────────────────────────────────────────────────────
// Update permissions (YAML import skips existing resources)
// ────────────────────────────────────────────────────────────
test.describe("engines update permissions", () => {
  test("admin importing existing engine shows skipped", {
    tag: "@C2613221",
  }, async ({ engines, yamlImport, apiHelper }) => {
    const name = `test-eng-adm-upd-${Date.now()}`;
    await apiHelper.createEngine(name, { version: "v1.0" });

    await gotoEngineList(engines.page);
    await yamlImport.importYaml(engineYaml(name, { version: "v2.0" }));
    await yamlImport.expectResults({ skipped: 1 });
    await yamlImport.close();

    // Cleanup
    await apiHelper.deleteEngine(name).catch(() => {});
  });

  test(
    "non-admin with engine:read importing existing engine shows skipped",
    {
      tag: "@C2613223",
      annotation: {
        type: "slow",
        description: "creates test user with engine:read+update permissions",
      },
    },
    async ({ createTestUser, apiHelper }, testInfo) => {
      testInfo.setTimeout(MULTI_USER_TIMEOUT);

      const name = `test-eng-glb-upd-${Date.now()}`;
      await apiHelper.createEngine(name, { version: "v1.0" });

      const testUser = await createTestUser(["engine:read", "engine:update"]);
      const yamlHelper = new YamlImportHelper(testUser.page);

      await gotoEngineList(testUser.page);
      await yamlHelper.importYaml(engineYaml(name, { version: "v2.0" }));
      await yamlHelper.expectResults({ skipped: 1 });
      await yamlHelper.close();

      // Cleanup (admin deletes)
      await apiHelper.deleteEngine(name).catch(() => {});
    },
  );

  test(
    "non-admin without engine:read importing existing engine shows error",
    {
      tag: "@C2613225",
      annotation: {
        type: "slow",
        description:
          "creates test user with engine:create only (no read), getOne fails so import tries POST which conflicts",
      },
    },
    async ({ createTestUser, apiHelper }, testInfo) => {
      testInfo.setTimeout(MULTI_USER_TIMEOUT);

      const name = `test-eng-no-upd-${Date.now()}`;
      await apiHelper.createEngine(name, { version: "v1.0" });

      // Without engine:read, checkResourceExists fails → import tries POST → 409 conflict
      const testUser = await createTestUser(["engine:create"]);
      const yamlHelper = new YamlImportHelper(testUser.page);

      await testUser.page.goto("/#/default/engines");
      await yamlHelper.importYaml(engineYaml(name, { version: "v2.0" }));
      await yamlHelper.expectResults({ errors: 1 });
      await yamlHelper.close();

      // Cleanup
      await apiHelper.deleteEngine(name).catch(() => {});
    },
  );
});
