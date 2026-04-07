import { useCallback, useMemo } from "react";
import { ALL_PERMISSIONS } from "@/domains/role/types";

export type PermissionDependencyRule = {
  action: string; // "create" (all resources) or "endpoint:create" (specific)
  deps: string[]; // "read" (same resource) or "workspace:read" (specific)
};

/** Resources scoped to a workspace — their write actions depend on workspace:read.
 *  Keep in sync with App.tsx resource definitions (meta.workspaced: true).
 *  A guard test in use-permission-dependencies.test.ts will fail if this drifts.
 *  @see use-permission-dependencies.test.ts "WORKSPACED_RESOURCES guard" */
export const WORKSPACED_RESOURCES = new Set([
  "cluster",
  "endpoint",
  "external_endpoint",
  "image_registry",
  "model_registry",
  "model_catalog",
  "engine",
]);

const ALL_RULES: PermissionDependencyRule[] = [
  { action: "create", deps: ["read"] },
  { action: "update", deps: ["read"] },
  { action: "delete", deps: ["read"] },
  // model:delete/push/pull depend on model_registry:read, NOT model:read
  { action: "model:delete", deps: ["model_registry:read"] },
  { action: "model:push", deps: ["model_registry:read"] },
  { action: "model:pull", deps: ["model_registry:read"] },
  // model:read depends on model_registry:read
  { action: "model:read", deps: ["model_registry:read"] },
];

type PermissionsTreeData = Record<
  string,
  { actions: string[]; selectedActions: string[] }
>;

function parsePermissionsToTree(
  value: string[],
  allPermissions: string[],
): PermissionsTreeData {
  const tree: PermissionsTreeData = {};

  for (const permission of allPermissions) {
    const [resource, action] = permission.split(":");
    if (!tree[resource]) {
      tree[resource] = { actions: [], selectedActions: [] };
    }
    tree[resource].actions.push(action);
  }

  for (const permission of value) {
    const [resource, action] = permission.split(":");
    if (tree[resource] && !tree[resource].selectedActions.includes(action)) {
      tree[resource].selectedActions.push(action);
    }
  }

  return tree;
}

/**
 * Parse a rule key: "create" → { resource: null, action: "create" }
 *                    "endpoint:create" → { resource: "endpoint", action: "create" }
 */
function parseRuleKey(key: string): {
  resource: string | null;
  action: string;
} {
  const idx = key.indexOf(":");
  if (idx >= 0) {
    return { resource: key.slice(0, idx), action: key.slice(idx + 1) };
  }
  return { resource: null, action: key };
}

/** Check if a rule key matches a given resource:action pair */
function ruleKeyMatches(
  ruleKey: string,
  resource: string,
  action: string,
): boolean {
  const parsed = parseRuleKey(ruleKey);
  if (parsed.resource !== null) {
    return parsed.resource === resource && parsed.action === action;
  }
  return parsed.action === action;
}

/** Check if a resource-specific rule exists for a given resource and action */
function hasSpecificRule(
  resource: string,
  action: string,
  rules: PermissionDependencyRule[],
): boolean {
  return rules.some((r) => {
    const parsed = parseRuleKey(r.action);
    return parsed.resource === resource && parsed.action === action;
  });
}

/**
 * Get all dependency permissions that should be auto-selected when
 * checking resource:action. Returns full permission strings.
 *
 * When a resource-specific rule exists (e.g. "model:delete"), generic
 * rules for the same action (e.g. "delete") are skipped for that resource.
 */
function getDepsForAction(
  resource: string,
  action: string,
  rules: PermissionDependencyRule[],
  workspacedResources: Set<string> = WORKSPACED_RESOURCES,
): string[] {
  const deps: string[] = [];
  const skipGeneric = hasSpecificRule(resource, action, rules);
  for (const rule of rules) {
    if (!ruleKeyMatches(rule.action, resource, action)) continue;
    // Skip generic rules when a resource-specific rule exists
    if (skipGeneric && parseRuleKey(rule.action).resource === null) continue;
    for (const dep of rule.deps) {
      const parsed = parseRuleKey(dep);
      deps.push(`${parsed.resource ?? resource}:${parsed.action}`);
    }
  }
  // Workspaced resources implicitly depend on workspace:read for write actions
  if (
    workspacedResources.has(resource) &&
    action !== "read" &&
    resource !== "workspace"
  ) {
    deps.push("workspace:read");
  }
  return [...new Set(deps)];
}

/**
 * Find all selected permissions that depend on resource:action.
 * Returns full permission strings, e.g. ["endpoint:create"].
 */
function findActionDependents(
  selectedPermissions: string[],
  resource: string,
  action: string,
  rules: PermissionDependencyRule[],
  workspacedResources: Set<string> = WORKSPACED_RESOURCES,
): string[] {
  const dependents: string[] = [];
  const target = `${resource}:${action}`;

  for (const selectedPerm of selectedPermissions) {
    if (selectedPerm === target) continue;
    const [selResource, selAction] = selectedPerm.split(":");
    const skipGeneric = hasSpecificRule(selResource, selAction, rules);

    for (const rule of rules) {
      if (!ruleKeyMatches(rule.action, selResource, selAction)) continue;
      if (skipGeneric && parseRuleKey(rule.action).resource === null) continue;
      for (const dep of rule.deps) {
        const parsed = parseRuleKey(dep);
        const depResource = parsed.resource ?? selResource;
        if (depResource === resource && parsed.action === action) {
          dependents.push(selectedPerm);
        }
      }
    }
    // Implicit workspace:read dependency for workspaced write actions
    if (
      resource === "workspace" &&
      action === "read" &&
      workspacedResources.has(selResource) &&
      selAction !== "read"
    ) {
      dependents.push(selectedPerm);
    }
  }

  return [...new Set(dependents)];
}

export function usePermissionDependencies(options: {
  value: string[];
  allPermissions?: string[];
  rules?: PermissionDependencyRule[];
  onChange?: (value: string[]) => void;
}) {
  const {
    value,
    allPermissions = ALL_PERMISSIONS,
    rules = ALL_RULES,
    onChange,
  } = options;

  const allPermissionsSet = useMemo(
    () => new Set(allPermissions),
    [allPermissions],
  );

  const permissionTree = useMemo(
    () => parsePermissionsToTree(value, allPermissions),
    [value, allPermissions],
  );

  const sortedResources = useMemo(
    () => Object.keys(permissionTree).sort(),
    [permissionTree],
  );

  const togglePermission = useCallback(
    (resource: string, action: string) => {
      const perm = `${resource}:${action}`;
      const isSelected = value.includes(perm);

      if (isSelected) {
        if (findActionDependents(value, resource, action, rules).length > 0) {
          return;
        }
        onChange?.(value.filter((p) => p !== perm));
      } else {
        const deps = getDepsForAction(resource, action, rules);
        const newPerms = new Set(value);
        for (const dep of deps) {
          if (allPermissionsSet.has(dep)) {
            newPerms.add(dep);
          }
        }
        newPerms.add(perm);
        onChange?.([...newPerms]);
      }
    },
    [value, allPermissionsSet, rules, onChange],
  );

  const toggleAllResourcePermissions = useCallback(
    (resource: string, selectAll: boolean) => {
      const resourceData = permissionTree[resource];
      if (!resourceData) return;

      if (selectAll) {
        const newPerms = new Set(value);
        for (const action of resourceData.actions) {
          newPerms.add(`${resource}:${action}`);
          // Also add cross-resource deps for each action
          for (const dep of getDepsForAction(resource, action, rules)) {
            if (allPermissionsSet.has(dep)) {
              newPerms.add(dep);
            }
          }
        }
        onChange?.([...newPerms]);
      } else {
        // Remove all this resource's permissions first, then check which
        // are still needed by OTHER resources' selected permissions.
        const resourcePerms = new Set(
          resourceData.actions.map((a) => `${resource}:${a}`),
        );
        const valueWithoutResource = value.filter((p) => !resourcePerms.has(p));
        // Re-add actions that are locked by cross-resource deps
        const lockedPerms = resourceData.actions
          .filter(
            (action) =>
              findActionDependents(
                valueWithoutResource,
                resource,
                action,
                rules,
              ).length > 0,
          )
          .map((a) => `${resource}:${a}`);
        onChange?.([...valueWithoutResource, ...lockedPerms]);
      }
    },
    [permissionTree, value, allPermissionsSet, rules, onChange],
  );

  const getActionDependents = useCallback(
    (resource: string, action: string): string[] => {
      return findActionDependents(value, resource, action, rules);
    },
    [value, rules],
  );

  return {
    permissionTree,
    sortedResources,
    togglePermission,
    toggleAllResourcePermissions,
    getActionDependents,
  };
}
