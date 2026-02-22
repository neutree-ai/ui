import { config } from "../config";
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
    const rawKey = config.sshCluster.sshPrivateKey;
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
});
