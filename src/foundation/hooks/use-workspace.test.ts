import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ALL_WORKSPACES } from "./use-workspace";

// --- Module mocks ---

let mockParams: Record<string, unknown> = {};
let mockAction = "list";
let mockStorageValue: string | undefined;
const mockSetValue = vi.fn();

const mockWorkspaces = [
  { metadata: { name: "ws-alpha" } },
  { metadata: { name: "ws-beta" } },
];

const mockUseList = vi.fn((_params?: Record<string, unknown>) => ({
  data: { data: mockWorkspaces },
  isLoading: false,
}));

vi.mock("@refinedev/core", () => ({
  useParsed: () => ({ params: mockParams }),
  useResourceParams: () => ({ action: mockAction }),
  // Called lazily: vi.mock factories are hoisted above the declaration above.
  useList: (params?: Record<string, unknown>) => mockUseList(params),
}));

vi.mock("react-use", () => ({
  useLocalStorage: () => [mockStorageValue, mockSetValue],
}));

// --- Helpers ---

async function workspaceHook() {
  const { useWorkspace } = await import("./use-workspace");
  return renderHook(() => useWorkspace());
}

// --- Setup ---

beforeEach(() => {
  vi.clearAllMocks();
  mockParams = {};
  mockAction = "list";
  mockStorageValue = undefined;
});

// --- Tests ---

describe("useWorkspace", () => {
  describe("current workspace resolution", () => {
    it("returns ALL_WORKSPACES when no localStorage and no URL param", async () => {
      const { result } = await workspaceHook();

      expect(result.current.current).toBe(ALL_WORKSPACES);
    });

    it("returns preferred workspace when localStorage matches data", async () => {
      mockStorageValue = "ws-alpha";
      const { result } = await workspaceHook();

      expect(result.current.current).toBe("ws-alpha");
    });

    it("returns ALL_WORKSPACES when localStorage value does not match any workspace", async () => {
      mockStorageValue = "non-existent-ws";
      const { result } = await workspaceHook();

      expect(result.current.current).toBe(ALL_WORKSPACES);
    });

    it("returns URL param workspace when it matches data", async () => {
      mockParams = { workspace: "ws-beta" };
      const { result } = await workspaceHook();

      expect(result.current.current).toBe("ws-beta");
    });

    it("falls back to raw URL param when it does not match data", async () => {
      mockParams = { workspace: "unknown-ws" };
      const { result } = await workspaceHook();

      expect(result.current.current).toBe("unknown-ws");
    });

    it("prefers URL param over localStorage", async () => {
      mockStorageValue = "ws-alpha";
      mockParams = { workspace: "ws-beta" };
      const { result } = await workspaceHook();

      expect(result.current.current).toBe("ws-beta");
    });
  });

  describe("localStorage sync", () => {
    it("syncs URL workspace to localStorage on list page", async () => {
      mockAction = "list";
      mockParams = { workspace: "ws-alpha" };
      await workspaceHook();

      expect(mockSetValue).toHaveBeenCalledWith("ws-alpha");
    });

    it("does not sync on non-list pages", async () => {
      mockAction = "edit";
      mockParams = { workspace: "ws-alpha" };
      await workspaceHook();

      expect(mockSetValue).not.toHaveBeenCalled();
    });

    it("does not sync when URL workspace matches stored value", async () => {
      mockAction = "list";
      mockParams = { workspace: "ws-alpha" };
      mockStorageValue = "ws-alpha";
      await workspaceHook();

      expect(mockSetValue).not.toHaveBeenCalled();
    });

    it("does not sync when URL has no workspace param", async () => {
      mockAction = "list";
      mockParams = {};
      await workspaceHook();

      expect(mockSetValue).not.toHaveBeenCalled();
    });
  });

  describe("returned data", () => {
    it("reports the loading state", async () => {
      const { result } = await workspaceHook();

      expect(result.current.isLoading).toBe(false);
    });
  });
});

describe("useWorkspaceOptions", () => {
  it("queries a page big enough to cover a real deployment", async () => {
    const { useWorkspaceOptions } = await import("./use-workspace");
    const { result } = renderHook(() => useWorkspaceOptions());

    expect(mockUseList).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: "workspaces",
        pagination: { pageSize: 100 },
      }),
    );
    expect(result.current.workspaces).toEqual(mockWorkspaces);
  });

  it("sends the search to the server rather than filtering locally", async () => {
    // The reported bug: the target workspace sat past the first page, so a
    // client-side filter over what was already loaded could never find it.
    const { useWorkspaceOptions } = await import("./use-workspace");
    renderHook(() => useWorkspaceOptions("132455"));

    expect(mockUseList).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: [
          {
            field: "metadata->>name",
            operator: "contains",
            value: "132455",
          },
        ],
      }),
    );
  });

  it("sends no filter when nothing has been typed", async () => {
    const { useWorkspaceOptions } = await import("./use-workspace");
    renderHook(() => useWorkspaceOptions(""));

    expect(mockUseList).toHaveBeenCalledWith(
      expect.objectContaining({ filters: [] }),
    );
  });
});

describe("useWorkspaceSearch", () => {
  it("queries once the typing pauses, not once per keystroke", async () => {
    vi.useFakeTimers();
    const { useWorkspaceSearch } = await import("./use-workspace");
    const { result } = renderHook(() => useWorkspaceSearch());

    const filteredCalls = () =>
      mockUseList.mock.calls.filter(
        ([params]) => ((params?.filters as unknown[]) ?? []).length > 0,
      );

    act(() => {
      result.current.onSearchChange("1");
      result.current.onSearchChange("13");
      result.current.onSearchChange("132455");
    });
    expect(filteredCalls()).toHaveLength(0);

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(filteredCalls()).not.toHaveLength(0);
    expect(filteredCalls().at(-1)?.[0]).toMatchObject({
      filters: [
        { field: "metadata->>name", operator: "contains", value: "132455" },
      ],
    });
    vi.useRealTimers();
  });

  it("exposes options shaped for the combobox", async () => {
    const { useWorkspaceSearch } = await import("./use-workspace");
    const { result } = renderHook(() => useWorkspaceSearch());

    expect(result.current.options).toEqual([
      { label: "ws-alpha", value: "ws-alpha" },
      { label: "ws-beta", value: "ws-beta" },
    ]);
  });
});

describe("isValidWorkspace", () => {
  it("returns true for a real workspace name", async () => {
    const { isValidWorkspace } = await import("./use-workspace");
    expect(isValidWorkspace("ws-alpha")).toBe(true);
  });

  it("returns false for ALL_WORKSPACES sentinel", async () => {
    const { isValidWorkspace } = await import("./use-workspace");
    expect(isValidWorkspace(ALL_WORKSPACES)).toBe(false);
  });

  it("returns false for empty string", async () => {
    const { isValidWorkspace } = await import("./use-workspace");
    expect(isValidWorkspace("")).toBe(false);
  });

  it("returns false for undefined", async () => {
    const { isValidWorkspace } = await import("./use-workspace");
    expect(isValidWorkspace(undefined)).toBe(false);
  });

  it("returns false for null", async () => {
    const { isValidWorkspace } = await import("./use-workspace");
    expect(isValidWorkspace(null)).toBe(false);
  });
});
