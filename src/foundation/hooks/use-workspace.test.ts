import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ALL_WORKSPACES } from "./use-workspace";

// --- Module mocks ---

let mockParams: Record<string, unknown> = {};
let mockAction = "list";
let mockStorageValue: string | undefined = undefined;
const mockSetValue = vi.fn();

const mockWorkspaces = [
  { metadata: { name: "ws-alpha" } },
  { metadata: { name: "ws-beta" } },
];

vi.mock("@refinedev/core", () => ({
  useParsed: () => ({ params: mockParams }),
  useResourceParams: () => ({ action: mockAction }),
  useList: () => ({
    data: { data: mockWorkspaces },
    isLoading: false,
  }),
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
    it("returns workspace list and loading state", async () => {
      const { result } = await workspaceHook();

      expect(result.current.data).toEqual(mockWorkspaces);
      expect(result.current.isLoading).toBe(false);
    });
  });
});
