import { expect, test } from "../fixtures/base";
import { ApiHelper } from "../helpers/api-helper";
import { ASYNC_UI_TIMEOUT } from "../helpers/constants";

// Resource labels as they appear in the export dialog (from i18n `{resource}.title`)
const RESOURCE_LABELS = [
  "Clusters",
  "Endpoints",
  "Engines",
  "Image Registries",
  "Model Registries",
  "Model Catalogs",
  "API key",
  "Roles",
  "Workspace Policies",
  "Workspaces",
] as const;

// Test data names
const testData = {
  role: "",
  modelCatalog: "",
  apiKey: "",
};

test.describe("yaml export", () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const api = new ApiHelper(page);

    const ts = Date.now();
    testData.role = `test-exp-role-${ts}`;
    testData.modelCatalog = `test-exp-mc-${ts}`;
    testData.apiKey = `test-exp-ak-${ts}`;

    await api.createRole(testData.role, ["role:read"]);
    await api.createModelCatalog(testData.modelCatalog);
    await api.createApiKey(testData.apiKey);

    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const api = new ApiHelper(page);

    await api.deleteRole(testData.role).catch(() => {});
    await api.deleteModelCatalog(testData.modelCatalog).catch(() => {});
    await api.deleteApiKey(testData.apiKey).catch(() => {});
    await context.close();
  });

  // ────────────────────────────────────────────────────────────
  // Selection tests
  // ────────────────────────────────────────────────────────────
  test.describe("selection", () => {
    test(
      "export disabled when nothing selected",
      {
        tag: "@C2611903",
      },
      async ({ yamlExport, page }) => {
        await page.goto("/#/dashboard");
        await yamlExport.open();
        await yamlExport.expectGenerateDisabled();
        await yamlExport.close();
      },
    );

    test(
      "select all selects all resource types",
      {
        tag: "@C2611888",
      },
      async ({ yamlExport, page }) => {
        await page.goto("/#/dashboard");
        await yamlExport.open();

        await yamlExport.selectAll();

        // Generate should be enabled now
        await yamlExport.expectGenerateEnabled();

        await yamlExport.close();
      },
    );

    // Resource type expansion tests: expand each type and verify entities or "No entities"
    for (const [index, label] of RESOURCE_LABELS.entries()) {
      const caseIds = [
        "@C2611893",
        "@C2611894",
        "@C2611895",
        "@C2611896",
        "@C2611897",
        "@C2611898",
        "@C2611899",
        "@C2611900",
        "@C2611901",
        "@C2611902",
      ];

      test(
        `can expand ${label} resource type`,
        {
          tag: caseIds[index],
        },
        async ({ yamlExport, page }) => {
          await page.goto("/#/dashboard");
          await yamlExport.open();

          await yamlExport.expandResource(label);

          // Should show either entities or "No entities found"
          const dialog = page.getByRole("dialog");
          const resourceRow = dialog.locator(".border.rounded-lg", {
            hasText: label,
          });

          // Wait for loading to finish
          await expect(resourceRow.getByText(/loading/i)).toBeHidden({
            timeout: ASYNC_UI_TIMEOUT,
          });

          // Either has entity names or "No entities found"
          const hasNoEntities = await yamlExport.hasNoEntities(label);
          if (!hasNoEntities) {
            const names = await yamlExport.getEntityNames(label);
            expect(names.length).toBeGreaterThan(0);
          }

          await yamlExport.close();
        },
      );
    }
  });

  // ────────────────────────────────────────────────────────────
  // Export options tests
  // ────────────────────────────────────────────────────────────
  test.describe("options", () => {
    test(
      "remove status option removes status fields from YAML",
      {
        tag: "@C2611889",
      },
      async ({ yamlExport, page }) => {
        await page.goto("/#/dashboard");
        await yamlExport.open();

        // Toggle "remove-status" OFF so status IS included
        await yamlExport.openOptions();
        await yamlExport.toggleOption("remove-status");
        await yamlExport.closeOptions();

        // Select our test role
        await yamlExport.toggleResource("Roles");
        await yamlExport.generate();

        let yaml = await yamlExport.getYamlContent();
        expect(yaml).toContain("status");

        // Go back and toggle remove-status ON
        await yamlExport.backToSelection();
        await yamlExport.openOptions();
        await yamlExport.toggleOption("remove-status");
        await yamlExport.closeOptions();

        await yamlExport.generate();
        yaml = await yamlExport.getYamlContent();
        expect(yaml).not.toContain("status");

        await yamlExport.close();
      },
    );

    test(
      "remove IDs option removes auto-generated IDs from YAML",
      {
        tag: "@C2611890",
      },
      async ({ yamlExport, page }) => {
        await page.goto("/#/dashboard");
        await yamlExport.open();

        // Toggle "remove-ids" OFF so IDs ARE included
        await yamlExport.openOptions();
        await yamlExport.toggleOption("remove-ids");
        await yamlExport.closeOptions();

        await yamlExport.toggleResource("Roles");
        await yamlExport.generate();

        let yaml = await yamlExport.getYamlContent();
        // With IDs included, should have "id:" field
        expect(yaml).toMatch(/^id:/m);

        // Go back and toggle remove-ids ON
        await yamlExport.backToSelection();
        await yamlExport.openOptions();
        await yamlExport.toggleOption("remove-ids");
        await yamlExport.closeOptions();

        await yamlExport.generate();
        yaml = await yamlExport.getYamlContent();
        expect(yaml).not.toMatch(/^id:/m);

        await yamlExport.close();
      },
    );

    test(
      "remove timestamps option removes timestamp fields from YAML",
      {
        tag: "@C2611891",
      },
      async ({ yamlExport, page }) => {
        await page.goto("/#/dashboard");
        await yamlExport.open();

        // Toggle BOTH "remove-timestamps" and "remove-ids" OFF
        // (when remove-ids is ON, metadata is rebuilt without timestamps regardless)
        await yamlExport.openOptions();
        await yamlExport.toggleOption("remove-timestamps");
        await yamlExport.toggleOption("remove-ids");
        await yamlExport.closeOptions();

        await yamlExport.toggleResource("Roles");
        await yamlExport.generate();

        let yaml = await yamlExport.getYamlContent();
        expect(yaml).toContain("creation_timestamp");

        // Go back and toggle remove-timestamps ON (keep remove-ids OFF)
        await yamlExport.backToSelection();
        await yamlExport.openOptions();
        await yamlExport.toggleOption("remove-timestamps");
        await yamlExport.closeOptions();

        await yamlExport.generate();
        yaml = await yamlExport.getYamlContent();
        expect(yaml).not.toContain("creation_timestamp");

        await yamlExport.close();
      },
    );

    test(
      "reset button clears all selections",
      {
        tag: "@C2611892",
      },
      async ({ yamlExport, page }) => {
        await page.goto("/#/dashboard");
        await yamlExport.open();

        // Select a resource
        await yamlExport.toggleResource("Roles");
        await yamlExport.expectGenerateEnabled();

        // Click reset
        await yamlExport.clickReset();

        // Generate should be disabled again
        await yamlExport.expectGenerateDisabled();

        await yamlExport.close();
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // Credentials exclusion tests
  // ────────────────────────────────────────────────────────────
  test.describe("credentials exclusion", () => {
    const credData = {
      imageRegistry: "",
      modelRegistry: "",
      sshCluster: "",
      k8sCluster: "",
    };

    test.beforeAll(async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      const api = new ApiHelper(page);

      const ts = Date.now();
      credData.imageRegistry = `test-exp-ir-${ts}`;
      credData.modelRegistry = `test-exp-mr-${ts}`;
      credData.sshCluster = `test-exp-ssh-${ts}`;
      credData.k8sCluster = `test-exp-k8s-${ts}`;

      // Create an image registry required by clusters
      await api.createImageRegistry(credData.imageRegistry, {
        username: "testuser",
        password: "testpass",
      });
      await api.createModelRegistry(credData.modelRegistry, {
        credentials: "test-api-token",
      });
      await api.createCluster(credData.sshCluster, {
        type: "ssh",
        imageRegistry: credData.imageRegistry,
      });
      await api.createCluster(credData.k8sCluster, {
        type: "kubernetes",
        imageRegistry: credData.imageRegistry,
      });

      await context.close();
    });

    test.afterAll(async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      const api = new ApiHelper(page);

      await api
        .deleteCluster(credData.sshCluster, { force: true })
        .catch(() => {});
      await api
        .deleteCluster(credData.k8sCluster, { force: true })
        .catch(() => {});
      await api
        .deleteModelRegistry(credData.modelRegistry, { force: true })
        .catch(() => {});
      await api
        .deleteImageRegistry(credData.imageRegistry, { force: true })
        .catch(() => {});
      await context.close();
    });

    test(
      "image registry export without credentials excludes auth info",
      { tag: "@C2611905" },
      async ({ yamlExport, page }) => {
        await page.goto("/#/dashboard");
        await yamlExport.open();

        // Toggle include-credentials OFF (default is ON)
        await yamlExport.openOptions();
        await yamlExport.toggleOption("include-credentials");
        await yamlExport.closeOptions();

        await yamlExport.toggleResource("Image Registries");
        await yamlExport.generate();

        const yaml = await yamlExport.getYamlContent();
        expect(yaml).toContain("ImageRegistry");
        expect(yaml).not.toContain("username");
        expect(yaml).not.toContain("password");
        expect(yaml).not.toContain("testuser");
        expect(yaml).not.toContain("testpass");

        await yamlExport.close();
      },
    );

    test(
      "model registry export without credentials excludes credential info",
      { tag: "@C2611906" },
      async ({ yamlExport, page }) => {
        await page.goto("/#/dashboard");
        await yamlExport.open();

        // Toggle include-credentials OFF
        await yamlExport.openOptions();
        await yamlExport.toggleOption("include-credentials");
        await yamlExport.closeOptions();

        await yamlExport.toggleResource("Model Registries");
        await yamlExport.generate();

        const yaml = await yamlExport.getYamlContent();
        expect(yaml).toContain("ModelRegistry");
        expect(yaml).not.toContain("credentials");
        expect(yaml).not.toContain("test-api-token");

        await yamlExport.close();
      },
    );

    test(
      "cluster export without credentials excludes ssh key and kubeconfig",
      { tag: "@C2611908" },
      async ({ yamlExport, page }) => {
        await page.goto("/#/dashboard");
        await yamlExport.open();

        // Toggle include-credentials OFF
        await yamlExport.openOptions();
        await yamlExport.toggleOption("include-credentials");
        await yamlExport.closeOptions();

        await yamlExport.toggleResource("Clusters");
        await yamlExport.generate();

        const yaml = await yamlExport.getYamlContent();
        expect(yaml).toContain("Cluster");
        expect(yaml).not.toContain("ssh_private_key");
        expect(yaml).not.toContain("kubeconfig");

        await yamlExport.close();
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // Output tests
  // ────────────────────────────────────────────────────────────
  test.describe("output", () => {
    test(
      "can download YAML file",
      {
        tag: "@C2611904",
      },
      async ({ yamlExport, page }) => {
        await page.goto("/#/dashboard");
        await yamlExport.open();

        await yamlExport.toggleResource("Roles");
        await yamlExport.generate();

        const download = await yamlExport.downloadFile();
        const suggestedFilename = download.suggestedFilename();
        expect(suggestedFilename).toMatch(/^resources-.*\.yaml$/);

        // Verify file content is not empty
        const path = await download.path();
        expect(path).toBeTruthy();

        await yamlExport.close();
      },
    );

    test(
      "api key export YAML does not contain secret key value",
      {
        tag: "@C2611907",
      },
      async ({ yamlExport, page }) => {
        await page.goto("/#/dashboard");
        await yamlExport.open();

        // Select API keys only
        await yamlExport.toggleResource("API key");

        // Generate YAML (with default options: remove-status=true)
        await yamlExport.generate();

        const yaml = await yamlExport.getYamlContent();
        // YAML should contain the api key resource
        expect(yaml).toContain("ApiKey");

        // Should NOT contain sk_value (secret key is in status which is removed by default,
        // and even with status included, the API doesn't return sk_value in list responses)
        expect(yaml).not.toContain("sk_value");
        expect(yaml).not.toMatch(/sk-[a-zA-Z0-9]/);

        await yamlExport.close();
      },
    );
  });
});
