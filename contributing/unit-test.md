# Unit Testing Guide

## Running Tests

```bash
# Run all unit tests
yarn test

# Run tests in watch mode
yarn test --watch

# Run a specific test file
yarn test src/foundation/lib/validate.test.ts
```

## What to Test

Test **logic**, not wiring. A good unit test covers code that can break in non-obvious ways.

**Test these:**

- Pure functions with branching logic, regex, or math
- Hooks that manage state or compute derived values
- Non-trivial data transformations

**Skip these:**

- Type definitions, constants, re-exports
- Thin wrappers that delegate to a library (e.g. `cn()` wrapping `clsx`)
- Components that are mostly layout/composition — E2E covers those
- Anything where the test would just mirror the implementation

> If a test only proves "the code does what the code does", it has no value.

Writing tests is a review process. Assert **correct behavior**, not current behavior. If the implementation has a bug, fix the implementation — don't write a test that accommodates it.

Testing difficulty: **pure functions < hooks < components**. Focus coverage on functions and hooks. When a hook or component contains complex logic, extract it into a `lib/` pure function — easier to test, easier to reuse.

## File Placement

Co-locate test files with their source:

```
foundation/lib/validate.ts
foundation/lib/validate.test.ts
```

## Testing Patterns

### Pure functions

```ts
import { describe, expect, it } from "vitest";
import { isValidIPAddress } from "./validate";

describe("isValidIPAddress", () => {
  it("accepts valid IPv4", () => {
    expect(isValidIPAddress("192.168.1.1")).toBe(true);
  });

  it("rejects out-of-range octets", () => {
    expect(isValidIPAddress("256.1.1.1")).toBe(false);
  });
});
```

### Hooks

Use `renderHook` from `@testing-library/react`. Mock external dependencies with `vi.mock()`.

```ts
import { expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

const { result } = renderHook(() => useMyHook({ initial: 0 }));

act(() => {
  result.current.increment();
});

expect(result.current.count).toBe(1);
```

### Mocking

```ts
import { vi } from "vitest";

// Mock a module
vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Mock localStorage
const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, val: string) => { store[key] = val; },
  removeItem: (key: string) => { delete store[key]; },
});
```

## Architecture Alignment

Unit tests follow the same dependency rules as source code (see [architecture.md](architecture.md)):

- **L1 tests** mock only external libraries (Refine, i18n, PostgREST) — no L2/L3 imports
- **L2 tests** may import from L1 or mock it — no cross-domain or L3 imports

This keeps tests isolated along the same boundaries the architecture enforces.
