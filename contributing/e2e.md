# E2E Testing Guide

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
│   ├── resource-page.ts       # Page object: navigation, show page actions
│   ├── table-helper.ts        # Table operations: CRUD, sort, column toggle, etc.
│   ├── form-helper.ts         # Form operations: fillInput, selectOption, submit, etc.
│   └── yaml-import.ts         # YamlImportHelper for seeding test data via API
└── tests/
    └── *.spec.ts              # Test specs
```

## Test Organization

Each `test()` is tagged with one or more TestRail case IDs. Group tests by section using `test.describe()`:

```ts
import { test, expect } from "../fixtures/base";

test.describe("roles list", () => {
  test("list page shows expected columns", {
    tag: "@C2611652",
  }, async ({ roles }) => {
    await roles.goToList();
    await roles.table.waitForLoaded();
    const headers = roles.table.root.locator("thead th");
    await expect(headers.filter({ hasText: /name/i })).toBeVisible();
  });
});
```

- **Tag format**: `tag: "@C{case_id}"`
- **Multiple tags**: `tag: ["@C2611697", "@C2611664"]`
- **Describe groups**: list / detail / create / edit / delete

### Test data isolation

Each test that creates data must clean up after itself. Use `{ noWait: true }` for cleanup to avoid waiting for the delete to complete:

```ts
test("admin user can create a role with permissions", {
  tag: "@C2611697",
}, async ({ roles }) => {
  const uniqueName = `test-role-${Date.now()}`;

  await createRole(roles, uniqueName, ["Workspaces:Read"]);
  await roles.goToList();
  await roles.table.expectRowWithText(uniqueName);

  // Cleanup — noWait since we don't need to verify deletion
  await roles.table.deleteRow(uniqueName, { noWait: true });
});
```

For tests that actually verify delete behavior, omit `noWait` to wait for row removal:

```ts
test("can delete role from list", {
  tag: "@C2611721",
}, async ({ roles }) => {
  const uniqueName = `test-role-${Date.now()}`;
  await createRole(roles, uniqueName, ["Workspaces:Read"]);
  await roles.goToList();

  await roles.table.deleteRow(uniqueName);
  await roles.table.expectNoRowWithText(uniqueName);
});
```

Use `` `test-xxx-${Date.now()}` `` for unique names.

## Adding Tests for a New Resource

### Step 1: Register a fixture (`e2e/fixtures/base.ts`)

```ts
clusters: async ({ page }, use) => {
  await use(
    new ResourcePage(page, {
      routeName: "clusters",
      workspaced: true,        // set true if the route is under a workspace
      workspace: "default",    // defaults to "default"
    }),
  );
},
```

### Step 2: Write the spec (`e2e/tests/<resource>.spec.ts`)

See [Test Organization](#test-organization) above.

## Helper API

### ResourcePage

| Method | Description |
|---|---|
| `goToList()` | Navigate to list page, wait for table loaded |
| `goToCreate()` | Navigate to create page, wait for form visible |
| `goToEdit(id)` | Navigate to edit page, wait for form visible |
| `goToShow(id)` | Navigate to show page, wait for `show-page` visible |
| `clickCreate()` | Click the Create button on the list page |
| `showPageEdit()` | Show page → open actions menu → click Edit |
| `showPageDelete(name)` | Show page → open actions menu → click Delete → confirm → wait for row removal |

### TableHelper (`resource.table`)

| Method | Description |
|---|---|
| `waitForLoaded()` | Wait for table data to finish loading |
| `rows()` | Locator for all data rows |
| `rowWithText(text)` | Locator for a row containing the text |
| `expectRowWithText(text)` | Assert a row with the text exists |
| `expectNoRowWithText(text, options?)` | Assert no row with the text exists |
| `clickRowLink(text)` | Click the first link in a row |
| `editRow(text)` | Row actions → Edit |
| `deleteRow(text, options?)` | Row actions → Delete → confirm → wait for row removal. Pass `{ noWait: true }` to skip waiting (for cleanup-only scenarios) |
| `hasRowActions(text)` | Whether the row has an actions button (returns boolean) |
| `headerCell(text)` | Locator for a column header (string or RegExp) |
| `sort(columnText)` | Click sort trigger, verify sorting is active |
| `toggleColumn(columnName)` | Toggle column visibility via Columns dropdown |

### FormHelper (`resource.form`)

| Method | Description |
|---|---|
| `field(name)` | Locator for `[data-testid="field-{name}"]` |
| `fillInput(name, value)` | Clear and type into a text input |
| `fillTextarea(name, value)` | Clear and type into a textarea |
| `selectOption(name, optionText)` | Open a Radix Select and pick an option |
| `selectComboboxOption(name, optionText)` | Open a cmdk Combobox and pick an option (popover-safe) |
| `toggleCheckbox(name)` | Toggle a checkbox |
| `submit()` | Click the submit button |
| `cancel()` | Click the cancel button |

The `name` parameter matches the react-hook-form field path (e.g. `"metadata.name"`, `"spec.type"`).

## `data-testid` Reference

| Attribute | Location |
|---|---|
| `form` | Form wrapper |
| `field-{name}` | Form field container |
| `form-submit` | Submit button |
| `form-cancel` | Cancel button |
| `table` | Table wrapper |
| `table-body` | Table body |
| `table-loading` | Loading row |
| `table-empty` | Empty state row |
| `row-actions-trigger` | Row action menu button |
| `show-page` | Show page container |
| `show-actions-trigger` | Show page action menu button |
| `sort-trigger` | Column header sort button (also exposes `data-sort-direction`) |

When adding new testable UI elements, prefer `data-testid` over CSS class selectors.

## Locator Strategy

- **Structural elements** → `data-testid` (pages, forms, triggers)
- **Semantic elements** → `getByRole()` (links, menu items, dialogs)
- **Text matching** → `getByText("admin", { exact: true })` to avoid partial match ambiguity

## Notes

- **Delete cleanup optimization**: `deleteRow()` waits up to 30s for the row to disappear by default. For cleanup-only scenarios (not testing delete), use `deleteRow(name, { noWait: true })` to skip waiting — this saves 10-20s per call. Only tests that verify delete behavior should wait for row removal.
- **Cancel navigation**: The cancel button uses `history.back()`. Always navigate to the list page before clicking Create, so that cancel returns to a valid page.
- **API error logging**: The `page` fixture in `base.ts` logs all 4xx/5xx responses to stdout.

## Pitfalls

### `selectOption` vs `selectComboboxOption`

Use **`selectOption`** for Radix `<Select>` fields — options render inside a simple dropdown.

Use **`selectComboboxOption`** for cmdk `<Combobox>` fields — the component uses a Radix Popover + cmdk Command internally. Radix Popover keeps closed popover content mounted in the DOM (with `data-state="closed"`). If two comboboxes on the same form share option names (e.g., user "admin" and role "admin"), `selectOption` will hit a strict mode violation because `getByRole("option")` matches options from both popovers. `selectComboboxOption` scopes the click to `[data-state="open"][role="dialog"]` to target only the active popover.

### Radix Select disabled check

Radix Select renders both a `<button role="combobox">` trigger and a hidden `<select>` element. Using `getByRole("combobox")` may match both and cause a strict mode violation. To check if a Select is disabled, use the CSS selector instead:

```ts
await expect(
  scopeField.locator('button[role="combobox"]'),
).toBeDisabled();
```

### Test data naming

Avoid keywords like "create", "edit", "delete" in test data names (e.g., `test-wp-create-...`). These can collide with UI button text in selectors like `getByRole("link", { name: /create/i })`. Use neutral prefixes: `test-wp-new-`, `test-wp-del-`, etc.
