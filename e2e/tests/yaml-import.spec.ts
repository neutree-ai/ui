import { expect, test } from "../fixtures/base";
import { ApiHelper } from "../helpers/api-helper";

/** Build a Role YAML document */
function roleYaml(name: string, permissions: string[] = ["role:read"]): string {
  const perms = permissions.map((p) => `    - ${p}`).join("\n");
  return `apiVersion: v1
kind: Role
metadata:
  name: ${name}
spec:
  permissions:
${perms}`;
}

/** Build a ModelCatalog YAML document */
function modelCatalogYaml(name: string): string {
  return `apiVersion: v1
kind: ModelCatalog
metadata:
  name: ${name}
  workspace: default
spec:
  model:
    registry: huggingface
    name: test-model
    version: "1.0"
    task: text-generation
    file: model.safetensors
  engine:
    engine: vllm
    version: v0.8.5
  resources:
    cpu: 1
    memory: 1
    gpu: 0
  replicas:
    num: 1
  deployment_options:
    scheduler:
      type: roundrobin
  variables: {}`;
}

// Track resources created during tests for cleanup
const createdResources: { roles: string[]; modelCatalogs: string[] } = {
  roles: [],
  modelCatalogs: [],
};

test.describe("yaml import", () => {
  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const api = new ApiHelper(page);

    for (const name of createdResources.roles) {
      await api.deleteRole(name).catch(() => {});
    }
    for (const name of createdResources.modelCatalogs) {
      await api.deleteModelCatalog(name).catch(() => {});
    }
    await context.close();
  });

  test(
    "can paste YAML content and import",
    {
      tag: "@C2611882",
    },
    async ({ yamlImport, page }) => {
      const roleName = `test-imp-paste-${Date.now()}`;
      createdResources.roles.push(roleName);

      await page.goto("/#/dashboard");
      await yamlImport.importYaml(roleYaml(roleName));
      await yamlImport.expectResults({ success: 1, errors: 0 });
      await yamlImport.close();
    },
  );

  test(
    "import result displays success/skip/error badges",
    {
      tag: "@C2611883",
    },
    async ({ yamlImport, page }) => {
      const roleName = `test-imp-badges-${Date.now()}`;
      createdResources.roles.push(roleName);

      await page.goto("/#/dashboard");
      await yamlImport.importYaml(roleYaml(roleName));

      // Should show success badge
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText(/1 success/i)).toBeVisible();

      // Check result row shows green success indicator
      await expect(dialog.getByText(/successfully created/i)).toBeVisible();

      await yamlImport.close();
    },
  );

  test(
    "can import from local file",
    {
      tag: "@C2611880",
    },
    async ({ yamlImport, page }) => {
      const roleName = `test-imp-file-${Date.now()}`;
      createdResources.roles.push(roleName);

      await page.goto("/#/dashboard");
      await yamlImport.importFromFile(roleYaml(roleName));
      await yamlImport.expectResults({ success: 1, errors: 0 });
      await yamlImport.close();
    },
  );

  test(
    "can import multiple resource types in one YAML",
    {
      tag: "@C2611879",
    },
    async ({ yamlImport, page }) => {
      const ts = Date.now();
      const roleName = `test-imp-multi-role-${ts}`;
      const mcName = `test-imp-multi-mc-${ts}`;
      createdResources.roles.push(roleName);
      createdResources.modelCatalogs.push(mcName);

      const multiYaml = `${roleYaml(roleName)}
---
${modelCatalogYaml(mcName)}`;

      await page.goto("/#/dashboard");
      await yamlImport.importYaml(multiYaml);
      await yamlImport.expectResults({ success: 2, errors: 0 });
      await yamlImport.close();
    },
  );

  test(
    "duplicate import skips existing resources",
    {
      tag: "@C2611885",
    },
    async ({ yamlImport, page }) => {
      const roleName = `test-imp-dup-${Date.now()}`;
      createdResources.roles.push(roleName);

      await page.goto("/#/dashboard");

      // First import — success
      await yamlImport.importYaml(roleYaml(roleName));
      await yamlImport.expectResults({ success: 1 });

      // Import more — second time (dialog already open)
      await yamlImport.importMore();
      await yamlImport.submitYaml(roleYaml(roleName));
      await yamlImport.expectResults({ skipped: 1 });

      await yamlImport.close();
    },
  );

  test(
    "import more resets dialog for next import",
    {
      tag: "@C2611884",
    },
    async ({ yamlImport, page }) => {
      const ts = Date.now();
      const role1 = `test-imp-more1-${ts}`;
      const role2 = `test-imp-more2-${ts}`;
      createdResources.roles.push(role1, role2);

      await page.goto("/#/dashboard");

      // First import
      await yamlImport.importYaml(roleYaml(role1));
      await yamlImport.expectResults({ success: 1 });

      // Click Import More — should reset to input form
      await yamlImport.importMore();

      // Verify input is cleared and ready for new import
      const dialog = page.getByRole("dialog");
      const textarea = dialog.locator("#yaml-text");
      await expect(textarea).toBeVisible();
      const value = await textarea.inputValue();
      expect(value).toBe("");

      // Second import (dialog already open after importMore)
      await yamlImport.submitYaml(roleYaml(role2));
      await yamlImport.expectResults({ success: 1 });

      await yamlImport.close();
    },
  );

  test(
    "can import from URL",
    {
      tag: "@C2611881",
    },
    async ({ yamlImport, page }) => {
      const roleName = `test-imp-url-${Date.now()}`;
      createdResources.roles.push(roleName);

      const yaml = roleYaml(roleName);

      // Mock the URL fetch — the browser fetches URLs directly in use-yaml-import.ts
      await page.route("https://example.com/test.yaml", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/x-yaml",
          body: yaml,
        }),
      );

      await page.goto("/#/dashboard");
      await yamlImport.importFromUrl("https://example.com/test.yaml");
      await yamlImport.expectResults({ success: 1, errors: 0 });
      await yamlImport.close();
    },
  );

  test(
    "import invalid data shows error",
    {
      tag: "@C2611886",
    },
    async ({ yamlImport, page }) => {
      await page.goto("/#/dashboard");

      // Use a valid YAML structure that passes client-side validation
      // but fails on the server (invalid permissions format)
      const invalidYaml = `apiVersion: v1
kind: Role
metadata:
  name: test-imp-invalid-${Date.now()}
spec:
  permissions:
    - this-is-not:a-valid-permission`;

      await yamlImport.importYaml(invalidYaml);

      const dialog = page.getByRole("dialog");
      // Should show error badge (API rejects invalid permission enum)
      await expect(dialog.getByText(/1 error/i)).toBeVisible();

      await yamlImport.close();
    },
  );

  test(
    "import with missing dependency succeeds",
    {
      tag: "@C2611887",
    },
    async ({ yamlImport, page }) => {
      // Per the test case: "当前会成功" — import should succeed even with missing deps
      const mcName = `test-imp-dep-${Date.now()}`;
      createdResources.modelCatalogs.push(mcName);

      // Import a model catalog that references a non-existent engine version
      const yaml = `apiVersion: v1
kind: ModelCatalog
metadata:
  name: ${mcName}
  workspace: default
spec:
  model:
    registry: huggingface
    name: test-model
    version: "1.0"
    task: text-generation
    file: model.safetensors
  engine:
    engine: non-existent-engine
    version: v99.99
  resources:
    cpu: 1
    memory: 1
    gpu: 0
  replicas:
    num: 1
  deployment_options:
    scheduler:
      type: roundrobin
  variables: {}`;

      await page.goto("/#/dashboard");
      await yamlImport.importYaml(yaml);
      await yamlImport.expectResults({ success: 1 });
      await yamlImport.close();
    },
  );
});
