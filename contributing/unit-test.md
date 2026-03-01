# Unit Testing Guide

## Running Tests

```bash
yarn test                                    # all tests
yarn test --watch                            # watch mode
yarn test src/foundation/lib/validate.test.ts  # specific file
```

## What to Test

Test **logic**, not wiring. A good unit test covers code that can break in non-obvious ways.

**Test these:**

- Pure functions with branching logic, regex, or math
- Hooks that manage state or compute derived values
- Form hooks with validation rules, conditional fields, or derived state

**Skip these:**

- Type definitions, constants, re-exports
- Thin wrappers that delegate to a library (e.g. `cn()` wrapping `clsx`)
- Components that are purely layout/composition with no logic
- Anything where the test would just mirror the implementation

> If a test only proves "the code does what the code does", it has no value.

Writing tests is a review process. Assert **correct behavior**, not current behavior. If the implementation has a bug, fix the implementation.

Testing difficulty: **pure functions < hooks < components**. When a hook or component contains complex logic, extract it into a `lib/` pure function first.

## File Placement

Co-locate test files with their source:

```
foundation/lib/clipboard.ts
foundation/lib/clipboard.test.ts
domains/user/hooks/use-user-form.tsx
domains/user/hooks/use-user-form.test.tsx
```

## Testing Patterns

### Pure functions

Straightforward — import and assert. See `foundation/lib/clipboard.test.ts` for an example.

### Simple hooks

Use `renderHook` for hooks that don't return JSX. See `foundation/hooks/use-copy-to-clipboard.test.ts`.

### Form hooks (react-hook-form + Refine)

Form hooks return JSX with validation rules, conditional rendering, and derived state. Test them via **render**, not `renderHook`.

**Key pattern:** Wrap the hook in a thin component with `FormProvider`, then interact via testing-library.

```tsx
function CreateForm() {
  const { form, specFields } = useMyForm({ action: "create" });
  return (
    <FormProvider {...form}>
      <form>{specFields}</form>
    </FormProvider>
  );
}
```

**Bridging Refine's `useForm` to real react-hook-form:**

```ts
vi.mock("@refinedev/react-hook-form", async () => {
  const rhf = await vi.importActual<typeof import("react-hook-form")>("react-hook-form");
  return {
    useForm: (opts: Record<string, unknown>) => {
      const { refineCoreProps, warnWhenUnsavedChanges, ...rhfOpts } = opts;
      return rhf.useForm(rhfOpts);
    },
  };
});
```

**Radix Select works in jsdom** — click trigger, then click option:

```ts
function selectOption(fieldTestId: string, optionLabel: string) {
  const field = screen.getByTestId(fieldTestId);
  const trigger = field.querySelector('button[role="combobox"]');
  if (!trigger) throw new Error("select trigger not found");
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("option", { name: optionLabel }));
}
```

**Per-test mock values** — use `vi.mocked()`, not mutable module-level variables:

```ts
vi.mock("@/foundation/hooks/use-license", () => ({
  useLicense: vi.fn(() => ({ supportMultiWorkspace: true })),
}));

import { useLicense } from "@/foundation/hooks/use-license";

// In the test that needs a different value:
vi.mocked(useLicense).mockReturnValue({ supportMultiWorkspace: false });
```

**Mock only what crashes** — components with deep transitive dependencies that aren't relevant to the test (e.g. `WorkspaceField` pulling in Refine router hooks). Don't mock components you can render.

See `domains/user/hooks/use-user-form.test.tsx` and `domains/role-assignment/hooks/use-role-assignment-form.test.tsx` for complete examples.

## Architecture Alignment

Unit tests follow the same dependency rules as source code (see [architecture.md](architecture.md)):

- **L1 tests** mock only external libraries (Refine, i18n, PostgREST) — no L2/L3 imports
- **L2 tests** may import from L1 or mock it — no cross-domain or L3 imports
