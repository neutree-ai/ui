import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Module mocks ---

let mockRouterType = "new";
let mockAction: string | undefined = "edit";
const mockBack = vi.fn();
const mockGoBack = vi.fn();

vi.mock("@refinedev/core", () => ({
  useRouterType: () => mockRouterType,
  useBack: () => mockBack,
  useNavigation: () => ({ goBack: mockGoBack }),
  useResource: () => ({ action: mockAction }),
}));

// --- Helpers ---

async function onBackHook() {
  const { useOnBack } = await import("./use-on-back");
  return renderHook(() => useOnBack());
}

// --- Setup ---

beforeEach(() => {
  vi.clearAllMocks();
  mockRouterType = "new";
  mockAction = "edit";
});

// --- Tests ---

describe("useOnBack", () => {
  it("returns back function on non-list pages (new router)", async () => {
    mockAction = "edit";
    const { result } = await onBackHook();

    expect(result.current).toBe(mockBack);
  });

  it("returns back function on show page", async () => {
    mockAction = "show";
    const { result } = await onBackHook();

    expect(result.current).toBe(mockBack);
  });

  it("returns back function on create page", async () => {
    mockAction = "create";
    const { result } = await onBackHook();

    expect(result.current).toBe(mockBack);
  });

  it("returns undefined on list page", async () => {
    mockAction = "list";
    const { result } = await onBackHook();

    expect(result.current).toBeUndefined();
  });

  it("returns undefined when action is undefined", async () => {
    mockAction = undefined;
    const { result } = await onBackHook();

    expect(result.current).toBeUndefined();
  });

  it("returns goBack on legacy router for non-list pages", async () => {
    mockRouterType = "legacy";
    mockAction = "edit";
    const { result } = await onBackHook();

    expect(result.current).toBe(mockGoBack);
  });
});
