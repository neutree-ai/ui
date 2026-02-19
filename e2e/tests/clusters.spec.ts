import { expect, test } from "../fixtures/base";
import { ApiHelper } from "../helpers/api-helper";

// ── Shared test data created once in beforeAll ──
const irName = { value: "" }; // Image registry dependency
const clNames = {
  ssh: "", // SSH type for list/detail/edit
  k8s: "", // K8s type for list/detail/edit
  sort: "", // Second SSH cluster for sort ordering
  sshWithCache: "", // SSH cluster with model cache for detail tests
};

test.describe("clusters", () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const api = new ApiHelper(page);

    const ts = Date.now();
    irName.value = `test-cl-ir-${ts}`;
    clNames.ssh = `test-cl-ssh-${ts}`;
    clNames.k8s = `test-cl-k8s-${ts}`;
    clNames.sort = `test-cl-sort-${ts}`;

    // Create image registry dependency first
    await api.createImageRegistry(irName.value);

    await api.createCluster(clNames.ssh, {
      type: "ssh",
      imageRegistry: irName.value,
    });
    await api.createCluster(clNames.k8s, {
      type: "kubernetes",
      imageRegistry: irName.value,
    });
    await api.createCluster(clNames.sort, {
      type: "ssh",
      imageRegistry: irName.value,
    });

    // Create SSH cluster with model cache for detail tests (raw API call)
    clNames.sshWithCache = `test-cl-cache-${ts}`;
    const rawKey = "fake-ssh-key-for-cache-test";
    const base64Key = btoa(`${rawKey}\n`);
    await page.evaluate(
      async ({ name, workspace, imageRegistry, base64Key }) => {
        let token = "";
        for (const key of Object.keys(localStorage)) {
          try {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const val = JSON.parse(raw);
            if (val?.access_token) {
              token = val.access_token;
              break;
            }
          } catch {}
        }
        const res = await fetch("/api/v1/clusters", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            api_version: "v1",
            kind: "Cluster",
            metadata: { name, workspace },
            spec: {
              type: "ssh",
              image_registry: imageRegistry,
              config: {
                ssh_config: {
                  provider: {
                    head_ip: "10.0.0.100",
                    worker_ips: ["10.0.0.101", "10.0.0.102"],
                  },
                  auth: { ssh_user: "root", ssh_private_key: base64Key },
                },
                model_caches: [
                  {
                    name: "test-cache",
                    host_path: { path: "/data/models" },
                  },
                ],
              },
            },
          }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Create cluster with cache failed: ${text}`);
        }
      },
      {
        name: clNames.sshWithCache,
        workspace: "default",
        imageRegistry: irName.value,
        base64Key,
      },
    );

    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    test.setTimeout(60_000);
    const context = await browser.newContext();
    const page = await context.newPage();
    const api = new ApiHelper(page);

    // Delete clusters in parallel, then image registry (dependency order)
    await Promise.all(
      Object.values(clNames)
        .filter((n) => n)
        .map((name) =>
          api.deleteCluster(name, { force: true }).catch(() => {}),
        ),
    );
    await api
      .deleteImageRegistry(irName.value, { force: true })
      .catch(() => {});
    await context.close();
  });

  // ────────────────────────────────────────────────────────────
  // List tests
  // ────────────────────────────────────────────────────────────
  test.describe("list", () => {
    test(
      "list page shows expected columns",
      { tag: "@C2613064" },
      async ({ clusters }) => {
        await clusters.goToList();

        const headers = clusters.table.root.locator("thead th");
        await expect(headers.filter({ hasText: /name/i })).toBeVisible();
        await expect(headers.filter({ hasText: /workspace/i })).toBeVisible();
        await expect(headers.filter({ hasText: /status/i })).toBeVisible();
        await expect(headers.filter({ hasText: /type/i })).toBeVisible();
        await expect(
          headers.filter({ hasText: /image registry/i }),
        ).toBeVisible();
        await expect(headers.filter({ hasText: /updated/i })).toBeVisible();
        await expect(headers.filter({ hasText: /created/i })).toBeVisible();

        await clusters.table.expectRowWithText(clNames.ssh);
      },
    );

    // TODO: shares @C2613068 with "detail > show page displays basic info" — create separate TestRail case
    test(
      "clicking name navigates to detail page",
      { tag: "@C2613068" },
      async ({ clusters }) => {
        await clusters.goToList();
        await clusters.table.clickRowLink(clNames.ssh);

        const showPage = clusters.page.locator('[data-testid="show-page"]');
        await expect(showPage).toBeVisible();
        await expect(
          showPage.getByText(clNames.ssh, { exact: true }),
        ).toBeVisible();
      },
    );

    test("can sort by name", { tag: "@C2612655" }, async ({ clusters }) => {
      await clusters.goToList();
      await clusters.table.sort(/name/i);
    });

    test.skip(
      "can sort by updated at",
      { tag: "@miss" },
      async ({ clusters }) => {
        await clusters.goToList();
        await expect(clusters.table.headerCell(/updated/i)).toBeVisible();
        await clusters.table.sort(/updated/i);
      },
    );

    test.skip(
      "can sort by created at",
      { tag: "@miss" },
      async ({ clusters }) => {
        await clusters.goToList();
        await expect(clusters.table.headerCell(/created/i)).toBeVisible();
        await clusters.table.sort(/created/i);
      },
    );

    test(
      "can toggle column visibility",
      { tag: "@C2612653" },
      async ({ clusters }) => {
        await clusters.goToList();

        await expect(clusters.table.headerCell(/status/i)).toBeVisible();
        await clusters.table.toggleColumn(/status/i);
        await expect(clusters.table.headerCell(/status/i)).toBeHidden();
        await clusters.table.toggleColumn(/status/i);
        await expect(clusters.table.headerCell(/status/i)).toBeVisible();
      },
    );

    test(
      "type column shows correct labels",
      { tag: "@C2612647" },
      async ({ clusters }) => {
        await clusters.goToList();

        const sshRow = clusters.table.rowWithText(clNames.ssh);
        await expect(sshRow.getByText("Static Nodes")).toBeVisible();

        const k8sRow = clusters.table.rowWithText(clNames.k8s);
        await expect(k8sRow.getByText("Kubernetes")).toBeVisible();
      },
    );

    test(
      "clicking image registry navigates to detail page",
      { tag: "@C2612648" },
      async ({ clusters }) => {
        await clusters.goToList();

        const row = clusters.table.rowWithText(clNames.ssh);
        await row.getByRole("link", { name: irName.value }).click();

        const showPage = clusters.page.locator('[data-testid="show-page"]');
        await expect(showPage).toBeVisible();
        await expect(
          showPage.getByText(irName.value, { exact: true }),
        ).toBeVisible();
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // Detail tests
  // ────────────────────────────────────────────────────────────
  test.describe("detail", () => {
    test(
      "show page displays basic info",
      { tag: "@C2613068" },
      async ({ clusters }) => {
        await clusters.goToShow(clNames.ssh);

        const showPage = clusters.page.locator('[data-testid="show-page"]');
        await expect(showPage).toBeVisible();

        // Name
        await expect(
          showPage.getByText(clNames.ssh, { exact: true }),
        ).toBeVisible();

        // Workspace
        await expect(
          showPage.locator("dt", { hasText: /workspace/i }),
        ).toBeVisible();

        // Status
        await expect(
          showPage.locator("dt", { hasText: /^status$/i }),
        ).toBeVisible();

        // Timestamps
        await expect(
          showPage.getByRole("term").filter({ hasText: /created at/i }),
        ).toBeVisible();
        await expect(
          showPage.getByRole("term").filter({ hasText: /updated at/i }),
        ).toBeVisible();

        // Type
        await expect(
          showPage.locator("dt", { hasText: /^type$/i }),
        ).toBeVisible();
      },
    );

    test(
      "clicking workspace navigates to workspace detail",
      { tag: "@C2612645" },
      async ({ clusters }) => {
        await clusters.goToShow(clNames.ssh);

        const showPage = clusters.page.locator('[data-testid="show-page"]');
        await showPage.getByRole("link", { name: "default" }).click();

        const wsShowPage = clusters.page.locator('[data-testid="show-page"]');
        await expect(wsShowPage).toBeVisible();
        await expect(
          wsShowPage.getByText("default", { exact: true }),
        ).toBeVisible();
      },
    );

    test(
      "SSH show page displays head IP and worker IPs",
      { tag: "@C2613071" },
      async ({ clusters }) => {
        await clusters.goToShow(clNames.sshWithCache);

        const showPage = clusters.page.locator('[data-testid="show-page"]');
        await expect(showPage).toBeVisible();

        // SSH-specific fields
        await expect(
          showPage.locator("dt", { hasText: /head ip/i }),
        ).toBeVisible();
        await expect(
          showPage.locator("dt", { hasText: /worker ips/i }),
        ).toBeVisible();

        // Verify head IP value
        await expect(showPage.getByText("10.0.0.100")).toBeVisible();
        // Verify worker IPs
        await expect(showPage.getByText(/10\.0\.0\.101/)).toBeVisible();
      },
    );

    test(
      "show page displays model cache info",
      { tag: "@C2613069" },
      async ({ clusters }) => {
        await clusters.goToShow(clNames.sshWithCache);

        const showPage = clusters.page.locator('[data-testid="show-page"]');
        await expect(showPage).toBeVisible();

        // Model Cache card should be visible
        await expect(
          showPage.getByText("test-cache", { exact: true }),
        ).toBeVisible();

        // Cache type badge should show "Host Path"
        await expect(showPage.getByText(/host path/i)).toBeVisible();

        // Cache path should be visible
        await expect(showPage.getByText("/data/models")).toBeVisible();
      },
    );

    test(
      "show page displays endpoints table",
      { tag: "@C2613070" },
      async ({ clusters }) => {
        await clusters.goToShow(clNames.ssh);

        const showPage = clusters.page.locator('[data-testid="show-page"]');
        await expect(showPage).toBeVisible();

        // Endpoints section title should be visible (scoped to show page content)
        await expect(showPage.getByText("Endpoints")).toBeVisible();

        // Columns button in the endpoints table should be visible
        await expect(
          showPage.getByRole("button", { name: /columns/i }),
        ).toBeVisible();
      },
    );

    test(
      "K8s show page displays router info",
      { tag: "@C2613074" },
      async ({ clusters }) => {
        await clusters.goToShow(clNames.k8s);

        const showPage = clusters.page.locator('[data-testid="show-page"]');
        await expect(showPage).toBeVisible();

        // Router section fields
        await expect(
          showPage.locator("dt", { hasText: /access mode/i }),
        ).toBeVisible();
        await expect(
          showPage.locator("dt", { hasText: /replicas/i }),
        ).toBeVisible();
      },
    );
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
  // Edit tests
  // ────────────────────────────────────────────────────────────
  test.describe("edit", () => {
    // TODO: shares @C2613080 with "K8s edit: name, workspace, type disabled" — create separate TestRail case
    test(
      "SSH edit: name, workspace, type, image registry disabled",
      { tag: "@C2613080" },
      async ({ clusters }) => {
        await clusters.goToEdit(clNames.ssh);
        await expect(
          clusters.page.locator('[data-testid="form-submit"]'),
        ).toBeEnabled();

        // Name disabled
        const nameInput = clusters.form.field("metadata.name").locator("input");
        await expect(nameInput).toBeDisabled();

        // Workspace disabled
        const wsButton = clusters.form
          .field("metadata.workspace")
          .locator('button[role="combobox"]');
        await expect(wsButton).toBeDisabled();

        // Type disabled
        const typeButton = clusters.form
          .field("spec.type")
          .locator('button[role="combobox"]');
        await expect(typeButton).toBeDisabled();

        // Image registry disabled
        const irButton = clusters.form
          .field("spec.image_registry")
          .locator("button");
        await expect(irButton).toBeDisabled();
      },
    );

    test(
      "SSH edit: provider, auth, and cache fields disabled",
      { tag: "@C2612829" },
      async ({ clusters }) => {
        await clusters.goToEdit(clNames.ssh);
        await expect(
          clusters.page.locator('[data-testid="form-submit"]'),
        ).toBeEnabled();

        // Provider: Head IP input should be disabled
        await expect(
          clusters.page.getByPlaceholder("e.g 192.168.1.1"),
        ).toBeDisabled();

        // Provider: Worker IP "Add" section should be hidden (disabled hides it)
        await expect(
          clusters.page.getByRole("button", { name: /add/i }).filter({
            has: clusters.page.locator("svg"),
          }),
        ).toBeHidden();

        // Auth: ssh_user disabled
        const sshUserInput = clusters.form
          .field("spec.config.ssh_config.auth.ssh_user")
          .locator("input");
        await expect(sshUserInput).toBeDisabled();

        // Auth: ssh_private_key disabled
        const sshKeyTextarea = clusters.form
          .field("spec.config.ssh_config.auth.ssh_private_key")
          .locator("textarea");
        await expect(sshKeyTextarea).toBeDisabled();

        // Auth: "Leave empty to keep" message
        await expect(
          clusters.page.getByText(/leave empty to keep/i).first(),
        ).toBeVisible();

        // Cache: "Add Model Cache" button should not be visible when disabled
        await expect(
          clusters.page.getByRole("button", { name: /add model cache/i }),
        ).toBeHidden();
      },
    );

    test(
      "K8s edit: name, workspace, type disabled; kubeconfig disabled",
      { tag: "@C2613080" },
      async ({ clusters }) => {
        await clusters.goToEdit(clNames.k8s);
        await expect(
          clusters.page.locator('[data-testid="form-submit"]'),
        ).toBeEnabled();

        // Name disabled
        const nameInput = clusters.form.field("metadata.name").locator("input");
        await expect(nameInput).toBeDisabled();

        // Workspace disabled
        const wsButton = clusters.form
          .field("metadata.workspace")
          .locator('button[role="combobox"]');
        await expect(wsButton).toBeDisabled();

        // Type disabled
        const typeButton = clusters.form
          .field("spec.type")
          .locator('button[role="combobox"]');
        await expect(typeButton).toBeDisabled();

        // Kubeconfig disabled
        const kubeconfigTextarea = clusters.form
          .field("spec.config.kubernetes_config.kubeconfig")
          .locator("textarea");
        await expect(kubeconfigTextarea).toBeDisabled();

        // "Leave empty to keep" message
        await expect(
          clusters.page.getByText(/leave empty to keep/i).first(),
        ).toBeVisible();
      },
    );

    test(
      "K8s edit: router fields editable",
      { tag: "@C2612832" },
      async ({ clusters }) => {
        await clusters.goToEdit(clNames.k8s);
        await expect(
          clusters.page.locator('[data-testid="form-submit"]'),
        ).toBeEnabled();

        // Access mode should be enabled
        const accessModeButton = clusters.form
          .field("spec.config.kubernetes_config.router.access_mode")
          .locator('button[role="combobox"]');
        await expect(accessModeButton).toBeEnabled();

        // Replicas input should be enabled
        const replicasInput = clusters.form
          .field("spec.config.kubernetes_config.router.replicas")
          .locator("input");
        await expect(replicasInput).toBeEnabled();

        // CPU input should be enabled
        const cpuInput = clusters.form
          .field("spec.config.kubernetes_config.router.resources.cpu")
          .locator("input");
        await expect(cpuInput).toBeEnabled();

        // Memory input should be enabled
        const memoryInput = clusters.form
          .field("spec.config.kubernetes_config.router.resources.memory")
          .locator("input");
        await expect(memoryInput).toBeEnabled();
      },
    );

    test(
      "edit from list action menu",
      { tag: "@C2613085" },
      async ({ clusters }) => {
        await clusters.goToList();
        await clusters.table.editRow(clNames.ssh);

        // Verify form is visible with disabled name
        await expect(
          clusters.page.locator('[data-testid="form"]'),
        ).toBeVisible();
        const nameInput = clusters.form.field("metadata.name").locator("input");
        await expect(nameInput).toBeDisabled();
        await expect(nameInput).toHaveValue(clNames.ssh);
      },
    );

    test(
      "edit from detail action menu",
      { tag: "@C2613086" },
      async ({ clusters }) => {
        await clusters.goToShow(clNames.ssh);
        await clusters.showPageEdit();

        // Verify form is visible with disabled name
        await expect(
          clusters.page.locator('[data-testid="form"]'),
        ).toBeVisible();
        const nameInput = clusters.form.field("metadata.name").locator("input");
        await expect(nameInput).toBeDisabled();
        await expect(nameInput).toHaveValue(clNames.ssh);
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // Delete tests
  // ────────────────────────────────────────────────────────────
  test.describe("delete", () => {
    test(
      "delete from list -> confirm -> dialog closes",
      { tag: "@C2613098" },
      async ({ clusters, apiHelper }) => {
        const name = `test-cl-del-${Date.now()}`;
        await apiHelper.createCluster(name, {
          imageRegistry: irName.value,
        });

        await clusters.goToList();
        await clusters.table.deleteRow(name, { noWait: true });

        // Cleanup via API in case backend GC is slow
        await apiHelper.deleteCluster(name, { force: true }).catch(() => {});
      },
    );

    test(
      "delete from detail action menu",
      { tag: "@C2613099" },
      async ({ clusters, apiHelper }) => {
        const name = `test-cl-del-detail-${Date.now()}`;
        await apiHelper.createCluster(name, {
          imageRegistry: irName.value,
        });

        await clusters.goToShow(name);

        // Open show page actions, click delete
        await clusters.page
          .locator('[data-testid="show-actions-trigger"]')
          .click();
        await clusters.page.getByRole("menuitem", { name: /delete/i }).click();

        // Confirm delete dialog
        const dialog = clusters.page.getByRole("alertdialog");
        await dialog.waitFor({ state: "visible" });
        await dialog.getByRole("button", { name: /delete/i }).click();
        await dialog.waitFor({ state: "hidden" });

        // Cleanup via API in case backend GC is slow
        await apiHelper.deleteCluster(name, { force: true }).catch(() => {});
      },
    );

    test.skip(
      "delete -> cancel -> row still exists",
      { tag: "@miss" },
      async ({ clusters, apiHelper }) => {
        const name = `test-cl-del-cancel-${Date.now()}`;
        await apiHelper.createCluster(name, {
          imageRegistry: irName.value,
        });

        await clusters.goToList();
        await clusters.table.waitForLoaded();

        // Open row actions, click delete
        await clusters.table
          .rowWithText(name)
          .locator('[data-testid="row-actions-trigger"]')
          .click();
        await clusters.page
          .locator('[role="menu"]')
          .waitFor({ state: "visible" });
        await clusters.page.getByRole("menuitem", { name: /delete/i }).click();

        // Cancel the dialog
        const dialog = clusters.page.getByRole("alertdialog");
        await dialog.waitFor({ state: "visible" });
        await dialog.getByRole("button", { name: /cancel/i }).click();
        await dialog.waitFor({ state: "hidden" });

        // Row should still be there
        await clusters.table.expectRowWithText(name);

        // Cleanup
        await apiHelper.deleteCluster(name, { force: true }).catch(() => {});
      },
    );
  });
});
