# E2E Testing Guide

## Overview

E2E tests use [Playwright](https://playwright.dev/) and follow a layered abstraction built around `ResourcePage`, which composes `TableHelper` and `FormHelper`. Adding a CRUD test for a new resource typically requires two changes: register a fixture and write a spec.

## Running Tests

```bash
# Start the dev server first
yarn dev

# Run all E2E tests
E2E_USER_EMAIL=<email> E2E_USER_PASSWORD=<password> yarn test:e2e

# Run a specific test
E2E_USER_EMAIL=<email> E2E_USER_PASSWORD=<password> yarn test:e2e --grep "roles"

# Open the Playwright UI for debugging
E2E_USER_EMAIL=<email> E2E_USER_PASSWORD=<password> yarn test:e2e:ui
```

## Project Structure

```
e2e/
├── auth/
│   └── auth.setup.ts          # Login once, save session to storage-state.json
├── fixtures/
│   └── base.ts                # Playwright fixtures (register ResourcePage instances)
├── helpers/
│   ├── resource-page.ts       # Page object: navigation (goToList, goToCreate, etc.)
│   ├── table-helper.ts        # Table operations: waitForLoaded, editRow, deleteRow, etc.
│   └── form-helper.ts         # Form operations: fillInput, selectOption, submit, etc.
└── tests/
    └── *.spec.ts              # Test specs
```

## Adding a CRUD Test for a New Resource

### Step 1: Register a fixture in `e2e/fixtures/base.ts`

```ts
import { test as base } from "@playwright/test";
import { ResourcePage } from "../helpers/resource-page";

type ResourceFixtures = {
  roles: ResourcePage;
  clusters: ResourcePage; // <-- add your resource
};

export const test = base.extend<ResourceFixtures>({
  page: async ({ page }, use) => {
    page.on("response", async (res) => {
      if (res.status() >= 400) {
        const body = await res.text().catch(() => "");
        console.log(`[API ${res.status()}] ${res.url()}\n${body}`);
      }
    });
    await use(page);
  },
  roles: async ({ page }, use) => {
    await use(new ResourcePage(page, { routeName: "roles" }));
  },
  // Add your resource fixture:
  clusters: async ({ page }, use) => {
    await use(
      new ResourcePage(page, {
        routeName: "clusters",
        workspaced: true,        // set true if the route is under a workspace
        workspace: "default",    // defaults to "default"
      }),
    );
  },
});

export { expect } from "@playwright/test";
```

- `routeName` — the URL segment (e.g. `"clusters"` → `/#/default/clusters`)
- `workspaced: true` — prepends `/{workspace}/` to all URLs

### Step 2: Write the spec in `e2e/tests/<resource>.spec.ts`

Use a single `test()` with `test.step()` to keep CRUD steps sequential without cross-test dependencies:

```ts
import { test, expect } from "../fixtures/base";

test("clusters CRUD", async ({ clusters }) => {
  const uniqueName = `test-cluster-${Date.now()}`;

  await test.step("list", async () => {
    await clusters.goToList();
    await clusters.table.waitForLoaded();
    // Assert a known row exists
    await clusters.table.expectRowWithText("some-existing-cluster");
  });

  await test.step("create", async () => {
    await clusters.goToCreate();
    await clusters.form.fillInput("metadata.name", uniqueName);
    await clusters.form.selectOption("spec.type", "Some Option");
    await clusters.form.submit();

    await clusters.goToList();
    await clusters.table.expectRowWithText(uniqueName);
  });

  await test.step("edit", async () => {
    await clusters.goToList();
    await clusters.table.editRow(uniqueName);

    await expect(
      clusters.page.locator('[data-testid="form"]'),
    ).toBeVisible();

    // Make changes...
    await clusters.form.submit();
  });

  await test.step("delete", async () => {
    await clusters.goToList();
    await clusters.table.deleteRow(uniqueName);
    await clusters.table.expectNoRowWithText(uniqueName);
  });
});
```

## Helper API Reference

### ResourcePage

| Method | Description |
|---|---|
| `goToList()` | Navigate to the list page, wait for table loaded |
| `goToCreate()` | Navigate to the create page, wait for form visible |
| `goToEdit(id)` | Navigate to the edit page, wait for form visible |
| `goToShow(id)` | Navigate to the show page, wait for `[data-testid="show-page"]` |
| `clickCreate()` | Click the "Create" button on the list page |

### FormHelper (accessed via `resource.form`)

| Method | Description |
|---|---|
| `field(name)` | Locator for `[data-testid="field-{name}"]` |
| `fillInput(name, value)` | Clear and fill a text input |
| `fillTextarea(name, value)` | Clear and fill a textarea |
| `selectOption(name, optionText)` | Open a select/combobox and pick an option |
| `toggleCheckbox(name)` | Toggle a checkbox |
| `submit()` | Click `[data-testid="form-submit"]` |
| `cancel()` | Click `[data-testid="form-cancel"]` |

The `name` parameter corresponds to the `data-testid="field-{name}"` attribute, which matches the react-hook-form field path (e.g. `"metadata.name"`, `"spec.type"`).

### TableHelper (accessed via `resource.table`)

| Method | Description |
|---|---|
| `waitForLoaded()` | Wait for table rows to render (loading spinner gone) |
| `expectRowWithText(text)` | Assert a row containing the text is visible |
| `expectNoRowWithText(text)` | Assert no row containing the text is visible |
| `clickRowLink(text)` | Click the first link in a row (typically the name column) |
| `editRow(text)` | Open row actions → click Edit |
| `deleteRow(text)` | Open row actions → click Delete → confirm dialog → wait for row removal (20s timeout for soft-delete) |

## Key Conventions

- **`data-testid` attributes** — The helpers rely on these: `form`, `field-{name}`, `form-submit`, `form-cancel`, `table`, `table-body`, `table-loading`, `row-actions-trigger`, `show-page`. Make sure the UI components have them.
- **`Date.now()` in names** — Use unique names like `` `test-xyz-${Date.now()}` `` to avoid collisions between runs.
- **Single test with steps** — Use `test.step()` instead of separate `test()` calls for sequential CRUD operations. A failed step stops execution immediately; the report shows which step failed.
- **Soft-delete** — All deletes are soft-deletes. `deleteRow()` waits up to 20s for the row to disappear via backend polling.
- **Row action menu retry** — `editRow()` and `deleteRow()` automatically retry if the dropdown menu gets detached due to table re-renders.
- **No manual timeouts** — All timeouts are controlled by `actionTimeout` in `playwright.config.ts` (10s). The only exception is `deleteRow()` which uses 20s for soft-delete polling.
- **API error logging** — The `page` fixture in `base.ts` logs all 4xx/5xx responses with their body to stdout for debugging.
