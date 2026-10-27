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
  ...["endpoint", "cluster", "external_endpoint", "image_registry"].flatMap(
    (resource) =>
      ["read", "create", "update", "delete"].map((a) => `${resource}:${a}`),
  ),
  ...["read", "create", "update", "delete"].map((a) => `model_registry:${a}`),
  ...["read", "push", "pull", "delete"].map((a) => `model:${a}`),
  ...["read", "usage-read", "create", "update", "delete"].map(
    (a) => `workspace:${a}`,
  ),
];

function setup(value: string[], rules?: PermissionDependencyRule[]) {
  const onChange = vi.fn();
  const { result } = renderHook(() =>
    usePermissionDependencies({
      value,
      allPermissions: TEST_PERMISSIONS,
      rules,
      onChange,
    }),
  );
  /** The value the hook commits, or null when it refuses the change. */
  const committed = () =>
    onChange.mock.calls.length > 0
      ? [...(onChange.mock.calls[0][0] as string[])].sort()
      : null;
  return { hook: result.current, committed };
}

/** Toggle `permission` on `value` and return what the hook commits. */
function toggle(
  value: string[],
  permission: string,
  rules?: PermissionDependencyRule[],
) {
  const { hook, committed } = setup(value, rules);
  const [resource, action] = permission.split(":");
  act(() => hook.togglePermission(resource, action));
  return committed();
}

const sorted = (permissions: string[]) => [...permissions].sort();

// Resource-specific rule overrides the generic "create" for endpoint.
const crossRules: PermissionDependencyRule[] = [
  { action: "endpoint:create", deps: ["read", "workspace:read"] },
  { action: "create", deps: ["read"] },
];
const overrideRules: PermissionDependencyRule[] = [
  { action: "create", deps: ["read"] },
  { action: "delete", deps: ["read"] },
  { action: "model:delete", deps: ["model_registry:read"] },
];
const customRules: PermissionDependencyRule[] = [
  { action: "delete", deps: ["read", "update"] },
];

describe("usePermissionDependencies", () => {
  describe("checking a permission selects what it depends on", () => {
    it.each([
      { perm: "endpoint:create", commits: ["endpoint:read", "workspace:read"] },
      { perm: "endpoint:update", commits: ["endpoint:read", "workspace:read"] },
      ...[
        "cluster",
        "external_endpoint",
        "image_registry",
        "model_registry",
      ].map((r) => ({
        perm: `${r}:create`,
        commits: [`${r}:read`, "workspace:read"],
      })),
      // A workspaced resource's read does not need workspace:read.
      { perm: "endpoint:read", commits: [] },
      { perm: "model:push", commits: ["model:read", "model_registry:read"] },
      { perm: "model:pull", commits: ["model_registry:read"] },
      { perm: "model:delete", commits: ["model_registry:read"] },
      { perm: "model:read", commits: ["model_registry:read"] },
      { perm: "workspace:usage-read", commits: ["workspace:read"] },
      { perm: "workspace:read", commits: [] },
    ])("$perm -> $commits", ({ perm, commits }) => {
      expect(toggle([], perm)).toEqual(sorted([perm, ...commits]));
    });

    it("does not duplicate a dependency that is already selected", () => {
      expect(toggle(["endpoint:read"], "endpoint:create")).toEqual(
        sorted(["endpoint:read", "endpoint:create", "workspace:read"]),
      );
    });

    it.each([
      {
        rules: "custom",
        perm: "endpoint:delete",
        commits: ["endpoint:read", "endpoint:update", "workspace:read"],
      },
      {
        rules: "cross-resource",
        perm: "endpoint:create",
        commits: ["endpoint:read", "workspace:read"],
      },
      // The endpoint-specific rule leaves other resources alone.
      {
        rules: "cross-resource",
        perm: "workspace:create",
        commits: ["workspace:read"],
      },
      // A resource-specific rule replaces the generic one for that resource.
      {
        rules: "override",
        perm: "model:delete",
        commits: ["model_registry:read"],
      },
      {
        rules: "override",
        perm: "endpoint:delete",
        commits: ["endpoint:read", "workspace:read"],
      },
    ])("$rules rules: $perm -> $commits", ({ rules, perm, commits }) => {
      const ruleSet = {
        custom: customRules,
        "cross-resource": crossRules,
        override: overrideRules,
      }[rules];
      expect(toggle([], perm, ruleSet)).toEqual(sorted([perm, ...commits]));
    });
  });

  describe("unchecking", () => {
    it.each([
      { value: ["endpoint:read", "endpoint:create"], perm: "endpoint:read" },
      { value: ["endpoint:read", "endpoint:update"], perm: "endpoint:read" },
      {
        value: ["model:push", "model:read", "model_registry:read"],
        perm: "model:read",
      },
      {
        value: ["workspace:read", "workspace:usage-read"],
        perm: "workspace:read",
      },
    ])("refuses $perm while a dependent is selected", ({ value, perm }) => {
      expect(toggle(value, perm)).toBeNull();
    });

    it("refuses a cross-resource dependency while its dependent is selected", () => {
      expect(
        toggle(
          ["workspace:read", "endpoint:read", "endpoint:create"],
          "workspace:read",
          crossRules,
        ),
      ).toBeNull();
    });

    it("releases a dependency once its dependent is removed", () => {
      const withoutCreate = toggle(
        ["workspace:read", "endpoint:read", "endpoint:create"],
        "endpoint:create",
        crossRules,
      );
      expect(withoutCreate).toEqual(["endpoint:read", "workspace:read"]);

      expect(toggle(withoutCreate!, "workspace:read", crossRules)).toEqual([
        "endpoint:read",
      ]);
    });

    it("keeps the dependencies when the dependent is removed", () => {
      expect(
        toggle(
          ["model:push", "model:read", "model_registry:read"],
          "model:push",
        ),
      ).toEqual(["model:read", "model_registry:read"]);
    });
  });

  describe("getActionDependents", () => {
    it.each([
      {
        value: ["endpoint:read", "endpoint:create", "endpoint:update"],
        target: "endpoint:read",
        dependents: ["endpoint:create", "endpoint:update"],
      },
      { value: ["endpoint:read"], target: "endpoint:read", dependents: [] },
      {
        value: ["endpoint:read", "endpoint:create"],
        target: "endpoint:create",
        dependents: [],
      },
      {
        value: ["model:push", "model:read", "model_registry:read"],
        target: "model:read",
        dependents: ["model:push"],
      },
      {
        value: ["workspace:read", "cluster:read", "cluster:delete"],
        target: "workspace:read",
        dependents: ["cluster:delete"],
      },
      {
        value: ["workspace:read", "workspace:usage-read"],
        target: "workspace:read",
        dependents: ["workspace:usage-read"],
      },
    ])("$target in $value -> $dependents", ({ value, target, dependents }) => {
      const [resource, action] = target.split(":");
      expect(
        sorted(setup(value).hook.getActionDependents(resource, action)),
      ).toEqual(dependents);
    });

    it.each([
      {
        rules: customRules,
        value: ["endpoint:read", "endpoint:update", "endpoint:delete"],
        target: "endpoint:update",
        dependents: ["endpoint:delete"],
      },
      {
        rules: customRules,
        value: ["endpoint:read", "endpoint:update", "endpoint:delete"],
        target: "endpoint:delete",
        dependents: [],
      },
      {
        rules: crossRules,
        value: ["workspace:read", "endpoint:read", "endpoint:create"],
        target: "workspace:read",
        dependents: ["endpoint:create"],
      },
      // The model:delete override drops the generic delete -> read lock.
      {
        rules: overrideRules,
        value: ["model:read", "model:delete", "model_registry:read"],
        target: "model:read",
        dependents: [],
      },
      {
        rules: overrideRules,
        value: ["model:delete", "model_registry:read"],
        target: "model_registry:read",
        dependents: ["model:delete"],
      },
    ])(
      "follows custom rules: $target in $value -> $dependents",
      ({ rules, value, target, dependents }) => {
        const [resource, action] = target.split(":");
        expect(
          setup(value, rules).hook.getActionDependents(resource, action),
        ).toEqual(dependents);
      },
    );
  });

  describe("toggleAllResourcePermissions", () => {
    it("selects every action of a resource with their dependencies", () => {
      const { hook, committed } = setup([], crossRules);
      act(() => hook.toggleAllResourcePermissions("endpoint", true));
      expect(committed()).toEqual(
        sorted([
          "endpoint:read",
          "endpoint:create",
          "endpoint:update",
          "endpoint:delete",
          "workspace:read",
        ]),
      );
    });

    it("deselects every action of a resource", () => {
      const { hook, committed } = setup([
        "endpoint:read",
        "endpoint:create",
        "endpoint:update",
        "endpoint:delete",
      ]);
      act(() => hook.toggleAllResourcePermissions("endpoint", false));
      expect(committed()).toEqual([]);
    });

    it("keeps actions another resource still depends on", () => {
      const { hook, committed } = setup(
        [
          "workspace:read",
          "workspace:create",
          "endpoint:read",
          "endpoint:create",
        ],
        crossRules,
      );
      act(() => hook.toggleAllResourcePermissions("workspace", false));
      expect(committed()).toEqual(
        sorted(["endpoint:read", "endpoint:create", "workspace:read"]),
      );
    });
  });

  it.each([
    { value: ["model:push"], missing: ["model:read", "model_registry:read"] },
    {
      value: ["model:push", "model:read", "model_registry:read"],
      missing: [],
    },
  ])("reports $missing as missing from $value", ({ value, missing }) => {
    expect(sorted(setup(value).hook.missingDependencies)).toEqual(missing);
  });

  it("groups permissions by resource, sorted by name", () => {
    const { hook } = setup(["endpoint:read", "model:push"]);

    expect(hook.permissionTree.endpoint.selectedActions).toEqual(["read"]);
    expect(hook.permissionTree.model.selectedActions).toEqual(["push"]);
    expect(hook.sortedResources).toEqual([
      "cluster",
      "endpoint",
      "external_endpoint",
      "image_registry",
      "model",
      "model_registry",
      "workspace",
    ]);
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

      // Workspaced views with no permission_action entries (API keys and the
      // observability pages) are not RBAC resources — exclude from comparison.
      const permissionless = new Set(["api_key", "ai_trace", "model_usage"]);
      const filtered = workspacedFromApp.filter((r) => !permissionless.has(r));

      expect([...WORKSPACED_RESOURCES].sort()).toEqual(filtered.sort());
    });
  });
});
