import { config } from "../config";
import { expect, test } from "../fixtures/base";
import { ApiHelper } from "../helpers/api-helper";

const irName = { value: "" };

test.describe("clusters - create", () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const api = new ApiHelper(page);

    irName.value = `test-cl-ir-${Date.now()}`;
    await api.createImageRegistry(irName.value);

    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const api = new ApiHelper(page);

    await api
      .deleteImageRegistry(irName.value, { force: true })
      .catch(() => {});
    await context.close();
  });

  // ────────────────────────────────────────────────────────────
  // Create tests
  // ────────────────────────────────────────────────────────────
  test.describe("create", () => {
    test(
      "create form shows basic fields",
      { tag: "@C2612678" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        await expect(clusters.form.field("metadata.name")).toBeVisible();
        await expect(clusters.form.field("metadata.workspace")).toBeVisible();
        await expect(clusters.form.field("spec.image_registry")).toBeVisible();
        await expect(clusters.form.field("spec.type")).toBeVisible();
      },
    );

    test(
      "type selector shows Static Nodes and Kubernetes",
      { tag: "@C2612679" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        const typeField = clusters.form.field("spec.type");
        await typeField.locator('button[role="combobox"]').click();

        await expect(
          clusters.page.getByRole("option", { name: /static nodes/i }),
        ).toBeVisible();
        await expect(
          clusters.page.getByRole("option", { name: /kubernetes/i }),
        ).toBeVisible();
      },
    );

    test(
      "SSH: provider fields visible",
      { tag: "@C2612793" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        // Default type is SSH, so provider fields should be visible
        await expect(clusters.page.getByText("Head Node IP")).toBeVisible();
        await expect(clusters.page.getByText("Worker Node IPs")).toBeVisible();
      },
    );

    test(
      "SSH: head IP required validation",
      { tag: "@C2612794" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        // Head Node IP input uses placeholder "e.g 192.168.1.1"
        const headIpInput = clusters.page.getByPlaceholder("e.g 192.168.1.1");

        // Fill then clear and blur to trigger validation
        await headIpInput.fill("1.1.1.1");
        await headIpInput.clear();
        await headIpInput.blur();

        // Check validation error
        await expect(
          clusters.page.getByText("IP address is required"),
        ).toBeVisible();
      },
    );

    test(
      "SSH: worker IP input placeholder",
      { tag: "@C2612795" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        await expect(
          clusters.page.getByPlaceholder("Add New Worker Node IP"),
        ).toBeVisible();
      },
    );

    test(
      "SSH: add single worker IP",
      { tag: "@C2612796" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        const workerInput = clusters.page.getByPlaceholder(
          "Add New Worker Node IP",
        );
        await workerInput.fill("10.0.0.1");
        await clusters.page
          .getByRole("button", { name: "Add", exact: true })
          .click();

        // Verify IP shown in list
        await expect(clusters.page.getByText("10.0.0.1")).toBeVisible();
      },
    );

    test(
      "SSH: add multiple worker IPs",
      { tag: "@C2612797" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        const workerInput = clusters.page.getByPlaceholder(
          "Add New Worker Node IP",
        );

        // Add first IP
        await workerInput.fill("10.0.0.1");
        await clusters.page
          .getByRole("button", { name: "Add", exact: true })
          .click();

        // Add second IP
        await workerInput.fill("10.0.0.2");
        await clusters.page
          .getByRole("button", { name: "Add", exact: true })
          .click();

        // Verify both IPs shown
        await expect(clusters.page.getByText("10.0.0.1")).toBeVisible();
        await expect(clusters.page.getByText("10.0.0.2")).toBeVisible();
      },
    );

    test(
      "SSH: add then remove worker IP",
      { tag: "@C2612798" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        const workerInput = clusters.page.getByPlaceholder(
          "Add New Worker Node IP",
        );
        await workerInput.fill("10.0.0.1");
        await clusters.page
          .getByRole("button", { name: "Add", exact: true })
          .click();

        // Verify IP is shown and badge updated (ensures React re-render is done)
        await expect(clusters.page.getByText("10.0.0.1")).toBeVisible();
        await expect(clusters.page.getByText("1 nodes")).toBeVisible();

        // Click the trash button via evaluate to avoid React re-render detachment
        await clusters.page.evaluate(() => {
          const btn = document.querySelector(
            '[data-testid="remove-worker-ip"]',
          );
          if (btn) (btn as HTMLButtonElement).click();
        });

        // Verify IP removed — empty state message should reappear
        await expect(
          clusters.page.getByText("No worker nodes added"),
        ).toBeVisible();
      },
    );

    test(
      "SSH: worker IPs count badge",
      { tag: "@C2612799" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        // Initially 0 nodes
        await expect(clusters.page.getByText("0 nodes")).toBeVisible();

        const workerInput = clusters.page.getByPlaceholder(
          "Add New Worker Node IP",
        );

        // Add first IP and wait for it to appear in list
        await workerInput.fill("10.0.0.1");
        await clusters.page
          .getByRole("button", { name: "Add", exact: true })
          .click();
        await expect(clusters.page.getByText("10.0.0.1")).toBeVisible();
        await expect(clusters.page.getByText("1 nodes")).toBeVisible();

        // Wait for the bidirectional useEffect state sync (local ↔ form) to settle
        // before adding the next IP — without this the sync can overwrite local state
        await expect(workerInput).toHaveValue("");
        // eslint-disable-next-line playwright/no-wait-for-timeout
        await clusters.page.waitForTimeout(300);

        // Add second IP and wait for it to appear in list
        await workerInput.fill("10.0.0.2");
        await clusters.page
          .getByRole("button", { name: "Add", exact: true })
          .click();
        await expect(clusters.page.getByText("10.0.0.2")).toBeVisible();
        await expect(clusters.page.getByText("2 nodes")).toBeVisible();

        // Remove first IP — retry evaluate click until badge updates
        await expect(async () => {
          await clusters.page.evaluate(() => {
            const btn = document.querySelector(
              '[data-testid="remove-worker-ip"]',
            );
            if (btn) (btn as HTMLButtonElement).click();
          });
          await expect(clusters.page.getByText("1 nodes")).toBeVisible({
            timeout: 2000,
          });
        }).toPass({ timeout: 10000 });
      },
    );

    test(
      "SSH: auth fields visible",
      { tag: "@C2612801" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        await expect(
          clusters.form.field("spec.config.ssh_config.auth.ssh_user"),
        ).toBeVisible();
        await expect(
          clusters.form.field("spec.config.ssh_config.auth.ssh_private_key"),
        ).toBeVisible();
      },
    );

    test(
      "SSH: model cache section visible",
      { tag: "@C2612804" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        // Model Caches section title and Add button
        await expect(
          clusters.page.getByRole("button", { name: /add model cache/i }),
        ).toBeVisible();
      },
    );

    test(
      "SSH: model cache only has Host Path option",
      { tag: "@C2612805" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        // Add a cache item
        await clusters.page
          .getByRole("button", { name: /add model cache/i })
          .click();

        // The cache type select shows "Host Path" by default — click to open it
        // Navigate from "Cache Type" text to its sibling combobox
        const cacheTypeCombobox = clusters.page
          .locator('[data-testid="cache-type-select"]')
          .locator('button[role="combobox"]');
        await cacheTypeCombobox.click();

        // Only Host Path should be available
        await expect(
          clusters.page.getByRole("option", { name: /host path/i }),
        ).toBeVisible();

        // Should have exactly 1 option
        const options = clusters.page.getByRole("option");
        await expect(options).toHaveCount(1);
      },
    );

    test(
      "K8s: kubeconfig field visible",
      { tag: "@C2612765" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        // Switch to Kubernetes type
        await clusters.form.selectOption("spec.type", "Kubernetes");

        await expect(
          clusters.form.field("spec.config.kubernetes_config.kubeconfig"),
        ).toBeVisible();
      },
    );

    test(
      "K8s: router fields visible",
      { tag: "@C2623069" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        // Switch to Kubernetes type
        await clusters.form.selectOption("spec.type", "Kubernetes");

        await expect(
          clusters.form.field(
            "spec.config.kubernetes_config.router.access_mode",
          ),
        ).toBeVisible();
        await expect(
          clusters.form.field("spec.config.kubernetes_config.router.replicas"),
        ).toBeVisible();
        await expect(
          clusters.form.field(
            "spec.config.kubernetes_config.router.resources.cpu",
          ),
        ).toBeVisible();
        await expect(
          clusters.form.field(
            "spec.config.kubernetes_config.router.resources.memory",
          ),
        ).toBeVisible();
      },
    );

    test(
      "K8s: default router replicas = 2",
      { tag: "@C2623070" },
      async ({ clusters }) => {
        await clusters.goToCreate();
        await clusters.form.selectOption("spec.type", "Kubernetes");

        const replicasInput = clusters.form
          .field("spec.config.kubernetes_config.router.replicas")
          .locator("input");
        await expect(replicasInput).toHaveValue("2");
      },
    );

    test(
      "K8s: default router CPU = 1",
      { tag: "@C2623071" },
      async ({ clusters }) => {
        await clusters.goToCreate();
        await clusters.form.selectOption("spec.type", "Kubernetes");

        const cpuInput = clusters.form
          .field("spec.config.kubernetes_config.router.resources.cpu")
          .locator("input");
        await expect(cpuInput).toHaveValue("1");
      },
    );

    test(
      "K8s: default router memory = 1Gi",
      { tag: "@C2623072" },
      async ({ clusters }) => {
        await clusters.goToCreate();
        await clusters.form.selectOption("spec.type", "Kubernetes");

        const memoryInput = clusters.form
          .field("spec.config.kubernetes_config.router.resources.memory")
          .locator("input");
        await expect(memoryInput).toHaveValue("1Gi");
      },
    );

    test(
      "K8s: access mode default LoadBalancer, can change to NodePort",
      { tag: "@C2623073" },
      async ({ clusters }) => {
        await clusters.goToCreate();
        await clusters.form.selectOption("spec.type", "Kubernetes");

        const accessModeButton = clusters.form
          .field("spec.config.kubernetes_config.router.access_mode")
          .locator('button[role="combobox"]');

        // Default should show "LoadBalancer"
        await expect(accessModeButton).toHaveText(/LoadBalancer/);

        // Change to NodePort
        await accessModeButton.click();
        await clusters.page.getByRole("option", { name: "NodePort" }).click();

        await expect(accessModeButton).toHaveText(/NodePort/);
      },
    );

    test(
      "K8s: no default model cache, add via button",
      { tag: "@C2612777" },
      async ({ clusters }) => {
        await clusters.goToCreate();
        await clusters.form.selectOption("spec.type", "Kubernetes");

        // No cache items initially — empty state message shown
        await expect(clusters.page.getByText("No model caches")).toBeVisible();

        // Click "Add Model Cache" → cache form appears
        await clusters.page
          .getByRole("button", { name: /add model cache/i })
          .click();

        // Cache card should appear (title starts with #1)
        await expect(clusters.page.getByText("#1 -")).toBeVisible();

        // Empty state message should be gone
        await expect(clusters.page.getByText("No model caches")).toBeHidden();
      },
    );

    test(
      "K8s: model cache has Host Path, NFS, PVC options",
      { tag: "@C2612778" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        // Switch to Kubernetes type
        await clusters.form.selectOption("spec.type", "Kubernetes");

        // Add a cache item
        await clusters.page
          .getByRole("button", { name: /add model cache/i })
          .click();

        // The cache type select shows "Host Path" by default — click to open it
        const cacheTypeCombobox = clusters.page
          .locator('[data-testid="cache-type-select"]')
          .locator('button[role="combobox"]');
        await cacheTypeCombobox.click();

        await expect(
          clusters.page.getByRole("option", { name: /host path/i }),
        ).toBeVisible();
        await expect(
          clusters.page.getByRole("option", { name: /nfs/i }),
        ).toBeVisible();
        await expect(
          clusters.page.getByRole("option", { name: /pvc/i }),
        ).toBeVisible();
      },
    );

    test(
      "only 1 model cache allowed in UI",
      { tag: "@C2623045" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        // Add a cache item
        await clusters.page
          .getByRole("button", { name: /add model cache/i })
          .click();

        // Cache card appears
        await expect(clusters.page.getByText("#1 -")).toBeVisible();

        // "Add Model Cache" button should be hidden since limit is 1
        await expect(
          clusters.page.getByRole("button", { name: /add model cache/i }),
        ).toBeHidden();
      },
    );

    test(
      "SSH: host path empty path blocks submit",
      { tag: "@C2612812" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        // Add a model cache (default type is Host Path)
        await clusters.page
          .getByRole("button", { name: /add model cache/i })
          .click();

        // Leave cache path empty and try to submit
        await clusters.form.submit();

        // Client-side validation prevents submission — form stays visible
        await expect(
          clusters.page.locator('[data-testid="form"]'),
        ).toBeVisible();

        // Validation error should appear for cache path
        await expect(
          clusters.page.getByText(/cache path is required/i),
        ).toBeVisible();
      },
    );

    test(
      "K8s: NFS empty server/path blocks submit",
      { tag: "@C2612813" },
      async ({ clusters }) => {
        await clusters.goToCreate();
        await clusters.form.selectOption("spec.type", "Kubernetes");

        // Add a cache item
        await clusters.page
          .getByRole("button", { name: /add model cache/i })
          .click();

        // Switch cache type to NFS
        const cacheTypeCombobox = clusters.page
          .locator('[data-testid="cache-type-select"]')
          .locator('button[role="combobox"]');
        await cacheTypeCombobox.click();
        await clusters.page.getByRole("option", { name: /^NFS$/i }).click();

        // Leave NFS fields empty and try to submit
        await clusters.form.submit();

        // Form stays visible — validation prevents submission
        await expect(
          clusters.page.locator('[data-testid="form"]'),
        ).toBeVisible();

        // Validation errors should appear
        await expect(
          clusters.page.getByText(/server address is required/i),
        ).toBeVisible();
        await expect(
          clusters.page.getByText(/cache path is required/i),
        ).toBeVisible();
      },
    );

    test(
      "K8s: PVC empty storage class still submittable",
      { tag: "@C2623046" },
      async ({ clusters }) => {
        await clusters.goToCreate();
        await clusters.form.selectOption("spec.type", "Kubernetes");

        // Add a cache item
        await clusters.page
          .getByRole("button", { name: /add model cache/i })
          .click();

        // Switch cache type to PVC
        const cacheTypeCombobox = clusters.page
          .locator('[data-testid="cache-type-select"]')
          .locator('button[role="combobox"]');
        await cacheTypeCombobox.click();
        await clusters.page.getByRole("option", { name: /^PVC$/i }).click();

        // Storage field has a default value (500Gi), storageClassName is optional
        // Verify storageClassName has no required indicator — no error when empty
        await clusters.form.submit();

        // No "storageClassName is required" error should appear
        await expect(
          clusters.page.getByText(/storage class.*required/i),
        ).toBeHidden();
      },
    );

    test(
      "K8s: PVC default AccessMode = ReadWriteMany",
      { tag: "@C2623078" },
      async ({ clusters, apiHelper }) => {
        await clusters.goToCreate();

        const name = `test-cl-pvc-am-${Date.now()}`;
        await clusters.form.fillInput("metadata.name", name);
        await clusters.form.selectComboboxOption(
          "spec.image_registry",
          irName.value,
        );
        await clusters.form.selectOption("spec.type", "Kubernetes");
        await clusters.form.fillTextarea(
          "spec.config.kubernetes_config.kubeconfig",
          "apiVersion: v1\nkind: Config\nclusters: []\ncontexts: []\nusers: []",
        );

        // Add a model cache and switch to PVC type
        await clusters.page
          .getByRole("button", { name: /add model cache/i })
          .click();

        const cacheNameInput = clusters.form
          .field("spec.config.model_caches.0.name")
          .locator("input");
        await cacheNameInput.fill("test-pvc-cache");

        const cacheTypeCombobox = clusters.page
          .locator('[data-testid="cache-type-select"]')
          .locator('button[role="combobox"]');
        await cacheTypeCombobox.click();
        await clusters.page.getByRole("option", { name: /^PVC$/i }).click();

        // Intercept the POST request to verify accessModes in payload
        const requestPromise = clusters.page.waitForRequest(
          (r) => r.url().includes("/clusters") && r.method() === "POST",
        );
        await clusters.form.submit();
        const request = await requestPromise;
        const body = JSON.parse(request.postData() || "{}");

        // Verify PVC accessModes defaults to ReadWriteMany
        const modelCaches = body.spec?.config?.model_caches;
        expect(modelCaches).toBeDefined();
        expect(modelCaches[0]?.pvc?.accessModes).toEqual(["ReadWriteMany"]);

        // Cleanup in case the cluster was actually created
        await apiHelper.deleteCluster(name, { force: true }).catch(() => {});
      },
    );

    test.skip(
      "cancel does not create resource",
      { tag: "@miss" },
      async ({ clusters }) => {
        const name = `test-cl-cancel-${Date.now()}`;

        await clusters.goToCreate();

        await clusters.form.fillInput("metadata.name", name);

        // Accept browser dialog if warnWhenUnsavedChanges fires
        clusters.page.on("dialog", (dialog) => dialog.accept());
        await clusters.form.cancel();

        // Navigate to list and verify no row was created
        await clusters.goToList();
        await clusters.table.expectNoRowWithText(name);
      },
    );

    // ── Group 1: Create Form Validation ──

    test(
      "create: empty name → submit fails",
      { tag: "@C2612670" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        // Select image registry so that's not the failure reason
        await clusters.form.selectComboboxOption(
          "spec.image_registry",
          irName.value,
        );

        // Fill head IP to pass provider validation
        await clusters.page
          .getByPlaceholder("e.g 192.168.1.1")
          .fill("192.168.1.1");

        // Leave name empty → submit and wait for any API response
        const responsePromise = clusters.page.waitForResponse((r) =>
          r.url().includes("/clusters"),
        );
        await clusters.form.submit();
        const response = await responsePromise;

        // Server should reject empty name
        expect(response.ok()).toBe(false);

        // Form stays visible
        await expect(
          clusters.page.locator('[data-testid="form"]'),
        ).toBeVisible();
      },
    );

    test(
      "create: no image registry → submit fails",
      { tag: "@C2612674" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        // Fill name but don't select image registry
        await clusters.form.fillInput(
          "metadata.name",
          `test-cl-noimr-${Date.now()}`,
        );

        // Fill head IP to pass provider validation
        await clusters.page
          .getByPlaceholder("e.g 192.168.1.1")
          .fill("192.168.1.1");

        // Submit and wait for any API response
        const responsePromise = clusters.page.waitForResponse((r) =>
          r.url().includes("/clusters"),
        );
        await clusters.form.submit();
        const response = await responsePromise;

        // Server should reject missing image registry
        expect(response.ok()).toBe(false);

        // Form stays visible
        await expect(
          clusters.page.locator('[data-testid="form"]'),
        ).toBeVisible();
      },
    );

    test(
      "create: image registry search and select",
      { tag: "@C2612676" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        // Open the image registry combobox
        const irField = clusters.form.field("spec.image_registry");
        await irField.locator("button").click();

        // Type partial name to search
        const dialog = clusters.page.locator(
          '[data-state="open"][role="dialog"]',
        );
        const searchInput = dialog.getByRole("combobox");
        await searchInput.fill(irName.value.slice(0, 10));

        // Verify the option appears in filtered results and select it
        await expect(
          dialog.getByRole("option", { name: irName.value, exact: true }),
        ).toBeVisible();
        await dialog
          .getByRole("option", { name: irName.value, exact: true })
          .click();

        // Verify the trigger now shows the selected value
        await expect(irField.locator("button")).toHaveText(
          new RegExp(irName.value),
        );
      },
    );

    test(
      "create: image registry filtered by workspace",
      { tag: "@C2612680" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        // Default workspace is "default" — open image registry combobox
        const irField = clusters.form.field("spec.image_registry");
        await irField.locator("button").click();

        // The test image registry (created in default workspace) should appear
        const dialog = clusters.page.locator(
          '[data-state="open"][role="dialog"]',
        );
        await expect(
          dialog.getByRole("option", { name: irName.value, exact: true }),
        ).toBeVisible();

        // Close the combobox
        await clusters.page.keyboard.press("Escape");
      },
    );

    test(
      "SSH: no head IP → submit shows error",
      { tag: "@C2612792" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        // Fill name and select image registry
        await clusters.form.fillInput(
          "metadata.name",
          `test-cl-noip-${Date.now()}`,
        );
        await clusters.form.selectComboboxOption(
          "spec.image_registry",
          irName.value,
        );

        // Don't fill head IP — click submit
        await clusters.form.submit();

        // Client-side validation shows "IP address is required"
        await expect(
          clusters.page.getByText("IP address is required"),
        ).toBeVisible();

        // Form stays visible (submission blocked)
        await expect(
          clusters.page.locator('[data-testid="form"]'),
        ).toBeVisible();
      },
    );

    // ── Group 2: K8s Router Parameter Validation ──

    test(
      "K8s: router config always has defaults when type selected",
      { tag: "@C2612766" },
      async ({ clusters }) => {
        await clusters.goToCreate();
        await clusters.form.selectOption("spec.type", "Kubernetes");

        // Router fields should exist with default values
        await expect(
          clusters.form.field(
            "spec.config.kubernetes_config.router.access_mode",
          ),
        ).toBeVisible();
        await expect(
          clusters.form.field("spec.config.kubernetes_config.router.replicas"),
        ).toBeVisible();
        await expect(
          clusters.form.field(
            "spec.config.kubernetes_config.router.resources.cpu",
          ),
        ).toBeVisible();
        await expect(
          clusters.form.field(
            "spec.config.kubernetes_config.router.resources.memory",
          ),
        ).toBeVisible();

        // Verify defaults
        const replicasInput = clusters.form
          .field("spec.config.kubernetes_config.router.replicas")
          .locator("input");
        await expect(replicasInput).toHaveValue("2");

        const cpuInput = clusters.form
          .field("spec.config.kubernetes_config.router.resources.cpu")
          .locator("input");
        await expect(cpuInput).toHaveValue("1");

        const memoryInput = clusters.form
          .field("spec.config.kubernetes_config.router.resources.memory")
          .locator("input");
        await expect(memoryInput).toHaveValue("1Gi");
      },
    );

    test(
      "K8s: access mode default always set",
      { tag: "@C2612767" },
      async ({ clusters }) => {
        await clusters.goToCreate();
        await clusters.form.selectOption("spec.type", "Kubernetes");

        // Access mode Select always has a default value
        const accessModeButton = clusters.form
          .field("spec.config.kubernetes_config.router.access_mode")
          .locator('button[role="combobox"]');
        await expect(accessModeButton).toHaveText(/LoadBalancer/);

        // Open and verify options
        await accessModeButton.click();
        await expect(
          clusters.page.getByRole("option", { name: "LoadBalancer" }),
        ).toBeVisible();
        await expect(
          clusters.page.getByRole("option", { name: "NodePort" }),
        ).toBeVisible();
        await clusters.page.keyboard.press("Escape");
      },
    );

    test(
      "K8s: empty replicas → submit fails",
      { tag: "@C2612768" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        // Fill required fields
        await clusters.form.fillInput(
          "metadata.name",
          `test-k8s-rep-${Date.now()}`,
        );
        await clusters.form.selectComboboxOption(
          "spec.image_registry",
          irName.value,
        );
        await clusters.form.selectOption("spec.type", "Kubernetes");
        await clusters.form.fillTextarea(
          "spec.config.kubernetes_config.kubeconfig",
          "apiVersion: v1\nkind: Config\nclusters: []\ncontexts: []\nusers: []",
        );

        // Clear replicas
        const replicasInput = clusters.form
          .field("spec.config.kubernetes_config.router.replicas")
          .locator("input");
        await replicasInput.clear();

        // Submit and expect error
        const responsePromise = clusters.page.waitForResponse(
          (r) => r.url().includes("/clusters") && !r.ok(),
        );
        await clusters.form.submit();
        await responsePromise;

        await expect(
          clusters.page.locator('[data-testid="form"]'),
        ).toBeVisible();
      },
    );

    test(
      "K8s: replicas < 1 → submit fails",
      { tag: "@C2612769" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        await clusters.form.fillInput(
          "metadata.name",
          `test-k8s-repl0-${Date.now()}`,
        );
        await clusters.form.selectComboboxOption(
          "spec.image_registry",
          irName.value,
        );
        await clusters.form.selectOption("spec.type", "Kubernetes");
        await clusters.form.fillTextarea(
          "spec.config.kubernetes_config.kubeconfig",
          "apiVersion: v1\nkind: Config\nclusters: []\ncontexts: []\nusers: []",
        );

        // Set replicas to 0
        const replicasInput = clusters.form
          .field("spec.config.kubernetes_config.router.replicas")
          .locator("input");
        await replicasInput.clear();
        await replicasInput.fill("0");

        const responsePromise = clusters.page.waitForResponse(
          (r) => r.url().includes("/clusters") && !r.ok(),
        );
        await clusters.form.submit();
        await responsePromise;

        await expect(
          clusters.page.locator('[data-testid="form"]'),
        ).toBeVisible();
      },
    );

    test(
      "K8s: replicas non-numeric → number field rejects",
      { tag: "@C2612770" },
      async ({ clusters }) => {
        await clusters.goToCreate();
        await clusters.form.selectOption("spec.type", "Kubernetes");

        // type="number" input ignores non-numeric input — fill "abc" results in empty value
        const replicasInput = clusters.form
          .field("spec.config.kubernetes_config.router.replicas")
          .locator("input");

        // Clear and try to type text — value should be empty or unchanged
        await replicasInput.clear();
        await replicasInput.pressSequentially("abc");

        // Number input doesn't accept non-numeric characters
        await expect(replicasInput).toHaveValue("");
      },
    );

    test(
      "K8s: empty CPU and memory → submit fails",
      { tag: "@C2612771" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        await clusters.form.fillInput(
          "metadata.name",
          `test-k8s-res-${Date.now()}`,
        );
        await clusters.form.selectComboboxOption(
          "spec.image_registry",
          irName.value,
        );
        await clusters.form.selectOption("spec.type", "Kubernetes");
        await clusters.form.fillTextarea(
          "spec.config.kubernetes_config.kubeconfig",
          "apiVersion: v1\nkind: Config\nclusters: []\ncontexts: []\nusers: []",
        );

        // Clear both CPU and Memory
        const cpuInput = clusters.form
          .field("spec.config.kubernetes_config.router.resources.cpu")
          .locator("input");
        await cpuInput.clear();

        const memoryInput = clusters.form
          .field("spec.config.kubernetes_config.router.resources.memory")
          .locator("input");
        await memoryInput.clear();

        const responsePromise = clusters.page.waitForResponse(
          (r) => r.url().includes("/clusters") && !r.ok(),
        );
        await clusters.form.submit();
        await responsePromise;

        await expect(
          clusters.page.locator('[data-testid="form"]'),
        ).toBeVisible();
      },
    );

    test(
      "K8s: empty CPU → submit fails",
      { tag: "@C2612772" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        await clusters.form.fillInput(
          "metadata.name",
          `test-k8s-cpu-${Date.now()}`,
        );
        await clusters.form.selectComboboxOption(
          "spec.image_registry",
          irName.value,
        );
        await clusters.form.selectOption("spec.type", "Kubernetes");
        await clusters.form.fillTextarea(
          "spec.config.kubernetes_config.kubeconfig",
          "apiVersion: v1\nkind: Config\nclusters: []\ncontexts: []\nusers: []",
        );

        // Clear CPU only
        const cpuInput = clusters.form
          .field("spec.config.kubernetes_config.router.resources.cpu")
          .locator("input");
        await cpuInput.clear();

        const responsePromise = clusters.page.waitForResponse(
          (r) => r.url().includes("/clusters") && !r.ok(),
        );
        await clusters.form.submit();
        await responsePromise;

        await expect(
          clusters.page.locator('[data-testid="form"]'),
        ).toBeVisible();
      },
    );

    test(
      "K8s: empty memory → submit fails",
      { tag: "@C2612773" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        await clusters.form.fillInput(
          "metadata.name",
          `test-k8s-mem-${Date.now()}`,
        );
        await clusters.form.selectComboboxOption(
          "spec.image_registry",
          irName.value,
        );
        await clusters.form.selectOption("spec.type", "Kubernetes");
        await clusters.form.fillTextarea(
          "spec.config.kubernetes_config.kubeconfig",
          "apiVersion: v1\nkind: Config\nclusters: []\ncontexts: []\nusers: []",
        );

        // Clear Memory only
        const memoryInput = clusters.form
          .field("spec.config.kubernetes_config.router.resources.memory")
          .locator("input");
        await memoryInput.clear();

        const responsePromise = clusters.page.waitForResponse(
          (r) => r.url().includes("/clusters") && !r.ok(),
        );
        await clusters.form.submit();
        await responsePromise;

        await expect(
          clusters.page.locator('[data-testid="form"]'),
        ).toBeVisible();
      },
    );

    test(
      "K8s: invalid memory format → submit fails",
      { tag: "@C2612774" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        await clusters.form.fillInput(
          "metadata.name",
          `test-k8s-memfmt-${Date.now()}`,
        );
        await clusters.form.selectComboboxOption(
          "spec.image_registry",
          irName.value,
        );
        await clusters.form.selectOption("spec.type", "Kubernetes");
        await clusters.form.fillTextarea(
          "spec.config.kubernetes_config.kubeconfig",
          "apiVersion: v1\nkind: Config\nclusters: []\ncontexts: []\nusers: []",
        );

        // Set invalid memory format
        const memoryInput = clusters.form
          .field("spec.config.kubernetes_config.router.resources.memory")
          .locator("input");
        await memoryInput.clear();
        await memoryInput.fill("abc");

        const responsePromise = clusters.page.waitForResponse(
          (r) => r.url().includes("/clusters") && !r.ok(),
        );
        await clusters.form.submit();
        await responsePromise;

        await expect(
          clusters.page.locator('[data-testid="form"]'),
        ).toBeVisible();
      },
    );

    test(
      "K8s: invalid CPU format → submit fails",
      { tag: "@C2612775" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        await clusters.form.fillInput(
          "metadata.name",
          `test-k8s-cpufmt-${Date.now()}`,
        );
        await clusters.form.selectComboboxOption(
          "spec.image_registry",
          irName.value,
        );
        await clusters.form.selectOption("spec.type", "Kubernetes");
        await clusters.form.fillTextarea(
          "spec.config.kubernetes_config.kubeconfig",
          "apiVersion: v1\nkind: Config\nclusters: []\ncontexts: []\nusers: []",
        );

        // Set invalid CPU format
        const cpuInput = clusters.form
          .field("spec.config.kubernetes_config.router.resources.cpu")
          .locator("input");
        await cpuInput.clear();
        await cpuInput.fill("abc");

        const responsePromise = clusters.page.waitForResponse(
          (r) => r.url().includes("/clusters") && !r.ok(),
        );
        await clusters.form.submit();
        await responsePromise;

        await expect(
          clusters.page.locator('[data-testid="form"]'),
        ).toBeVisible();
      },
    );

    // ── Group 3: Cache Name Validation ──

    test(
      "cache: empty name → submit fails",
      { tag: "@C2612809" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        await clusters.form.fillInput(
          "metadata.name",
          `test-cl-cn-${Date.now()}`,
        );
        await clusters.form.selectComboboxOption(
          "spec.image_registry",
          irName.value,
        );

        // Fill head IP to pass provider validation
        await clusters.page
          .getByPlaceholder("e.g 192.168.1.1")
          .fill("192.168.1.1");

        // Add a model cache — leave name empty
        await clusters.page
          .getByRole("button", { name: /add model cache/i })
          .click();

        // Fill cache path to pass path validation
        const cachePathInput = clusters.form
          .field("spec.config.model_caches.0.host_path.path")
          .locator("input");
        await cachePathInput.fill("/data/cache");

        // Submit — server should reject empty cache name
        const responsePromise = clusters.page.waitForResponse(
          (r) => r.url().includes("/clusters") && !r.ok(),
        );
        await clusters.form.submit();
        await responsePromise;

        await expect(
          clusters.page.locator('[data-testid="form"]'),
        ).toBeVisible();
      },
    );

    test(
      "cache: invalid RFC 1123 name → submit fails",
      { tag: "@C2612810" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        await clusters.form.fillInput(
          "metadata.name",
          `test-cl-cn2-${Date.now()}`,
        );
        await clusters.form.selectComboboxOption(
          "spec.image_registry",
          irName.value,
        );

        await clusters.page
          .getByPlaceholder("e.g 192.168.1.1")
          .fill("192.168.1.1");

        // Add a model cache with invalid name (uppercase, special chars)
        await clusters.page
          .getByRole("button", { name: /add model cache/i })
          .click();

        const cacheNameInput = clusters.form
          .field("spec.config.model_caches.0.name")
          .locator("input");
        await cacheNameInput.fill("Invalid_Name!");

        const cachePathInput = clusters.form
          .field("spec.config.model_caches.0.host_path.path")
          .locator("input");
        await cachePathInput.fill("/data/cache");

        const responsePromise = clusters.page.waitForResponse(
          (r) => r.url().includes("/clusters") && !r.ok(),
        );
        await clusters.form.submit();
        await responsePromise;

        await expect(
          clusters.page.locator('[data-testid="form"]'),
        ).toBeVisible();
      },
    );

    // ── Group 4: Workspace & Image Registry Dropdown ──

    test(
      "workspace defaults to empty when global filter is All workspaces",
      { tag: "@C2612671" },
      async ({ clusters }) => {
        // Navigate with _all_ workspace filter (simulates "All workspaces")
        await clusters.page.goto("/#/_all_/clusters/create");
        await clusters.page
          .locator('[data-testid="form"]')
          .waitFor({ state: "visible" });

        const wsButton = clusters.form
          .field("metadata.workspace")
          .locator('button[role="combobox"]');

        // When _all_ is set, Combobox can't find matching option → no "default"
        await expect(wsButton).not.toHaveText(/default/);
      },
    );

    test(
      "workspace auto-fills from global workspace filter",
      { tag: "@C2612683" },
      async ({ clusters }) => {
        // goToCreate() navigates to /default/clusters/create
        await clusters.goToCreate();

        const wsButton = clusters.form
          .field("metadata.workspace")
          .locator('button[role="combobox"]');

        await expect(wsButton).toHaveText(/default/);
      },
    );

    test(
      "workspace search with no results preserves default value",
      { tag: "@C2612673" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        // Open workspace combobox
        const wsField = clusters.form.field("metadata.workspace");
        await wsField.locator("button").click();

        // Type a non-existent workspace name in the search input
        const dialog = clusters.page.locator(
          '[data-state="open"][role="dialog"]',
        );
        const searchInput = dialog.getByRole("combobox");
        await searchInput.fill("nonexistent-ws-xyz");

        // No options should appear
        await expect(dialog.getByRole("option")).toHaveCount(0);

        // Close dropdown
        await clusters.page.keyboard.press("Escape");

        // Verify workspace button still shows "default"
        const wsButton = wsField.locator('button[role="combobox"]');
        await expect(wsButton).toHaveText(/default/);
      },
    );

    test(
      "image registry dropdown is empty for workspace with no registries",
      { tag: "@C2612675" },
      async ({ clusters }) => {
        // Navigate to a non-existent workspace → no image registries
        await clusters.page.goto("/#/no-ir-ws/clusters/create");
        await clusters.page
          .locator('[data-testid="form"]')
          .waitFor({ state: "visible" });

        // Open image registry combobox
        const irField = clusters.form.field("spec.image_registry");
        await irField.locator("button").click();

        // Wait for popover dialog
        const dialog = clusters.page.locator(
          '[data-state="open"][role="dialog"]',
        );
        await dialog.waitFor({ state: "visible" });

        // No options should appear
        await expect(dialog.getByRole("option")).toHaveCount(0);
      },
    );

    test(
      "cache: reserved name 'default' → submit fails",
      { tag: "@C2612811" },
      async ({ clusters }) => {
        await clusters.goToCreate();

        await clusters.form.fillInput(
          "metadata.name",
          `test-cl-cn3-${Date.now()}`,
        );
        await clusters.form.selectComboboxOption(
          "spec.image_registry",
          irName.value,
        );

        await clusters.page
          .getByPlaceholder("e.g 192.168.1.1")
          .fill("192.168.1.1");

        // Add a model cache with reserved name "default"
        await clusters.page
          .getByRole("button", { name: /add model cache/i })
          .click();

        const cacheNameInput = clusters.form
          .field("spec.config.model_caches.0.name")
          .locator("input");
        await cacheNameInput.fill("default");

        const cachePathInput = clusters.form
          .field("spec.config.model_caches.0.host_path.path")
          .locator("input");
        await cachePathInput.fill("/data/cache");

        const responsePromise = clusters.page.waitForResponse(
          (r) => r.url().includes("/clusters") && !r.ok(),
        );
        await clusters.form.submit();
        await responsePromise;

        await expect(
          clusters.page.locator('[data-testid="form"]'),
        ).toBeVisible();
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // K8s lifecycle tests (require real K8s cluster)
  // ────────────────────────────────────────────────────────────
  test.describe("K8s lifecycle", () => {
    /** 5 min — K8s cluster init (pull images, start router, etc.) takes time */
    const K8S_INIT_TIMEOUT = 300_000;

    test.skip(
      !config.features.hasRealK8sCluster,
      "Requires real K8s cluster (set E2E_PROFILE with k8s kubeconfig)",
    );

    test(
      "K8s: fill config correctly, save and return to list",
      { tag: ["@C2612776", "@real-k8s"] },
      async ({ clusters, apiHelper }) => {
        const name = `test-cl-k8s-new-${Date.now()}`;
        await clusters.goToCreate();

        // Fill name and image registry
        await clusters.form.fillInput("metadata.name", name);
        await clusters.form.selectComboboxOption(
          "spec.image_registry",
          irName.value,
        );

        // Switch to Kubernetes type
        await clusters.form.selectOption("spec.type", "Kubernetes");

        // Fill kubeconfig from profile
        await clusters.form.fillTextarea(
          "spec.config.kubernetes_config.kubeconfig",
          config.k8sCluster.kubeconfig,
        );

        // Set access mode from profile
        const accessModeButton = clusters.form
          .field("spec.config.kubernetes_config.router.access_mode")
          .locator('button[role="combobox"]');
        await accessModeButton.click();
        await clusters.page
          .getByRole("option", { name: config.k8sCluster.routerAccessMode })
          .click();

        // Submit
        await clusters.form.submit();

        // Should redirect to list and show the new cluster
        await clusters.table.waitForLoaded();
        await clusters.table.expectRowWithText(name);

        // Cleanup
        await apiHelper.deleteCluster(name, { force: true }).catch(() => {});
      },
    );

    test(
      "K8s: after create success, status becomes Running",
      { tag: ["@C2613101", "@real-k8s"] },
      async ({ clusters, apiHelper }, testInfo) => {
        testInfo.setTimeout(K8S_INIT_TIMEOUT);
        const name = `test-cl-k8s-run-${Date.now()}`;

        // Create via API for speed
        await apiHelper.createCluster(name, {
          type: "kubernetes",
          imageRegistry: irName.value,
          kubeconfig: config.k8sCluster.kubeconfig,
        });

        // Verify status becomes Running on list page
        await clusters.goToList();
        const row = clusters.table.rowWithText(name);
        await expect(row.getByText("Running")).toBeVisible({
          timeout: K8S_INIT_TIMEOUT,
        });

        // Cleanup
        await apiHelper.deleteCluster(name, { force: true }).catch(() => {});
      },
    );
  });
});
