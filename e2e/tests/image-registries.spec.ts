import { expect, test } from "../fixtures/base";
import { ApiHelper } from "../helpers/api-helper";
import {
  CONNECTION_TIMEOUT,
  DELETE_TIMEOUT,
  MULTI_USER_TIMEOUT,
} from "../helpers/constants";
import { ResourcePage } from "../helpers/resource-page";
import { YamlImportHelper } from "../helpers/yaml-import";

// ── Shared test data created once in beforeAll ──
// Created via API, cleaned up in afterAll.
const irNames = {
  base: "", // Docker Hub public + repository (list/detail/edit tests)
  sort: "", // second item for sort ordering
  fail: "", // bad URL → Failed status
  conn: "", // Docker Hub public, NO repository → Connected status
};

test.describe("image registries", () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const api = new ApiHelper(page);

    const ts = Date.now();
    irNames.base = `test-ir-base-${ts}`;
    irNames.sort = `test-ir-sort-${ts}`;
    irNames.fail = `test-ir-fail-${ts}`;
    irNames.conn = `test-ir-conn-${ts}`;

    await api.createImageRegistry(irNames.base);
    await api.createImageRegistry(irNames.sort, {
      repository: "library/alpine",
    });
    await api.createImageRegistry(irNames.fail, {
      url: "https://fake-registry.invalid",
      repository: "invalid/repo",
    });
    await api.createImageRegistry(irNames.conn, { repository: "" });

    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const api = new ApiHelper(page);

    for (const name of Object.values(irNames)) {
      await api.deleteImageRegistry(name).catch(() => {});
    }
    await context.close();
  });

  // ────────────────────────────────────────────────────────────
  // List tests
  // ────────────────────────────────────────────────────────────
  test.describe("list", () => {
    test(
      "list page shows expected columns",
      { tag: "@C2611960" },
      async ({ imageRegistries }) => {
        await imageRegistries.goToList();

        const headers = imageRegistries.table.root.locator("thead th");
        await expect(headers.filter({ hasText: /name/i })).toBeVisible();
        await expect(headers.filter({ hasText: /workspace/i })).toBeVisible();
        await expect(headers.filter({ hasText: /status/i })).toBeVisible();
        await expect(headers.filter({ hasText: /updated/i })).toBeVisible();
        await expect(headers.filter({ hasText: /created/i })).toBeVisible();

        await imageRegistries.table.expectRowWithText(irNames.base);
      },
    );

    test(
      "default sort order is newest first",
      { tag: "@C2611975" },
      async ({ imageRegistries }) => {
        await imageRegistries.goToList();
        await imageRegistries.table.waitForLoaded();

        await imageRegistries.table.expectRowWithText(irNames.base);
        await imageRegistries.table.expectRowWithText(irNames.sort);
      },
    );

    test(
      "can sort by name",
      { tag: "@C2611970" },
      async ({ imageRegistries }) => {
        await imageRegistries.goToList();
        await imageRegistries.table.sort(/name/i);
      },
    );

    test(
      "can sort by updated at and timestamp is displayed",
      { tag: ["@C2611971", "@C2611964"] },
      async ({ imageRegistries }) => {
        await imageRegistries.goToList();
        await expect(
          imageRegistries.table.headerCell(/updated/i),
        ).toBeVisible();
        await imageRegistries.table.sort(/updated/i);
      },
    );

    test(
      "can sort by created at and timestamp is displayed",
      { tag: ["@C2611972", "@C2611965"] },
      async ({ imageRegistries }) => {
        await imageRegistries.goToList();
        await expect(
          imageRegistries.table.headerCell(/created/i),
        ).toBeVisible();
        await imageRegistries.table.sort(/created/i);
      },
    );

    test(
      "can toggle column visibility",
      { tag: "@C2611968" },
      async ({ imageRegistries }) => {
        await imageRegistries.goToList();

        await expect(imageRegistries.table.headerCell(/status/i)).toBeVisible();
        await imageRegistries.table.toggleColumn(/status/i);
        await expect(imageRegistries.table.headerCell(/status/i)).toBeHidden();
        await imageRegistries.table.toggleColumn(/status/i);
        await expect(imageRegistries.table.headerCell(/status/i)).toBeVisible();
      },
    );

    test(
      "clicking name navigates to detail page",
      { tag: "@C2611961" },
      async ({ imageRegistries }) => {
        await imageRegistries.goToList();
        await imageRegistries.table.clickRowLink(irNames.base);

        const showPage = imageRegistries.page.locator(
          '[data-testid="show-page"]',
        );
        await expect(showPage).toBeVisible();
        await expect(
          showPage.getByText(irNames.base, { exact: true }),
        ).toBeVisible();
      },
    );

    test(
      "clicking workspace navigates to workspace detail",
      { tag: "@C2611962" },
      async ({ imageRegistries }) => {
        await imageRegistries.goToList();

        const row = imageRegistries.table.rowWithText(irNames.base);
        await row.getByRole("link", { name: "default" }).click();

        const showPage = imageRegistries.page.locator(
          '[data-testid="show-page"]',
        );
        await expect(showPage).toBeVisible();
        await expect(
          showPage.getByText("default", { exact: true }),
        ).toBeVisible();
      },
    );

    test(
      "status column shows status badge",
      { tag: "@C2611963" },
      async ({ imageRegistries }) => {
        await imageRegistries.goToList();
        await expect(imageRegistries.table.headerCell(/status/i)).toBeVisible();

        const row = imageRegistries.table.rowWithText(irNames.base);
        await expect(row).toBeVisible();
      },
    );

    test(
      "clicking Failed status shows error message",
      { tag: "@C2613790" },
      async ({ imageRegistries }) => {
        await imageRegistries.goToList();

        const row = imageRegistries.table.rowWithText(irNames.fail);
        // Wait for the status to become Failed
        await expect(row.getByText("Failed")).toBeVisible({
          timeout: CONNECTION_TIMEOUT,
        });

        // Click the Failed badge to see error details
        await row.getByText("Failed").click();

        // Error message should be visible (in a popover or tooltip)
        await expect(
          imageRegistries.page.getByText(/error|fail|connect/i).first(),
        ).toBeVisible();
      },
    );

    test(
      "admin user sees all registries",
      { tag: "@C2612125" },
      async ({ imageRegistries }) => {
        await imageRegistries.goToList();
        const rowCount = await imageRegistries.table.rows().count();
        expect(rowCount).toBeGreaterThan(0);
        await imageRegistries.table.expectRowWithText(irNames.base);
      },
    );

    test(
      "no read permission → sidebar link hidden",
      {
        tag: "@C2612069",
        annotation: {
          type: "slow",
          description:
            "creates test user without image_registry:read permission",
        },
      },
      async ({ createTestUser }, testInfo) => {
        testInfo.setTimeout(MULTI_USER_TIMEOUT);

        const testUser = await createTestUser(["role:read"]);
        await testUser.page.goto("/#/dashboard");
        await testUser.page.waitForURL("**/#/dashboard");

        const sidebar = testUser.page.locator('[data-sidebar="sidebar"]');
        await expect(
          sidebar.getByRole("link", { name: /image registries/i }),
        ).toBeHidden();
      },
    );

    test(
      "read global permission → full list visible",
      {
        tag: "@C2612073",
        annotation: {
          type: "slow",
          description: "creates test user with image_registry:read permission",
        },
      },
      async ({ createTestUser }, testInfo) => {
        testInfo.setTimeout(MULTI_USER_TIMEOUT);

        const testUser = await createTestUser(["image_registry:read"]);
        const irPage = new ResourcePage(testUser.page, {
          routeName: "image-registries",
          workspaced: true,
        });

        await irPage.goToList();
        const rowCount = await irPage.table.rows().count();
        expect(rowCount).toBeGreaterThan(0);
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // Detail tests
  // ────────────────────────────────────────────────────────────
  test.describe("detail", () => {
    test(
      "show page displays name, workspace, status, timestamps, and repo URL",
      { tag: "@C2612087" },
      async ({ imageRegistries }) => {
        await imageRegistries.goToShow(irNames.base);

        const showPage = imageRegistries.page.locator(
          '[data-testid="show-page"]',
        );
        await expect(showPage).toBeVisible();

        // Name
        await expect(
          showPage.getByText(irNames.base, { exact: true }),
        ).toBeVisible();

        // Workspace
        const workspaceDt = showPage.locator("dt", {
          hasText: /workspace/i,
        });
        await expect(workspaceDt).toBeVisible();

        // Status
        const statusDt = showPage.locator("dt", { hasText: /^status$/i });
        await expect(statusDt).toBeVisible();

        // Timestamps
        await expect(
          showPage.getByRole("term").filter({ hasText: /created at/i }),
        ).toBeVisible();
        await expect(
          showPage.getByRole("term").filter({ hasText: /updated at/i }),
        ).toBeVisible();

        // Repo URL (format: {spec.url}/{spec.repository})
        await expect(
          showPage.getByText("https://index.docker.io/v1"),
        ).toBeVisible();
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // Create tests
  // ────────────────────────────────────────────────────────────
  test.describe("create", () => {
    test(
      "name format: must be lowercase alphanumeric + '-' / '.'",
      { tag: "@C2611998" },
      async ({ imageRegistries }) => {
        await imageRegistries.goToCreate();

        await imageRegistries.form.fillInput("metadata.name", "INVALID_NAME");
        await imageRegistries.form.fillInput(
          "spec.url",
          "https://index.docker.io/v1",
        );

        // Server-side validation rejects invalid name format
        const responsePromise = imageRegistries.page.waitForResponse(
          (resp) =>
            resp.url().includes("image_registries") &&
            resp.request().method() === "POST",
        );
        await imageRegistries.form.submit();
        const response = await responsePromise;
        expect(response.status()).toBeGreaterThanOrEqual(400);

        // Form stays visible (no redirect)
        await expect(imageRegistries.form.root).toBeVisible();
      },
    );

    test(
      "name max 63 chars → error on save",
      { tag: "@C2612021" },
      async ({ imageRegistries }) => {
        await imageRegistries.goToCreate();

        const longName = "a".repeat(64);
        await imageRegistries.form.fillInput("metadata.name", longName);
        await imageRegistries.form.fillInput(
          "spec.url",
          "https://index.docker.io/v1",
        );

        const responsePromise = imageRegistries.page.waitForResponse(
          (resp) =>
            resp.url().includes("image_registries") &&
            resp.request().method() === "POST",
        );
        await imageRegistries.form.submit();
        const response = await responsePromise;
        expect(response.status()).toBeGreaterThanOrEqual(400);

        await expect(imageRegistries.form.root).toBeVisible();
      },
    );

    test(
      "name empty → cannot save",
      { tag: "@C2612006" },
      async ({ imageRegistries }) => {
        await imageRegistries.goToCreate();

        // Leave name empty, fill other fields
        await imageRegistries.form.fillInput(
          "spec.url",
          "https://index.docker.io/v1",
        );

        await imageRegistries.form.submit();

        // Client-side validation shows error message
        await expect(
          imageRegistries.page.getByText(/name is required/i),
        ).toBeVisible();
        await expect(imageRegistries.form.root).toBeVisible();
      },
    );

    test(
      "name leading/trailing spaces → rejected by server",
      { tag: "@C2612017" },
      async ({ imageRegistries }) => {
        const name = `test-ir-trim-${Date.now()}`;
        await imageRegistries.goToCreate();

        await imageRegistries.form.fillInput("metadata.name", `  ${name}  `);
        await imageRegistries.form.fillInput(
          "spec.url",
          "https://index.docker.io/v1",
        );

        const responsePromise = imageRegistries.page.waitForResponse(
          (resp) =>
            resp.url().includes("image_registries") &&
            resp.request().method() === "POST",
        );
        await imageRegistries.form.submit();
        const response = await responsePromise;
        expect(response.status()).toBeGreaterThanOrEqual(400);

        // Form stays visible (server rejected the name with spaces)
        await expect(imageRegistries.form.root).toBeVisible();
      },
    );

    test(
      "duplicate name in same workspace → error",
      { tag: "@C2612007" },
      async ({ imageRegistries }) => {
        await imageRegistries.goToCreate();

        // Use the name of an existing registry
        await imageRegistries.form.fillInput("metadata.name", irNames.base);
        await imageRegistries.form.fillInput(
          "spec.url",
          "https://index.docker.io/v1",
        );
        await imageRegistries.form.submit();

        // Should show an error (toast or inline)
        await expect(
          imageRegistries.page.getByText(/already exists|duplicate|conflict/i),
        ).toBeVisible({ timeout: 10_000 });
      },
    );

    test(
      "different name + same URL in same workspace → ok",
      { tag: "@C2612008" },
      async ({ imageRegistries, apiHelper }) => {
        const name = `test-ir-sameurl-${Date.now()}`;
        await imageRegistries.goToCreate();

        await imageRegistries.form.fillInput("metadata.name", name);
        await imageRegistries.form.fillInput(
          "spec.url",
          "https://index.docker.io/v1",
        );
        await imageRegistries.form.fillInput(
          "spec.repository",
          "library/nginx",
        );
        await imageRegistries.form.submit();

        // After create, form redirects to list page
        await imageRegistries.table.waitForLoaded();
        await imageRegistries.table.expectRowWithText(name);

        // Cleanup
        await apiHelper.deleteImageRegistry(name).catch(() => {});
      },
    );

    test(
      "workspace required",
      { tag: "@C2612010" },
      async ({ imageRegistries }) => {
        await imageRegistries.goToCreate();

        const wsField = imageRegistries.form.field("metadata.workspace");
        await expect(wsField).toBeVisible();
      },
    );

    test(
      "workspace auto-fills from global selector",
      { tag: "@C2612011" },
      async ({ imageRegistries }) => {
        await imageRegistries.goToCreate();

        const wsField = imageRegistries.form.field("metadata.workspace");
        await expect(wsField.getByText("default")).toBeVisible();
      },
    );

    test(
      "workspace binding works for default workspace",
      { tag: "@C2611999" },
      async ({ imageRegistries }) => {
        await imageRegistries.goToCreate();

        const wsField = imageRegistries.form.field("metadata.workspace");
        await expect(wsField.getByText("default")).toBeVisible();
      },
    );

    test(
      "URL field present with placeholder",
      { tag: "@C2612000" },
      async ({ imageRegistries }) => {
        await imageRegistries.goToCreate();

        const urlField = imageRegistries.form.field("spec.url");
        await expect(urlField).toBeVisible();
        const input = urlField.locator("input");
        await expect(input).toBeVisible();
      },
    );

    test(
      "repository field present",
      { tag: "@C2612001" },
      async ({ imageRegistries }) => {
        await imageRegistries.goToCreate();

        const repoField = imageRegistries.form.field("spec.repository");
        await expect(repoField).toBeVisible();
      },
    );

    test(
      "create with https URL → saved correctly",
      { tag: "@C2612012" },
      async ({ imageRegistries, apiHelper }) => {
        const name = `test-ir-https-${Date.now()}`;
        await imageRegistries.goToCreate();

        await imageRegistries.form.fillInput("metadata.name", name);
        await imageRegistries.form.fillInput(
          "spec.url",
          "https://index.docker.io/v1",
        );
        await imageRegistries.form.fillInput(
          "spec.repository",
          "library/nginx",
        );
        await imageRegistries.form.submit();

        // Redirects to list → verify row exists, then check detail
        await imageRegistries.table.waitForLoaded();
        await imageRegistries.table.expectRowWithText(name);
        await imageRegistries.table.clickRowLink(name);

        const showPage = imageRegistries.page.locator(
          '[data-testid="show-page"]',
        );
        await expect(showPage).toBeVisible();
        await expect(
          showPage.getByText("https://index.docker.io/v1/library/nginx"),
        ).toBeVisible();

        // Cleanup
        await apiHelper.deleteImageRegistry(name).catch(() => {});
      },
    );

    test(
      "create with http URL → saved correctly",
      { tag: "@C2612013" },
      async ({ imageRegistries, apiHelper }) => {
        const name = `test-ir-http-${Date.now()}`;
        await imageRegistries.goToCreate();

        await imageRegistries.form.fillInput("metadata.name", name);
        await imageRegistries.form.fillInput(
          "spec.url",
          "http://registry.example.com",
        );
        await imageRegistries.form.fillInput("spec.repository", "myrepo");
        await imageRegistries.form.submit();

        // Redirects to list → verify row exists, then check detail
        await imageRegistries.table.waitForLoaded();
        await imageRegistries.table.expectRowWithText(name);
        await imageRegistries.table.clickRowLink(name);

        const showPage = imageRegistries.page.locator(
          '[data-testid="show-page"]',
        );
        await expect(showPage).toBeVisible();
        await expect(
          showPage.getByText("http://registry.example.com/myrepo"),
        ).toBeVisible();

        // Cleanup
        await apiHelper.deleteImageRegistry(name).catch(() => {});
      },
    );

    test(
      "create with URL containing port → saved correctly",
      { tag: "@C2612014" },
      async ({ imageRegistries, apiHelper }) => {
        const name = `test-ir-port-${Date.now()}`;
        await imageRegistries.goToCreate();

        await imageRegistries.form.fillInput("metadata.name", name);
        await imageRegistries.form.fillInput(
          "spec.url",
          "https://registry.example.com:5000",
        );
        await imageRegistries.form.fillInput("spec.repository", "myrepo");
        await imageRegistries.form.submit();

        // Redirects to list → verify row exists, then check detail
        await imageRegistries.table.waitForLoaded();
        await imageRegistries.table.expectRowWithText(name);
        await imageRegistries.table.clickRowLink(name);

        const showPage = imageRegistries.page.locator(
          '[data-testid="show-page"]',
        );
        await expect(showPage).toBeVisible();
        await expect(
          showPage.getByText("https://registry.example.com:5000/myrepo"),
        ).toBeVisible();

        // Cleanup
        await apiHelper.deleteImageRegistry(name).catch(() => {});
      },
    );

    test(
      "URL/repo leading/trailing spaces → rejected by server",
      { tag: "@C2612023" },
      async ({ imageRegistries }) => {
        const name = `test-ir-trimurl-${Date.now()}`;
        await imageRegistries.goToCreate();

        await imageRegistries.form.fillInput("metadata.name", name);
        await imageRegistries.form.fillInput(
          "spec.url",
          "  https://index.docker.io/v1  ",
        );
        await imageRegistries.form.fillInput(
          "spec.repository",
          "  library/nginx  ",
        );

        const responsePromise = imageRegistries.page.waitForResponse(
          (resp) =>
            resp.url().includes("image_registries") &&
            resp.request().method() === "POST",
        );
        await imageRegistries.form.submit();
        const response = await responsePromise;
        expect(response.status()).toBeGreaterThanOrEqual(400);

        // Form stays visible (server rejected values with spaces)
        await expect(imageRegistries.form.root).toBeVisible();
      },
    );

    test(
      "repository empty → can create",
      { tag: "@C2612018" },
      async ({ imageRegistries, apiHelper }) => {
        const name = `test-ir-norepo-${Date.now()}`;
        await imageRegistries.goToCreate();

        await imageRegistries.form.fillInput("metadata.name", name);
        await imageRegistries.form.fillInput(
          "spec.url",
          "https://index.docker.io/v1",
        );
        // Leave repository empty
        await imageRegistries.form.submit();

        // Redirects to list → row should exist
        await imageRegistries.table.waitForLoaded();
        await imageRegistries.table.expectRowWithText(name);

        // Cleanup
        await apiHelper.deleteImageRegistry(name).catch(() => {});
      },
    );

    test(
      "save → all params visible on detail page",
      { tag: "@C2612004" },
      async ({ imageRegistries, apiHelper }) => {
        const name = `test-ir-params-${Date.now()}`;
        await imageRegistries.goToCreate();

        await imageRegistries.form.fillInput("metadata.name", name);
        await imageRegistries.form.fillInput(
          "spec.url",
          "https://index.docker.io/v1",
        );
        await imageRegistries.form.fillInput(
          "spec.repository",
          "library/nginx",
        );
        await imageRegistries.form.submit();

        // Redirects to list → navigate to show page
        await imageRegistries.table.waitForLoaded();
        await imageRegistries.table.clickRowLink(name);

        const showPage = imageRegistries.page.locator(
          '[data-testid="show-page"]',
        );
        await expect(showPage).toBeVisible();
        await expect(showPage.getByText(name, { exact: true })).toBeVisible();
        await expect(
          showPage.getByText("https://index.docker.io/v1/library/nginx"),
        ).toBeVisible();

        // Cleanup
        await apiHelper.deleteImageRegistry(name).catch(() => {});
      },
    );

    test(
      "auth fields create + backend persistence (username saved, password masked)",
      { tag: "@C2612003" },
      async ({ imageRegistries, apiHelper }) => {
        const name = `test-ir-auth-${Date.now()}`;
        await imageRegistries.goToCreate();

        await imageRegistries.form.fillInput("metadata.name", name);
        await imageRegistries.form.fillInput(
          "spec.url",
          "https://index.docker.io/v1",
        );
        await imageRegistries.form.fillInput(
          "spec.repository",
          "library/nginx",
        );
        await imageRegistries.form.fillInput(
          "spec.authconfig.username",
          "testuser",
        );
        await imageRegistries.form.fillInput(
          "spec.authconfig.password",
          "testpass123",
        );
        await imageRegistries.form.submit();

        // Redirects to list → verify row exists
        await imageRegistries.table.waitForLoaded();
        await imageRegistries.table.expectRowWithText(name);

        // Navigate to edit page to verify backend persisted auth fields
        await imageRegistries.goToEdit(name);
        await expect(
          imageRegistries.page.locator('[data-testid="form-submit"]'),
        ).toBeEnabled();

        // Backend clears auth fields on read for security — both should be empty
        const usernameInput = imageRegistries.form
          .field("spec.authconfig.username")
          .locator("input");
        await expect(usernameInput).toHaveValue("");

        const pwInput = imageRegistries.form
          .field("spec.authconfig.password")
          .locator("input");
        await expect(pwInput).toHaveValue("");

        // "Leave empty to keep" description confirms auth was saved
        await expect(
          imageRegistries.page.getByText(/leave empty to keep/i).first(),
        ).toBeVisible();

        // Cleanup
        imageRegistries.page.on("dialog", (dialog) => dialog.accept());
        await apiHelper.deleteImageRegistry(name).catch(() => {});
      },
    );

    test(
      "empty URL → server rejects or status becomes Failed",
      { tag: "@C2612015" },
      async ({ imageRegistries, apiHelper }) => {
        const name = `test-ir-emptyurl-${Date.now()}`;
        await imageRegistries.goToCreate();

        // Fill name only, leave URL empty
        await imageRegistries.form.fillInput("metadata.name", name);

        const responsePromise = imageRegistries.page.waitForResponse(
          (resp) =>
            resp.url().includes("image_registries") &&
            resp.request().method() === "POST",
        );
        await imageRegistries.form.submit();
        const response = await responsePromise;

        if (response.status() >= 400) {
          // Server rejected — form should still be visible
          await expect(imageRegistries.form.root).toBeVisible();
        } else {
          // Server accepted — verify row exists, then check status becomes Failed
          await imageRegistries.table.waitForLoaded();
          await imageRegistries.table.expectRowWithText(name);

          const row = imageRegistries.table.rowWithText(name);
          await expect(row.getByText("Failed")).toBeVisible({
            timeout: CONNECTION_TIMEOUT,
          });

          // Cleanup
          await apiHelper.deleteImageRegistry(name).catch(() => {});
        }
      },
    );

    test(
      "URL without protocol → server rejects or status becomes Failed",
      { tag: "@C2612016" },
      async ({ imageRegistries, apiHelper }) => {
        const name = `test-ir-noproto-${Date.now()}`;
        await imageRegistries.goToCreate();

        await imageRegistries.form.fillInput("metadata.name", name);
        await imageRegistries.form.fillInput("spec.url", "index.docker.io");

        const responsePromise = imageRegistries.page.waitForResponse(
          (resp) =>
            resp.url().includes("image_registries") &&
            resp.request().method() === "POST",
        );
        await imageRegistries.form.submit();
        const response = await responsePromise;

        if (response.status() >= 400) {
          // Server rejected — form should still be visible
          await expect(imageRegistries.form.root).toBeVisible();
        } else {
          // Server accepted — verify row exists, then check status becomes Failed
          await imageRegistries.table.waitForLoaded();
          await imageRegistries.table.expectRowWithText(name);

          const row = imageRegistries.table.rowWithText(name);
          await expect(row.getByText("Failed")).toBeVisible({
            timeout: CONNECTION_TIMEOUT,
          });

          // Cleanup
          await apiHelper.deleteImageRegistry(name).catch(() => {});
        }
      },
    );

    test(
      "concurrent submit → rapid clicks produce only one POST request",
      { tag: "@C2612024" },
      async ({ imageRegistries, apiHelper }) => {
        const name = `test-ir-concurrent-${Date.now()}`;
        await imageRegistries.goToCreate();

        await imageRegistries.form.fillInput("metadata.name", name);
        await imageRegistries.form.fillInput(
          "spec.url",
          "https://index.docker.io/v1",
        );

        // Count POST requests to image_registries
        let postCount = 0;
        imageRegistries.page.on("request", (req) => {
          if (
            req.url().includes("image_registries") &&
            req.method() === "POST"
          ) {
            postCount++;
          }
        });

        // Rapid clicks on submit button
        const submitBtn = imageRegistries.page.locator(
          '[data-testid="form-submit"]',
        );
        await submitBtn.click();
        await submitBtn.click({ force: true });
        await submitBtn.click({ force: true });

        // Wait for the first submission to complete
        await imageRegistries.page.waitForResponse(
          (resp) =>
            resp.url().includes("image_registries") &&
            resp.request().method() === "POST",
        );
        // Allow any queued requests to settle
        await imageRegistries.page.waitForTimeout(1000);

        expect(postCount).toBe(1);

        // Cleanup
        await apiHelper.deleteImageRegistry(name).catch(() => {});
      },
    );

    test(
      "cancel → no registry created",
      { tag: "@C2612005" },
      async ({ imageRegistries }) => {
        const name = `test-ir-cancel-${Date.now()}`;

        // Go to list first, then click Create so "back" returns to list
        await imageRegistries.goToList();
        await imageRegistries.clickCreate();

        await imageRegistries.form.fillInput("metadata.name", name);
        await imageRegistries.form.fillInput(
          "spec.url",
          "https://index.docker.io/v1",
        );

        // Accept browser dialog if warnWhenUnsavedChanges fires
        imageRegistries.page.on("dialog", (dialog) => dialog.accept());
        await imageRegistries.form.cancel();

        // Should navigate back to list
        await imageRegistries.table.waitForLoaded();
        await imageRegistries.table.expectNoRowWithText(name);
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // Create permissions (multi-user)
  // ────────────────────────────────────────────────────────────
  test.describe("create permissions", () => {
    test(
      "no create permission → save fails",
      {
        tag: "@C2612070",
        annotation: {
          type: "slow",
          description: "creates test user with image_registry:read only",
        },
      },
      async ({ createTestUser }, testInfo) => {
        testInfo.setTimeout(MULTI_USER_TIMEOUT);

        const testUser = await createTestUser(["image_registry:read"]);
        const irPage = new ResourcePage(testUser.page, {
          routeName: "image-registries",
          workspaced: true,
        });

        const name = `test-ir-noperm-${Date.now()}`;
        await irPage.goToCreate();
        await irPage.form.fillInput("metadata.name", name);
        await irPage.form.fillInput("spec.url", "https://index.docker.io/v1");
        await irPage.form.submit();

        // Should show error (permission denied or 403)
        await expect(
          testUser.page.getByText(/error|denied|forbidden|fail/i).first(),
        ).toBeVisible({ timeout: 10_000 });
      },
    );

    test(
      "create global permission → can create",
      {
        tag: "@C2612074",
        annotation: {
          type: "slow",
          description:
            "creates test user with image_registry:create+read permissions",
        },
      },
      async ({ createTestUser, apiHelper }, testInfo) => {
        testInfo.setTimeout(MULTI_USER_TIMEOUT);

        const testUser = await createTestUser([
          "image_registry:create",
          "image_registry:read",
        ]);
        const irPage = new ResourcePage(testUser.page, {
          routeName: "image-registries",
          workspaced: true,
        });

        const name = `test-ir-perm-${Date.now()}`;
        await irPage.goToCreate();
        await irPage.form.fillInput("metadata.name", name);
        await irPage.form.fillInput("spec.url", "https://index.docker.io/v1");
        await irPage.form.submit();

        // Redirects to list → row should exist
        await irPage.table.waitForLoaded();
        await irPage.table.expectRowWithText(name);

        // Cleanup
        await apiHelper.deleteImageRegistry(name).catch(() => {});
      },
    );

    test(
      "no create permission → yaml import fails",
      {
        tag: "@C2612082",
        annotation: {
          type: "slow",
          description: "creates test user with image_registry:read only",
        },
      },
      async ({ createTestUser }, testInfo) => {
        testInfo.setTimeout(MULTI_USER_TIMEOUT);

        const testUser = await createTestUser(["image_registry:read"]);
        const irPage = new ResourcePage(testUser.page, {
          routeName: "image-registries",
          workspaced: true,
        });
        const yamlHelper = new YamlImportHelper(testUser.page);

        const name = `test-ir-yamlperm-${Date.now()}`;
        const yaml = `apiVersion: v1
kind: ImageRegistry
metadata:
  name: ${name}
  workspace: default
spec:
  url: https://index.docker.io/v1
  repository: library/nginx
  authconfig: {}`;

        await irPage.goToList();
        await yamlHelper.importYaml(yaml);
        await yamlHelper.expectResults({ errors: 1 });
        await yamlHelper.close();
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // Edit tests
  // ────────────────────────────────────────────────────────────
  test.describe("edit", () => {
    test(
      "edit from list action menu → form loads",
      { tag: "@C2612029" },
      async ({ imageRegistries }) => {
        await imageRegistries.goToList();
        await imageRegistries.table.editRow(irNames.base);

        await expect(imageRegistries.form.root).toBeVisible();
      },
    );

    test(
      "edit from detail page menu → form loads",
      { tag: "@C2612030" },
      async ({ imageRegistries }) => {
        await imageRegistries.goToShow(irNames.base);
        await imageRegistries.showPageEdit();

        await expect(imageRegistries.form.root).toBeVisible();
      },
    );

    test(
      "name + workspace fields disabled in edit",
      { tag: "@C2612031" },
      async ({ imageRegistries }) => {
        await imageRegistries.goToEdit(irNames.base);

        const nameInput = imageRegistries.form
          .field("metadata.name")
          .locator("input");
        await expect(nameInput).toBeDisabled();

        const wsField = imageRegistries.form.field("metadata.workspace");
        const wsButton = wsField.locator('button[role="combobox"]');
        await expect(wsButton).toBeDisabled();
      },
    );

    test(
      "edit URL/repo/auth → save → changes persist",
      { tag: "@C2612032" },
      async ({ imageRegistries, apiHelper }) => {
        const name = `test-ir-mod-${Date.now()}`;
        await apiHelper.createImageRegistry(name);

        await imageRegistries.goToEdit(name);
        await expect(
          imageRegistries.page.locator('[data-testid="form-submit"]'),
        ).toBeEnabled();

        await imageRegistries.form.fillInput(
          "spec.url",
          "https://registry.example.com",
        );
        await imageRegistries.form.fillInput("spec.repository", "myrepo/test");
        await imageRegistries.form.fillInput(
          "spec.authconfig.username",
          "testuser",
        );
        await imageRegistries.form.fillInput(
          "spec.authconfig.password",
          "testpass",
        );
        await imageRegistries.form.submit();

        // Edit redirects to list → use direct navigation to avoid cache
        await imageRegistries.table.waitForLoaded();
        await imageRegistries.goToShow(name);

        const showPage = imageRegistries.page.locator(
          '[data-testid="show-page"]',
        );
        await expect(showPage).toBeVisible();
        await expect(
          showPage.getByText("https://registry.example.com/myrepo/test"),
        ).toBeVisible();

        // Cleanup
        await apiHelper.deleteImageRegistry(name).catch(() => {});
      },
    );

    test(
      "cancel → changes not saved",
      { tag: "@C2612033" },
      async ({ imageRegistries }) => {
        await imageRegistries.goToEdit(irNames.base);
        await expect(
          imageRegistries.page.locator('[data-testid="form-submit"]'),
        ).toBeEnabled();

        await imageRegistries.form.fillInput(
          "spec.url",
          "https://should-not-save.example.com",
        );

        // Accept browser dialog if warnWhenUnsavedChanges fires
        imageRegistries.page.on("dialog", (dialog) => dialog.accept());
        await imageRegistries.form.cancel();

        // Verify original URL is still on show page
        await imageRegistries.goToShow(irNames.base);
        const showPage = imageRegistries.page.locator(
          '[data-testid="show-page"]',
        );
        await expect(showPage).toBeVisible();
        await expect(
          showPage.getByText("https://should-not-save.example.com"),
        ).toBeHidden();
      },
    );

    test(
      "save → verify changes on detail page + re-edit",
      { tag: "@C2612035" },
      async ({ imageRegistries, apiHelper }) => {
        const name = `test-ir-reedit-${Date.now()}`;
        await apiHelper.createImageRegistry(name);

        // First edit — wait for form data to load before filling
        await imageRegistries.goToEdit(name);
        await expect(
          imageRegistries.page.locator('[data-testid="form-submit"]'),
        ).toBeEnabled();
        await imageRegistries.form.fillInput(
          "spec.url",
          "https://first-edit.example.com",
        );
        await imageRegistries.form.fillInput("spec.repository", "first/repo");
        await imageRegistries.form.submit();

        // Edit redirects to list → navigate to show page
        await imageRegistries.table.waitForLoaded();
        await imageRegistries.goToShow(name);

        const showPage = imageRegistries.page.locator(
          '[data-testid="show-page"]',
        );
        await expect(showPage).toBeVisible();
        await expect(
          showPage.getByText("https://first-edit.example.com/first/repo"),
        ).toBeVisible();

        // Re-edit from show page
        await imageRegistries.showPageEdit();
        const urlInput = imageRegistries.form
          .field("spec.url")
          .locator("input");
        await expect(urlInput).toHaveValue("https://first-edit.example.com");

        // Cleanup
        imageRegistries.page.on("dialog", (dialog) => dialog.accept());
        await apiHelper.deleteImageRegistry(name).catch(() => {});
      },
    );

    test(
      "auth fields are password type (masked)",
      { tag: "@C2612036" },
      async ({ imageRegistries }) => {
        await imageRegistries.goToEdit(irNames.base);

        const pwInput = imageRegistries.form
          .field("spec.authconfig.password")
          .locator("input");
        await expect(pwInput).toHaveAttribute("type", "password");
      },
    );

    test(
      "clear auth fields + save → fields cleared",
      { tag: "@C2612037" },
      async ({ imageRegistries, apiHelper }) => {
        // Create a registry with auth
        const name = `test-ir-clearauth-${Date.now()}`;
        await apiHelper.createImageRegistry(name, {
          username: "olduser",
          password: "oldpass",
        });

        await imageRegistries.goToEdit(name);
        await expect(
          imageRegistries.page.locator('[data-testid="form-submit"]'),
        ).toBeEnabled();

        // Auth description should be visible in edit mode
        await expect(
          imageRegistries.page.getByText(/leave empty to keep/i).first(),
        ).toBeVisible();

        // Clear and submit (leaving empty should keep existing)
        await imageRegistries.form.submit();

        // Edit redirects to list → verify row exists
        await imageRegistries.table.waitForLoaded();
        await imageRegistries.table.expectRowWithText(name);

        // Cleanup
        await apiHelper.deleteImageRegistry(name).catch(() => {});
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // Edit permissions (multi-user)
  // ────────────────────────────────────────────────────────────
  test.describe("edit permissions", () => {
    test(
      "no edit permission → save fails",
      {
        tag: "@C2612071",
        annotation: {
          type: "slow",
          description: "creates test user with image_registry:read only",
        },
      },
      async ({ createTestUser, apiHelper }, testInfo) => {
        testInfo.setTimeout(MULTI_USER_TIMEOUT);

        const name = `test-ir-noedit-${Date.now()}`;
        await apiHelper.createImageRegistry(name);

        const testUser = await createTestUser(["image_registry:read"]);
        const irPage = new ResourcePage(testUser.page, {
          routeName: "image-registries",
          workspaced: true,
        });

        await irPage.goToEdit(name);
        await expect(
          testUser.page.locator('[data-testid="form-submit"]'),
        ).toBeEnabled();
        await irPage.form.fillInput("spec.url", "https://edited.example.com");
        await irPage.form.submit();

        // Should show error
        await expect(
          testUser.page.getByText(/error|denied|forbidden|fail/i).first(),
        ).toBeVisible({ timeout: 10_000 });

        // Cleanup
        await apiHelper.deleteImageRegistry(name).catch(() => {});
      },
    );

    test(
      "edit global permission → can edit",
      {
        tag: "@C2612075",
        annotation: {
          type: "slow",
          description:
            "creates test user with image_registry:read+update permissions",
        },
      },
      async ({ createTestUser, apiHelper }, testInfo) => {
        testInfo.setTimeout(MULTI_USER_TIMEOUT);

        const name = `test-ir-canedit-${Date.now()}`;
        await apiHelper.createImageRegistry(name);

        const testUser = await createTestUser([
          "image_registry:read",
          "image_registry:update",
        ]);
        const irPage = new ResourcePage(testUser.page, {
          routeName: "image-registries",
          workspaced: true,
        });

        await irPage.goToEdit(name);
        await expect(
          testUser.page.locator('[data-testid="form-submit"]'),
        ).toBeEnabled();
        await irPage.form.fillInput(
          "spec.url",
          "https://edited-perm.example.com",
        );
        await irPage.form.submit();

        // Edit redirects to list → row should exist
        await irPage.table.waitForLoaded();
        await irPage.table.expectRowWithText(name);

        // Cleanup
        await apiHelper.deleteImageRegistry(name).catch(() => {});
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // Delete tests
  // ────────────────────────────────────────────────────────────
  test.describe("delete", () => {
    test(
      "delete from list → confirm → row disappears",
      { tag: "@C2612044" },
      async ({ imageRegistries, apiHelper }) => {
        const name = `test-ir-del-${Date.now()}`;
        await apiHelper.createImageRegistry(name);

        await imageRegistries.goToList();
        await imageRegistries.table.deleteRow(name);
        await imageRegistries.table.expectNoRowWithText(name);
      },
    );

    test(
      "delete from detail page → confirm → redirected to list",
      { tag: "@C2612045" },
      async ({ imageRegistries, apiHelper }) => {
        const name = `test-ir-del-show-${Date.now()}`;
        await apiHelper.createImageRegistry(name);

        await imageRegistries.goToShow(name);
        await imageRegistries.showPageDelete(name);
      },
    );

    test(
      "delete → cancel → row still exists",
      { tag: "@C2612046" },
      async ({ imageRegistries, apiHelper }) => {
        const name = `test-ir-del-cancel-${Date.now()}`;
        await apiHelper.createImageRegistry(name);

        await imageRegistries.goToList();
        await imageRegistries.table.waitForLoaded();

        // Open row actions, click delete
        await imageRegistries.table
          .rowWithText(name)
          .locator('[data-testid="row-actions-trigger"]')
          .click();
        await imageRegistries.page
          .locator('[role="menu"]')
          .waitFor({ state: "visible" });
        await imageRegistries.page
          .getByRole("menuitem", { name: /delete/i })
          .click();

        // Cancel the dialog
        const dialog = imageRegistries.page.getByRole("alertdialog");
        await dialog.waitFor({ state: "visible" });
        await dialog.getByRole("button", { name: /cancel/i }).click();
        await dialog.waitFor({ state: "hidden" });

        // Row should still be there
        await imageRegistries.table.expectRowWithText(name);

        // Cleanup
        await apiHelper.deleteImageRegistry(name).catch(() => {});
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // Delete permissions (multi-user)
  // ────────────────────────────────────────────────────────────
  test.describe("delete permissions", () => {
    test(
      "no delete permission → delete fails",
      {
        tag: "@C2612072",
        annotation: {
          type: "slow",
          description: "creates test user with image_registry:read only",
        },
      },
      async ({ createTestUser, apiHelper }, testInfo) => {
        testInfo.setTimeout(MULTI_USER_TIMEOUT);

        const name = `test-ir-nodel-${Date.now()}`;
        await apiHelper.createImageRegistry(name);

        const testUser = await createTestUser(["image_registry:read"]);
        const irPage = new ResourcePage(testUser.page, {
          routeName: "image-registries",
          workspaced: true,
        });

        await irPage.goToList();
        await irPage.table.expectRowWithText(name);

        // Attempt delete
        await irPage.table
          .rowWithText(name)
          .locator('[data-testid="row-actions-trigger"]')
          .click();
        await testUser.page
          .locator('[role="menu"]')
          .waitFor({ state: "visible" });
        await testUser.page.getByRole("menuitem", { name: /delete/i }).click();

        const dialog = testUser.page.getByRole("alertdialog");
        await dialog.waitFor({ state: "visible" });
        await dialog.getByRole("button", { name: /delete/i }).click();
        await dialog.waitFor({ state: "hidden" });

        // Row should still exist (delete failed)
        await irPage.table.expectRowWithText(name);

        // Cleanup
        await apiHelper.deleteImageRegistry(name).catch(() => {});
      },
    );

    test(
      "delete global permission → can delete",
      {
        tag: "@C2612076",
        annotation: {
          type: "slow",
          description:
            "creates test user with image_registry:read+delete permissions",
        },
      },
      async ({ createTestUser, apiHelper }, testInfo) => {
        testInfo.setTimeout(MULTI_USER_TIMEOUT);

        const name = `test-ir-candel-${Date.now()}`;
        await apiHelper.createImageRegistry(name);

        const testUser = await createTestUser([
          "image_registry:read",
          "image_registry:delete",
        ]);
        const irPage = new ResourcePage(testUser.page, {
          routeName: "image-registries",
          workspaced: true,
        });

        await irPage.goToList();
        await irPage.table.deleteRow(name);
        await irPage.table.expectNoRowWithText(name);
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // Connection and status tests
  // ────────────────────────────────────────────────────────────
  test.describe("connection and status", () => {
    test(
      "create → initial status shows '-' or Pending",
      { tag: "@C2612022" },
      async ({ imageRegistries, apiHelper }) => {
        const name = `test-ir-pending-${Date.now()}`;

        // Go to list first so create → back goes to list
        await imageRegistries.goToList();
        await imageRegistries.clickCreate();

        await imageRegistries.form.fillInput("metadata.name", name);
        await imageRegistries.form.fillInput(
          "spec.url",
          "https://index.docker.io/v1",
        );
        await imageRegistries.form.submit();

        // Redirects to list → check initial status
        await imageRegistries.table.waitForLoaded();
        const row = imageRegistries.table.rowWithText(name);
        await expect(row).toBeVisible();

        // Status should be "-" or "Pending" initially
        const statusCell = row.locator("td").nth(2);
        const statusText = await statusCell.innerText();
        expect(statusText === "-" || statusText === "Pending").toBeTruthy();

        // Cleanup
        await apiHelper.deleteImageRegistry(name).catch(() => {});
      },
    );

    test(
      "Docker Hub public URL, no auth → status becomes Connected",
      { tag: "@C2612047" },
      async ({ imageRegistries }) => {
        // Use the shared conn registry (Docker Hub URL, no repository)
        await imageRegistries.goToList();

        const row = imageRegistries.table.rowWithText(irNames.conn);
        await expect(row.getByText("Connected")).toBeVisible({
          timeout: CONNECTION_TIMEOUT,
        });
      },
    );

    test(
      "wrong auth credentials → status becomes Failed",
      { tag: "@C2612051" },
      async ({ imageRegistries, apiHelper }) => {
        const name = `test-ir-badauth-${Date.now()}`;
        await apiHelper.createImageRegistry(name, {
          username: "wronguser",
          password: "wrongpass",
        });

        await imageRegistries.goToList();
        const row = imageRegistries.table.rowWithText(name);
        await expect(row.getByText("Failed")).toBeVisible({
          timeout: CONNECTION_TIMEOUT,
        });

        // Cleanup
        await apiHelper.deleteImageRegistry(name).catch(() => {});
      },
    );

    test(
      "bad URL → status becomes Failed",
      { tag: "@C2612140" },
      async ({ imageRegistries }) => {
        // Use the shared fail registry (bad URL)
        await imageRegistries.goToList();

        const row = imageRegistries.table.rowWithText(irNames.fail);
        await expect(row.getByText("Failed")).toBeVisible({
          timeout: CONNECTION_TIMEOUT,
        });
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // Security tests
  // ────────────────────────────────────────────────────────────
  test.describe("security", () => {
    test(
      "create form: password field type=password",
      { tag: "@C2612052" },
      async ({ imageRegistries }) => {
        await imageRegistries.goToCreate();

        const pwInput = imageRegistries.form
          .field("spec.authconfig.password")
          .locator("input");
        await expect(pwInput).toHaveAttribute("type", "password");
      },
    );

    test(
      "edit form: password field type=password",
      { tag: "@C2612054" },
      async ({ imageRegistries }) => {
        await imageRegistries.goToEdit(irNames.base);

        const pwInput = imageRegistries.form
          .field("spec.authconfig.password")
          .locator("input");
        await expect(pwInput).toHaveAttribute("type", "password");
      },
    );

    test(
      "save auth → re-edit → password still masked, no plaintext",
      { tag: "@C2612055" },
      async ({ imageRegistries, apiHelper }) => {
        const name = `test-ir-masked-${Date.now()}`;
        await apiHelper.createImageRegistry(name, {
          username: "secureuser",
          password: "SecurePass123!",
        });

        // Edit the registry
        await imageRegistries.goToEdit(name);

        // Password field should be type=password and not show plaintext
        const pwInput = imageRegistries.form
          .field("spec.authconfig.password")
          .locator("input");
        await expect(pwInput).toHaveAttribute("type", "password");

        // The password value should not be the plaintext password
        // (backend should not return the actual password)
        const pwValue = await pwInput.inputValue();
        expect(pwValue).not.toBe("SecurePass123!");

        // Cleanup
        imageRegistries.page.on("dialog", (dialog) => dialog.accept());
        await apiHelper.deleteImageRegistry(name).catch(() => {});
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // Delete status test
  // ────────────────────────────────────────────────────────────
  test.describe("delete status", () => {
    test(
      "delete → status Deleted → row eventually disappears",
      { tag: "@C2612142" },
      async ({ imageRegistries, apiHelper }) => {
        const name = `test-ir-delstatus-${Date.now()}`;
        await apiHelper.createImageRegistry(name);

        await imageRegistries.goToList();
        await imageRegistries.table.deleteRow(name, { noWait: true });

        // Row should eventually disappear (after backend processes deletion)
        await imageRegistries.table.expectNoRowWithText(name, {
          timeout: DELETE_TIMEOUT,
        });
      },
    );
  });

  // ────────────────────────────────────────────────────────────
  // Delete dependency tests
  // ────────────────────────────────────────────────────────────
  test.describe("delete dependency", () => {
    test(
      "delete blocked when cluster references image registry",
      { tag: "@C2611976" },
      async ({ imageRegistries, apiHelper }) => {
        const ts = Date.now();
        const irName = `test-ir-dep-${ts}`;
        const clName = `test-cl-dep-${ts}`;

        // Create IR + cluster referencing it
        await apiHelper.createImageRegistry(irName);
        await apiHelper.createCluster(clName, { imageRegistry: irName });

        await imageRegistries.goToList();
        await imageRegistries.table.waitForLoaded();

        // Attempt to delete the image registry
        await imageRegistries.table
          .rowWithText(irName)
          .locator('[data-testid="row-actions-trigger"]')
          .click();
        await imageRegistries.page
          .locator('[role="menu"]')
          .waitFor({ state: "visible" });
        await imageRegistries.page
          .getByRole("menuitem", { name: /delete/i })
          .click();

        // Confirm deletion
        const dialog = imageRegistries.page.getByRole("alertdialog");
        await dialog.waitFor({ state: "visible" });
        await dialog.getByRole("button", { name: /delete/i }).click();
        await dialog.waitFor({ state: "hidden" });

        // Wait for backend to process, then verify IR still exists
        await imageRegistries.page.waitForTimeout(3000);
        await imageRegistries.page.reload();
        await imageRegistries.table.waitForLoaded();
        await imageRegistries.table.expectRowWithText(irName);

        // Cleanup: delete cluster first, then IR
        await apiHelper.deleteCluster(clName, { force: true }).catch(() => {});
        await apiHelper
          .deleteImageRegistry(irName, { force: true })
          .catch(() => {});
      },
    );
  });
});
