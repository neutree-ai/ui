import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  type PermissionDependencyRule,
  usePermissionDependencies,
  WORKSPACED_RESOURCES,
} from "./use-permission-dependencies";

const TEST_PERMISSIONS = [
  "endpoint:read",
  "endpoint:create",
  "endpoint:update",
  "endpoint:delete",
  "cluster:read",
  "cluster:create",
  "cluster:update",
  "cluster:delete",
  "external_endpoint:read",
  "external_endpoint:create",
  "external_endpoint:update",
  "external_endpoint:delete",
  "image_registry:read",
  "image_registry:create",
  "image_registry:update",
  "image_registry:delete",
  "model_registry:read",
  "model_registry:create",
  "model_registry:update",
  "model_registry:delete",
  "model:read",
  "model:push",
  "model:pull",
  "model:delete",
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
      // Resource-specific rule overrides generic "create" for endpoint
      { action: "endpoint:create", deps: ["read", "workspace:read"] },
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

  describe("resource-specific rule overrides generic rule", () => {
    const overrideRules: PermissionDependencyRule[] = [
      { action: "create", deps: ["read"] },
      { action: "delete", deps: ["read"] },
      { action: "model:delete", deps: ["model_registry:read"] },
    ];

    it("should use specific rule deps instead of generic for matching resource", () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        usePermissionDependencies({
          value: [],
          allPermissions: TEST_PERMISSIONS,
          rules: overrideRules,
          onChange,
        }),
      );

      act(() => {
        result.current.togglePermission("model", "delete");
      });

      const called = onChange.mock.calls[0][0] as string[];
      expect(called).toContain("model:delete");
      expect(called).toContain("model_registry:read");
      // generic delete→read should NOT apply for model
      expect(called).not.toContain("model:read");
    });

    it("should still apply generic rule for resources without specific override", () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        usePermissionDependencies({
          value: [],
          allPermissions: TEST_PERMISSIONS,
          rules: overrideRules,
          onChange,
        }),
      );

      act(() => {
        result.current.togglePermission("endpoint", "delete");
      });

      const called = onChange.mock.calls[0][0] as string[];
      expect(called).toContain("endpoint:delete");
      expect(called).toContain("endpoint:read"); // generic delete→read still applies
    });

    it("should not lock model:read when model:delete is selected (override has no model:read dep)", () => {
      const { result } = renderHook(() =>
        usePermissionDependencies({
          value: ["model:read", "model:delete", "model_registry:read"],
          allPermissions: TEST_PERMISSIONS,
          rules: overrideRules,
        }),
      );

      // model:read should NOT be locked by model:delete
      expect(result.current.getActionDependents("model", "read")).toEqual([]);
    });

    it("should lock model_registry:read when model:delete is selected", () => {
      const { result } = renderHook(() =>
        usePermissionDependencies({
          value: ["model:delete", "model_registry:read"],
          allPermissions: TEST_PERMISSIONS,
          rules: overrideRules,
        }),
      );

      expect(
        result.current.getActionDependents("model_registry", "read"),
      ).toEqual(["model:delete"]);
    });
  });

  describe("default rules - NEU-394/395/396", () => {
    // These tests use default ALL_RULES to verify the actual business rules

    it("NEU-396: model:delete should auto-select model_registry:read, not model:read", () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        usePermissionDependencies({
          value: [],
          allPermissions: TEST_PERMISSIONS,
          onChange,
        }),
      );

      act(() => {
        result.current.togglePermission("model", "delete");
      });

      const called = onChange.mock.calls[0][0] as string[];
      expect(called).toContain("model:delete");
      expect(called).toContain("model_registry:read");
      expect(called).not.toContain("model:read");
    });

    it("NEU-396: model:push should not auto-select model:read", () => {
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
      expect(called).toContain("model:push");
      expect(called).toContain("model_registry:read");
      expect(called).not.toContain("model:read");
    });

    it("NEU-396: model:pull should not auto-select model:read", () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        usePermissionDependencies({
          value: [],
          allPermissions: TEST_PERMISSIONS,
          onChange,
        }),
      );

      act(() => {
        result.current.togglePermission("model", "pull");
      });

      const called = onChange.mock.calls[0][0] as string[];
      expect(called).toContain("model:pull");
      expect(called).toContain("model_registry:read");
      expect(called).not.toContain("model:read");
    });

    it("NEU-395: model:read should auto-select model_registry:read", () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        usePermissionDependencies({
          value: [],
          allPermissions: TEST_PERMISSIONS,
          onChange,
        }),
      );

      act(() => {
        result.current.togglePermission("model", "read");
      });

      const called = onChange.mock.calls[0][0] as string[];
      expect(called).toContain("model:read");
      expect(called).toContain("model_registry:read");
    });

    it.each([
      "endpoint",
      "cluster",
      "external_endpoint",
      "image_registry",
      "model_registry",
    ])("NEU-394: %s:create should auto-select workspace:read", (resource) => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        usePermissionDependencies({
          value: [],
          allPermissions: TEST_PERMISSIONS,
          onChange,
        }),
      );

      act(() => {
        result.current.togglePermission(resource, "create");
      });

      const called = onChange.mock.calls[0][0] as string[];
      expect(called).toContain(`${resource}:create`);
      expect(called).toContain(`${resource}:read`);
      expect(called).toContain("workspace:read");
    });

    it("NEU-394: workspace:read should be locked by any workspaced write action", () => {
      const { result } = renderHook(() =>
        usePermissionDependencies({
          value: ["workspace:read", "cluster:read", "cluster:delete"],
          allPermissions: TEST_PERMISSIONS,
        }),
      );

      expect(result.current.getActionDependents("workspace", "read")).toContain(
        "cluster:delete",
      );
    });

    it("NEU-394: workspaced resource:read should NOT depend on workspace:read", () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        usePermissionDependencies({
          value: [],
          allPermissions: TEST_PERMISSIONS,
          onChange,
        }),
      );

      act(() => {
        result.current.togglePermission("endpoint", "read");
      });

      const called = onChange.mock.calls[0][0] as string[];
      expect(called).toContain("endpoint:read");
      expect(called).not.toContain("workspace:read");
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
        "cluster",
        "endpoint",
        "external_endpoint",
        "image_registry",
        "model",
        "model_registry",
        "workspace",
      ]);
    });
  });

  describe("WORKSPACED_RESOURCES guard", () => {
    /**
     * Guard test: ensures WORKSPACED_RESOURCES stays in sync with App.tsx.
     *
     * How it works:
     *   Reads App.tsx as plain text, uses a regex to find resource blocks
     *   with `workspaced: true`, converts plural names to singular permission
     *   prefixes (e.g. "image_registries" → "image_registry"), and compares
     *   the result with the exported WORKSPACED_RESOURCES set.
     *
     * When this test fails:
     *   1. If you added/removed a workspaced resource in App.tsx — update
     *      WORKSPACED_RESOURCES in use-permission-dependencies.ts to match.
     *   2. If the regex no longer parses App.tsx correctly (e.g. the resource
     *      definition format changed) — fix the regex below, or as a last
     *      resort replace the parsing logic with a hardcoded expected list
     *      and add a comment pointing back to App.tsx.
     */
    it("should match workspaced resources defined in App.tsx", () => {
      const appSource = readFileSync(
        resolve(__dirname, "../../../App.tsx"),
        "utf-8",
      );

      // Match each resource block: { name: "xxx", ... workspaced: true ... }
      const resourceBlocks = appSource.matchAll(
        /\{\s*name:\s*"(\w+)"[\s\S]*?\}/g,
      );

      const workspacedFromApp: string[] = [];
      for (const match of resourceBlocks) {
        const [block, name] = match;
        if (block.includes("workspaced: true")) {
          // Convert plural resource name to singular permission prefix:
          // "image_registries" → "image_registry", "clusters" → "cluster"
          const singular = name.replace(/ies$/, "y").replace(/s$/, "");
          workspacedFromApp.push(singular);
        }
      }

      // api_key has no corresponding permissions — exclude from comparison
      const filtered = workspacedFromApp.filter((r) => r !== "api_key");

      expect([...WORKSPACED_RESOURCES].sort()).toEqual(filtered.sort());
    });
  });
});
