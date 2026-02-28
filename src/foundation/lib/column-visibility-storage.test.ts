import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ColumnVisibilityManager,
  type IStorage,
  LocalStorageAdapter,
} from "./column-visibility-storage";

class MockStorage implements IStorage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

describe("LocalStorageAdapter", () => {
  let adapter: LocalStorageAdapter;

  beforeEach(() => {
    adapter = new LocalStorageAdapter();
    localStorage.clear();
  });

  it("should get item from localStorage", () => {
    localStorage.setItem("test-key", "test-value");
    expect(adapter.getItem("test-key")).toBe("test-value");
  });

  it("should set item to localStorage", () => {
    adapter.setItem("test-key", "test-value");
    expect(localStorage.getItem("test-key")).toBe("test-value");
  });

  it("should remove item from localStorage", () => {
    localStorage.setItem("test-key", "test-value");
    adapter.removeItem("test-key");
    expect(localStorage.getItem("test-key")).toBeNull();
  });

  it("should handle errors gracefully", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const quota = "x".repeat(10 * 1024 * 1024);
    try {
      adapter.setItem("large-item", quota);
    } catch (e) {
      // Expected to fail
    }

    consoleSpy.mockRestore();
  });
});

describe("ColumnVisibilityManager", () => {
  let storage: MockStorage;
  let manager: ColumnVisibilityManager;

  beforeEach(() => {
    storage = new MockStorage();
    manager = new ColumnVisibilityManager(storage, "test_storage", {
      test_resource: 1,
      another_resource: 2,
    });
  });

  describe("get/set", () => {
    it("should save and retrieve column visibility", () => {
      const visibility = { col1: true, col2: false, col3: true };
      manager.set("test_resource", visibility);

      const retrieved = manager.get("test_resource");
      expect(retrieved).toEqual(visibility);
    });

    it("should return undefined for non-existent resource", () => {
      expect(manager.get("non_existent")).toBeUndefined();
    });

    it("should clean up invalid column IDs", () => {
      const visibility = { col1: true, col2: false, invalid: true };
      const validIds = ["col1", "col2"];

      manager.set("test_resource", visibility, validIds);

      const retrieved = manager.get("test_resource");
      expect(retrieved).toEqual({ col1: true, col2: false });
      expect(retrieved).not.toHaveProperty("invalid");
    });

    it("should store metadata with visibility", () => {
      const visibility = { col1: true };
      manager.set("test_resource", visibility);

      const stored = storage.getItem("test_storage");
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored ?? "");
      expect(parsed.test_resource).toMatchObject({
        version: 1,
        configId: "test_resource_v1",
        visibility: { col1: true },
      });
      expect(parsed.test_resource.lastUpdated).toBeTypeOf("number");
    });
  });

  describe("versioning", () => {
    it("should return undefined for outdated config version", () => {
      manager.set("test_resource", { col1: true });

      const newManager = new ColumnVisibilityManager(storage, "test_storage", {
        test_resource: 2,
      });

      expect(newManager.get("test_resource")).toBeUndefined();
    });

    it("should maintain configs with matching versions", () => {
      manager.set("test_resource", { col1: true });
      manager.set("another_resource", { col2: false });

      expect(manager.get("test_resource")).toEqual({ col1: true });
      expect(manager.get("another_resource")).toEqual({ col2: false });
    });
  });

  describe("cleanup", () => {
    it("should remove configs older than MAX_AGE_DAYS", () => {
      const oldTimestamp = Date.now() - 91 * 24 * 60 * 60 * 1000;

      const stored = {
        test_resource: {
          version: 1,
          configId: "test_resource_v1",
          visibility: { col1: true },
          lastUpdated: oldTimestamp,
        },
        another_resource: {
          version: 1,
          configId: "another_resource_v2",
          visibility: { col2: false },
          lastUpdated: Date.now(),
        },
      };

      storage.setItem("test_storage", JSON.stringify(stored));

      manager.cleanup();

      expect(manager.get("test_resource")).toBeUndefined();
      expect(manager.get("another_resource")).toEqual({ col2: false });
    });

    it("should remove configs with outdated configId", () => {
      const stored = {
        test_resource: {
          version: 1,
          configId: "test_resource_v1",
          visibility: { col1: true },
          lastUpdated: Date.now(),
        },
        another_resource: {
          version: 1,
          configId: "another_resource_v1",
          visibility: { col2: false },
          lastUpdated: Date.now(),
        },
      };

      storage.setItem("test_storage", JSON.stringify(stored));

      manager.cleanup();

      expect(manager.get("test_resource")).toEqual({ col1: true });
      expect(manager.get("another_resource")).toBeUndefined();
    });
  });

  describe("clear", () => {
    it("should clear specific resource", () => {
      manager.set("test_resource", { col1: true });
      manager.set("another_resource", { col2: false });

      manager.clear("test_resource");

      expect(manager.get("test_resource")).toBeUndefined();
      expect(manager.get("another_resource")).toEqual({ col2: false });
    });

    it("should clear all resources", () => {
      manager.set("test_resource", { col1: true });
      manager.set("another_resource", { col2: false });

      manager.clearAll();

      expect(manager.get("test_resource")).toBeUndefined();
      expect(manager.get("another_resource")).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("should handle empty visibility object", () => {
      manager.set("test_resource", {});
      expect(manager.get("test_resource")).toEqual({});
    });

    it("should handle corrupted storage data", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      storage.setItem("test_storage", "invalid json");
      expect(manager.get("test_resource")).toBeUndefined();
      consoleSpy.mockRestore();
    });

    it("should handle missing storage data", () => {
      expect(manager.get("test_resource")).toBeUndefined();
    });
  });
});
