import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  type PermissionDependencyRule,
  usePermissionDependencies,
} from "./use-permission-dependencies";

const TEST_PERMISSIONS = [
  "endpoint:read",
  "endpoint:create",
  "endpoint:update",
  "endpoint:delete",
  "model:read",
  "model:push",
  "model:pull",
  "model:delete",
  "model_registry:read",
  "workspace:read",
  "workspace:create",
  "workspace:update",
  "workspace:delete",
];

describe("usePermissionDependencies", () => {
  it("should auto-select read when create is toggled on", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      usePermissionDependencies({
        value: [],
        allPermissions: TEST_PERMISSIONS,
        onChange,
      }),
    );

    act(() => {
      result.current.togglePermission("endpoint", "create");
    });

    const called = onChange.mock.calls[0][0] as string[];
    expect(called).toContain("endpoint:read");
    expect(called).toContain("endpoint:create");
  });

  it("should auto-select read when update is toggled on", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      usePermissionDependencies({
        value: [],
        allPermissions: TEST_PERMISSIONS,
        onChange,
      }),
    );

    act(() => {
      result.current.togglePermission("endpoint", "update");
    });

    const called = onChange.mock.calls[0][0] as string[];
    expect(called).toContain("endpoint:read");
    expect(called).toContain("endpoint:update");
  });

  it("should not duplicate read if already selected when toggling create", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      usePermissionDependencies({
        value: ["endpoint:read"],
        allPermissions: TEST_PERMISSIONS,
        onChange,
      }),
    );

    act(() => {
      result.current.togglePermission("endpoint", "create");
    });

    const called = onChange.mock.calls[0][0] as string[];
    const readCount = called.filter((p) => p === "endpoint:read").length;
    expect(readCount).toBe(1);
    expect(called).toContain("endpoint:create");
  });

  it("should prevent unchecking read when create is still selected", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      usePermissionDependencies({
        value: ["endpoint:read", "endpoint:create"],
        allPermissions: TEST_PERMISSIONS,
        onChange,
      }),
    );

    act(() => {
      result.current.togglePermission("endpoint", "read");
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("should prevent unchecking read when update is still selected", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      usePermissionDependencies({
        value: ["endpoint:read", "endpoint:update"],
        allPermissions: TEST_PERMISSIONS,
        onChange,
      }),
    );

    act(() => {
      result.current.togglePermission("endpoint", "read");
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("should allow unchecking read when no dependents are selected", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      usePermissionDependencies({
        value: ["endpoint:read"],
        allPermissions: TEST_PERMISSIONS,
        onChange,
      }),
    );

    act(() => {
      result.current.togglePermission("endpoint", "read");
    });

    const called = onChange.mock.calls[0][0] as string[];
    expect(called).not.toContain("endpoint:read");
  });

  it("should allow unchecking read after all dependents are removed", () => {
    const onChange = vi.fn();
    const { rerender, result } = renderHook(
      ({ value }: { value: string[] }) =>
        usePermissionDependencies({
          value,
          allPermissions: TEST_PERMISSIONS,
          onChange,
        }),
      { initialProps: { value: ["endpoint:read", "endpoint:create"] } },
    );

    // First uncheck create
    act(() => {
      result.current.togglePermission("endpoint", "create");
    });

    const afterUncheckedCreate = onChange.mock.calls[0][0] as string[];
    expect(afterUncheckedCreate).toContain("endpoint:read");
    expect(afterUncheckedCreate).not.toContain("endpoint:create");

    // Re-render with the updated value
    onChange.mockClear();
    rerender({ value: afterUncheckedCreate });

    // Now unchecking read should work
    act(() => {
      result.current.togglePermission("endpoint", "read");
    });

    const afterUncheckedRead = onChange.mock.calls[0][0] as string[];
    expect(afterUncheckedRead).not.toContain("endpoint:read");
  });

  it("should auto-select read for push and pull actions on model", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      usePermissionDependencies({
        value: [],
        allPermissions: TEST_PERMISSIONS,
        onChange,
      }),
    );

    act(() => {
      result.current.togglePermission("model", "push");
    });

    const called = onChange.mock.calls[0][0] as string[];
    expect(called).toContain("model_registry:read");
    expect(called).toContain("model:push");
  });

  describe("toggleAllResourcePermissions", () => {
    it("should select all actions for a resource", () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        usePermissionDependencies({
          value: [],
          allPermissions: TEST_PERMISSIONS,
          onChange,
        }),
      );

      act(() => {
        result.current.toggleAllResourcePermissions("endpoint", true);
      });

      const called = onChange.mock.calls[0][0] as string[];
      expect(called).toContain("endpoint:read");
      expect(called).toContain("endpoint:create");
      expect(called).toContain("endpoint:update");
      expect(called).toContain("endpoint:delete");
    });

    it("should deselect all actions for a resource", () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        usePermissionDependencies({
          value: [
            "endpoint:read",
            "endpoint:create",
            "endpoint:update",
            "endpoint:delete",
          ],
          allPermissions: TEST_PERMISSIONS,
          onChange,
        }),
      );

      act(() => {
        result.current.toggleAllResourcePermissions("endpoint", false);
      });

      const called = onChange.mock.calls[0][0] as string[];
      const endpointPermissions = called.filter((p) =>
        p.startsWith("endpoint:"),
      );
      expect(endpointPermissions).toHaveLength(0);
    });
  });

  describe("getActionDependents", () => {
    it("should return dependents when read is depended on by create", () => {
      const { result } = renderHook(() =>
        usePermissionDependencies({
          value: ["endpoint:read", "endpoint:create"],
          allPermissions: TEST_PERMISSIONS,
        }),
      );

      expect(result.current.getActionDependents("endpoint", "read")).toEqual([
        "endpoint:create",
      ]);
    });

    it("should return empty array when read has no dependents selected", () => {
      const { result } = renderHook(() =>
        usePermissionDependencies({
          value: ["endpoint:read"],
          allPermissions: TEST_PERMISSIONS,
        }),
      );

      expect(result.current.getActionDependents("endpoint", "read")).toEqual(
        [],
      );
    });

    it("should return empty array for actions that are not dependencies", () => {
      const { result } = renderHook(() =>
        usePermissionDependencies({
          value: ["endpoint:read", "endpoint:create"],
          allPermissions: TEST_PERMISSIONS,
        }),
      );

      expect(result.current.getActionDependents("endpoint", "create")).toEqual(
        [],
      );
    });

    it("should return all dependents when read is depended on by multiple actions", () => {
      const { result } = renderHook(() =>
        usePermissionDependencies({
          value: ["endpoint:read", "endpoint:create", "endpoint:update"],
          allPermissions: TEST_PERMISSIONS,
        }),
      );

      const dependents = result.current.getActionDependents("endpoint", "read");
      expect(dependents).toContain("endpoint:create");
      expect(dependents).toContain("endpoint:update");
      expect(dependents).toHaveLength(2);
    });
  });

  describe("custom rules", () => {
    it("should respect custom dependency rules", () => {
      const customRules: PermissionDependencyRule[] = [
        { action: "delete", deps: ["read", "update"] },
      ];
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        usePermissionDependencies({
          value: [],
          allPermissions: TEST_PERMISSIONS,
          rules: customRules,
          onChange,
        }),
      );

      act(() => {
        result.current.togglePermission("endpoint", "delete");
      });

      const called = onChange.mock.calls[0][0] as string[];
      expect(called).toContain("endpoint:read");
      expect(called).toContain("endpoint:update");
      expect(called).toContain("endpoint:delete");
    });

    it("should report dependents based on custom rules", () => {
      const customRules: PermissionDependencyRule[] = [
        { action: "delete", deps: ["read", "update"] },
      ];
      const { result } = renderHook(() =>
        usePermissionDependencies({
          value: ["endpoint:read", "endpoint:update", "endpoint:delete"],
          allPermissions: TEST_PERMISSIONS,
          rules: customRules,
        }),
      );

      expect(result.current.getActionDependents("endpoint", "read")).toEqual([
        "endpoint:delete",
      ]);
      expect(result.current.getActionDependents("endpoint", "update")).toEqual([
        "endpoint:delete",
      ]);
      expect(result.current.getActionDependents("endpoint", "delete")).toEqual(
        [],
      );
    });
  });

  describe("cross-resource dependencies", () => {
    const crossRules: PermissionDependencyRule[] = [
      { action: "endpoint:create", deps: ["workspace:read"] },
      { action: "create", deps: ["read"] },
    ];

    it("should auto-select cross-resource dep when toggling on", () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        usePermissionDependencies({
          value: [],
          allPermissions: TEST_PERMISSIONS,
          rules: crossRules,
          onChange,
        }),
      );

      act(() => {
        result.current.togglePermission("endpoint", "create");
      });

      const called = onChange.mock.calls[0][0] as string[];
      expect(called).toContain("endpoint:create");
      expect(called).toContain("endpoint:read"); // same-resource dep from generic rule
      expect(called).toContain("workspace:read"); // cross-resource dep
    });

    it("should prevent unchecking cross-resource dep when dependent is selected", () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        usePermissionDependencies({
          value: ["workspace:read", "endpoint:read", "endpoint:create"],
          allPermissions: TEST_PERMISSIONS,
          rules: crossRules,
          onChange,
        }),
      );

      act(() => {
        result.current.togglePermission("workspace", "read");
      });

      expect(onChange).not.toHaveBeenCalled();
    });

    it("should allow unchecking cross-resource dep after dependent is removed", () => {
      const onChange = vi.fn();
      const { rerender, result } = renderHook(
        ({ value }: { value: string[] }) =>
          usePermissionDependencies({
            value,
            allPermissions: TEST_PERMISSIONS,
            rules: crossRules,
            onChange,
          }),
        {
          initialProps: {
            value: ["workspace:read", "endpoint:read", "endpoint:create"],
          },
        },
      );

      // Uncheck endpoint:create first
      act(() => {
        result.current.togglePermission("endpoint", "create");
      });

      const afterRemove = onChange.mock.calls[0][0] as string[];
      expect(afterRemove).not.toContain("endpoint:create");

      onChange.mockClear();
      rerender({ value: afterRemove });

      // Now workspace:read should be unlockable
      act(() => {
        result.current.togglePermission("workspace", "read");
      });

      const afterUnlock = onChange.mock.calls[0][0] as string[];
      expect(afterUnlock).not.toContain("workspace:read");
    });

    it("should report cross-resource dependents", () => {
      const { result } = renderHook(() =>
        usePermissionDependencies({
          value: ["workspace:read", "endpoint:read", "endpoint:create"],
          allPermissions: TEST_PERMISSIONS,
          rules: crossRules,
        }),
      );

      const dependents = result.current.getActionDependents(
        "workspace",
        "read",
      );
      expect(dependents).toEqual(["endpoint:create"]);
    });

    it("should keep cross-resource locked actions on deselect all", () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        usePermissionDependencies({
          value: [
            "workspace:read",
            "workspace:create",
            "endpoint:read",
            "endpoint:create",
          ],
          allPermissions: TEST_PERMISSIONS,
          rules: crossRules,
          onChange,
        }),
      );

      // Deselect all workspace actions
      act(() => {
        result.current.toggleAllResourcePermissions("workspace", false);
      });

      const called = onChange.mock.calls[0][0] as string[];
      // workspace:read should be kept because endpoint:create depends on it
      expect(called).toContain("workspace:read");
      // workspace:create should be removed (only has same-resource dep on workspace:read)
      expect(called).not.toContain("workspace:create");
    });

    it("should not affect non-targeted resources with resource-specific rule", () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        usePermissionDependencies({
          value: [],
          allPermissions: TEST_PERMISSIONS,
          rules: crossRules,
          onChange,
        }),
      );

      // workspace:create triggers generic create→read (workspace:read),
      // but should NOT trigger any endpoint-specific deps
      act(() => {
        result.current.togglePermission("workspace", "create");
      });

      const called = onChange.mock.calls[0][0] as string[];
      expect(called).toContain("workspace:read"); // same-resource dep
      expect(called).toContain("workspace:create");
      // should NOT add any endpoint permissions (rule is endpoint-specific)
      expect(called.filter((p) => p.startsWith("endpoint:"))).toHaveLength(0);
      expect(called).toHaveLength(2);
    });

    it("should resolve cross-resource deps on select all", () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        usePermissionDependencies({
          value: [],
          allPermissions: TEST_PERMISSIONS,
          rules: crossRules,
          onChange,
        }),
      );

      act(() => {
        result.current.toggleAllResourcePermissions("endpoint", true);
      });

      const called = onChange.mock.calls[0][0] as string[];
      expect(called).toContain("endpoint:read");
      expect(called).toContain("endpoint:create");
      expect(called).toContain("endpoint:update");
      expect(called).toContain("endpoint:delete");
      // cross-resource dep: endpoint:create → workspace:read
      expect(called).toContain("workspace:read");
    });
  });

  describe("permissionTree and sortedResources", () => {
    it("should parse permissions into tree structure", () => {
      const { result } = renderHook(() =>
        usePermissionDependencies({
          value: ["endpoint:read", "model:push"],
          allPermissions: TEST_PERMISSIONS,
        }),
      );

      expect(result.current.permissionTree.endpoint.selectedActions).toEqual([
        "read",
      ]);
      expect(result.current.permissionTree.model.selectedActions).toEqual([
        "push",
      ]);
    });

    it("should return sorted resource names", () => {
      const { result } = renderHook(() =>
        usePermissionDependencies({
          value: [],
          allPermissions: TEST_PERMISSIONS,
        }),
      );

      expect(result.current.sortedResources).toEqual([
        "endpoint",
        "model",
        "model_registry",
        "workspace",
      ]);
    });
  });
});
