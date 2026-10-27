# Unit Testing Guide

## Running Tests

```bash
yarn test                                      # all tests
yarn test --watch                              # watch mode
yarn test src/foundation/lib/validate.test.ts  # specific file
```

## Principles

A test earns its place by catching a regression that nothing else catches, and keeps it by not
breaking when the code is refactored without changing behavior. Judge every test against four
properties: **protection against regressions**, **resistance to refactoring**, **fast feedback**,
**low maintenance**. A test that fails on a harmless markup change but would pass a real bug is a
net cost — delete it rather than keep it green.

### 1. Test logic, not wiring

**Test these:**

- Pure functions with branching logic, regex, or math
- Hooks that manage state or compute derived values
- Form hooks: validation rules, conditional fields, the submit transform

**Skip these:**

- Type definitions, constants (including class-name constants), re-exports
- Thin wrappers that delegate to a library (e.g. `cn()` wrapping `clsx`)
- Components that are purely layout/composition with no logic
- Anything where the test would just mirror the implementation

> If a test only proves "the code does what the code does", it has no value.

Writing tests is a review process. Assert **correct behavior**, not current behavior. If the
implementation has a bug, fix the implementation.

### 2. One behavior, one layer

Test each rule once, at the **cheapest layer that can observe it**:

| Layer | Cost | Owns |
|-------|------|------|
| `lib/` pure function | ~1 ms | every branch, boundary, and edge case of the rule |
| hook (`renderHook`) | ~10 ms | state transitions and effects |
| component / form hook (`render`) | 100 ms – 1 s | that the rule is **wired**: its result reaches the UI or the payload |
| E2E (`e2e/`) | seconds | a user journey across pages and the real API |

When a component or form hook calls a `lib/` function, its test covers **one or two** cases
proving the result is shown (an error appears, a field disables, a value is submitted). It does not
re-enumerate the cases the `lib/` test already owns. If a form needs many cases to be confident,
the logic is in the wrong place: extract it into `lib/` and test it there.

Testing difficulty: **pure functions < hooks < components**. When a hook or component contains
complex logic, extract it into a `lib/` pure function first.

### 3. Assert what the user sees, not how it is built

- Query by role, label, or text: `getByRole`, `getByLabelText`, `getByText`. Use `getByTestId`
  only when nothing user-visible identifies the element.
- **Never assert class names, inline styles, or DOM structure/order.** Visual layout is verified by
  review and E2E, not by unit tests. When a field is shown/hidden by a class, use `isHidden()`.
- A `getBy*` query throws when nothing matches, so it is already an assertion. Write
  `screen.getByText("…")`, not `expect(screen.getByText("…")).toBeTruthy()`. For absence use
  `expect(screen.queryByText("…")).toBeNull()`.

### 4. Keep the test body readable, share the setup

Test bodies are DAMP: each `it` should read top to bottom without jumping around. Everything else is
DRY:

- **Environment** comes from the global setup file — never re-declare it (see below).
- **Fixtures** come from builder functions with overrides, not copied object literals. A test spells
  out only the fields that matter to it:

  ```ts
  const node = makeNodeResources({ gpu: { available: 0 } });
  ```

  Builders used by one file live at the top of that file. Builders for a type used by several test
  files live in a `testing/` directory of the layer that owns the type (`src/foundation/testing/`,
  `src/domains/<name>/testing/`).
- **Variations of one rule** are a table, not N copies of the same test:

  ```ts
  it.each([
    { count: 0.5, cluster: "ssh", error: false },
    { count: 1.5, cluster: "ssh", error: true },
    { count: 2, cluster: "kubernetes", error: false },
  ])("count $count on $cluster -> error: $error", ({ count, cluster, error }) => { … });
  ```

### 5. Budget

Tests are code the next person maintains. As a rule of thumb, the test lines a change adds should
not exceed the source lines it adds; if they do, check for cross-layer repetition, copied fixtures,
or cases that differ only in data. A bug fix adds **one** regression test at the lowest layer that
reproduces the bug.

## Global Test Environment

`src/foundation/testing/setup.ts` runs before every test file and provides:

| What | Behavior |
|------|----------|
| `@/foundation/lib/i18n`, `react-i18next` | `t(key)` returns the key; interpolation values are appended after a colon: `t("x.count", { count: 3 })` → `"x.count:3"`. A string fallback argument is ignored. |
| `@refinedev/react-hook-form` | `useForm` runs on plain react-hook-form. Control and inspect it through `refineForm` (below). |
| jsdom layout APIs | `ResizeObserver`, `scrollIntoView`, pointer capture — what Radix and cmdk need to open. |
| `@/foundation/hooks/use-is-truncated` | Returns `false` (jsdom has no layout). A test that needs a clipped element: `vi.mocked(useIsTruncated).mockReturnValue(true)`. Reset before each test. |
| Time zone | `TZ=UTC` |

**Do not** re-declare any of these in a test file. Assert on translation keys:

```ts
screen.getByText("endpoints.messages.noMatchingAccelerator");
screen.getByText(/^endpoints\.messages\.cardsAvailable:/); // key with interpolation values
```

Override a global mock only when the test needs different output, by declaring its own `vi.mock` for
that module — it replaces the global one for that file.

## Helpers

All in `src/foundation/testing/`.

| Helper | Use |
|--------|-----|
| `renderForm(useHook, fields)` | Render a form hook's fields inside a `FormProvider`. Returns `result.current` (the hook's latest return value) for `form.setValue`, `form.trigger`, derived state. |
| `refineForm` | State of the Refine `useForm` mock: set `queryData` to simulate the record an edit form loads; read `options` for what the hook passed to Refine (e.g. `refineCoreProps.queryOptions.select`); assert on `onFinish`. Reset before each test. |
| `selectOption(fieldName, option)` | Pick an option from the Radix Select inside `data-testid="field-<fieldName>"`. |
| `fillField(fieldName, value)` | Type into the input inside `data-testid="field-<fieldName>"` and blur it. |
| `openMenu(trigger)` | Open a Radix DropdownMenu or Select. They open on pointer down; a plain `click` leaves them closed and later assertions pass vacuously. |
| `isHidden(element)` | Whether an element is hidden from the user (`hidden` attribute or Tailwind `hidden` class on it or an ancestor). The one sanctioned way to check visibility toggled by a class. |

## Testing Patterns

### Pure functions

Import and assert. See `foundation/lib/clipboard.test.ts`.

### Simple hooks

Use `renderHook` for hooks that don't return JSX. See `foundation/hooks/use-copy-to-clipboard.test.ts`.

### Form hooks (react-hook-form + Refine)

Form hooks return JSX with validation rules, conditional rendering, and derived state. Test them via
`renderForm` and interact through testing-library:

```tsx
import { selectOption } from "@/foundation/testing/interactions";
import { renderForm } from "@/foundation/testing/render-form";

it("clears the workspace when switching to global", async () => {
  const { result } = renderForm(
    () => useRoleAssignmentForm({ action: "create" }),
    (r) => r.specFields,
  );
  selectOption("spec.global", "role_assignments.options.workspace");
  result.current.form.setValue("spec.workspace", "team-a");

  selectOption("spec.global", "role_assignments.options.global");

  await waitFor(() =>
    expect(result.current.form.getValues("spec.workspace")).toBeFalsy(),
  );
});
```

Assert the outcome the test names. A test called "clears the workspace" that only checks the
field is hidden passes even when the value is never cleared.

What a form-hook test covers: each validation rule's message appears, each conditional field
shows/hides on its trigger, create vs. edit differences, and the submit transform. What it does not
cover: the arithmetic behind a derived value (test that in `lib/`), or how the fields are laid out.

**Per-test mock values** — use `vi.mocked()`, not mutable module-level variables:

```ts
vi.mock("@/foundation/hooks/use-license", () => ({
  useLicense: vi.fn(() => ({ supportMultiWorkspace: true })),
}));

import { useLicense } from "@/foundation/hooks/use-license";

// In the test that needs a different value:
vi.mocked(useLicense).mockReturnValue({ supportMultiWorkspace: false });
```

**Mock only what crashes** — components with deep transitive dependencies that aren't relevant to
the test (e.g. `WorkspaceField` pulling in Refine router hooks). Don't mock components you can
render.

See `domains/user/hooks/use-user-form.test.tsx` and
`domains/role-assignment/hooks/use-role-assignment-form.test.tsx` for complete examples.

## File Placement

Co-locate test files with their source:

```
foundation/lib/clipboard.ts
foundation/lib/clipboard.test.ts
domains/user/hooks/use-user-form.tsx
domains/user/hooks/use-user-form.test.tsx
```

## Architecture Alignment

Unit tests follow the same dependency rules as source code (see [architecture.md](architecture.md)):

- **L1 tests** mock only external libraries (Refine, i18n, PostgREST) — no L2/L3 imports
- **L2 tests** may import from L1 or mock it — no cross-domain or L3 imports

## Enforcement

`node tools/check-test-patterns.cjs` runs in CI and pre-commit. It rejects class-name assertions,
`expect(getBy…).toBeTruthy()`, and re-declarations of the global environment. It cannot judge
cross-layer duplication or whether a test proves its name — that is what the checklist is for.

## Checklist Before Finishing

- [ ] Every new test would fail if the behavior it names broke (try it: break the code, watch it
      fail), and would survive a markup refactor.
- [ ] No rule is tested both in `lib/` and again case-by-case through a component or form.
- [ ] No class-name, style, or layout-order assertions; no `expect(getBy…).toBeTruthy()`.
- [ ] Nothing from the global setup is re-declared (i18n, Refine form, jsdom stubs).
- [ ] Fixtures come from builders; repeated variations are an `it.each` table.
- [ ] Added test lines are in proportion to added source lines.
