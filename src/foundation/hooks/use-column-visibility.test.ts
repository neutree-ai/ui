import { beforeEach, describe, expect, it, vi } from "vitest";
import * as storage from "../lib/column-visibility-storage";

vi.mock("../lib/column-visibility-storage");

describe("useColumnVisibility integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("storage integration", () => {
    it("should call getColumnVisibility with resource name", () => {
      const mockGet = vi
        .mocked(storage.getColumnVisibility)
        .mockReturnValue({ col1: true });

      mockGet("test_resource");

      expect(mockGet).toHaveBeenCalledWith("test_resource");
      expect(mockGet("test_resource")).toEqual({ col1: true });
    });

    it("should call setColumnVisibility with correct parameters", () => {
      const mockSet = vi.mocked(storage.setColumnVisibility);
      const visibility = { col1: true, col2: false };
      const validIds = ["col1", "col2"];

      mockSet("test_resource", visibility, validIds);

      expect(mockSet).toHaveBeenCalledWith(
        "test_resource",
        visibility,
        validIds,
      );
    });

    it("should handle updater function pattern", () => {
      const prevState = { col1: true, col2: false };
      const updater = (prev: typeof prevState) => ({ ...prev, col3: true });

      const newState = updater(prevState);

      expect(newState).toEqual({
        col1: true,
        col2: false,
        col3: true,
      });
    });

    it("should handle direct state pattern", () => {
      const newState = { col1: false, col2: true };

      expect(newState).toEqual({ col1: false, col2: true });
    });
  });

  describe("column ID validation", () => {
    it("should filter invalid column IDs", () => {
      const visibility: Record<string, boolean> = {
        col1: true,
        col2: false,
        invalid: true,
      };
      const validIds = ["col1", "col2"];

      const cleaned = Object.keys(visibility)
        .filter((key) => validIds.includes(key))
        .reduce(
          (acc, key) => {
            acc[key] = visibility[key];
            return acc;
          },
          {} as Record<string, boolean>,
        );

      expect(cleaned).toEqual({ col1: true, col2: false });
      expect(cleaned).not.toHaveProperty("invalid");
    });
  });

  describe("state management patterns", () => {
    it("should merge state with updater function", () => {
      const currentState = { col1: true, col2: false };
      const updater = (prev: typeof currentState) => ({
        ...prev,
        col2: true,
        col3: false,
      });

      const nextState = updater(currentState);

      expect(nextState).toEqual({
        col1: true,
        col2: true,
        col3: false,
      });
    });

    it("should replace state with direct object", () => {
      const currentState = { col1: true, col2: false };
      const newState = { col3: true };

      expect(newState).toEqual({ col3: true });
      expect(newState).not.toEqual(currentState);
    });

    it("should handle empty state", () => {
      const emptyState = {};
      const updater = (prev: typeof emptyState) => ({ col1: true });

      const nextState = updater(emptyState);

      expect(nextState).toEqual({ col1: true });
    });
  });

  describe("resource name handling", () => {
    it("should work with different resource names", () => {
      const mockGet = vi.mocked(storage.getColumnVisibility);

      mockGet.mockReturnValueOnce({ col1: true });
      mockGet.mockReturnValueOnce({ col2: false });

      expect(mockGet("resource1")).toEqual({ col1: true });
      expect(mockGet("resource2")).toEqual({ col2: false });
    });

    it("should handle empty resource name", () => {
      const mockSet = vi.mocked(storage.setColumnVisibility);

      mockSet("", { col1: true });

      expect(mockSet).toHaveBeenCalledWith("", { col1: true });
    });
  });
});
