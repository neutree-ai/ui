import { ALL_PERMISSIONS } from "@/types";
import { useCallback, useMemo } from "react";

export type PermissionDependencyRule = {
  action: string; // "create" (all resources) or "endpoint:create" (specific)
  deps: string[]; // "read" (same resource) or "workspace:read" (specific)
};

export const ALL_RULES: PermissionDependencyRule[] = [
  { action: "create", deps: ["read"] },
  { action: "update", deps: ["read"] },
  { action: "delete", deps: ["read"] },
  { action: "model:push", deps: ["model_registry:read"] },
  { action: "model:pull", deps: ["model_registry:read"] },
];

export type PermissionsTreeData = Record<
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

/**
 * Get all dependency permissions that should be auto-selected when
 * checking resource:action. Returns full permission strings.
 */
function getDepsForAction(
  resource: string,
  action: string,
  rules: PermissionDependencyRule[],
): string[] {
  const deps: string[] = [];
  for (const rule of rules) {
    if (!ruleKeyMatches(rule.action, resource, action)) continue;
    for (const dep of rule.deps) {
      const parsed = parseRuleKey(dep);
      deps.push(`${parsed.resource ?? resource}:${parsed.action}`);
    }
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
): string[] {
  const dependents: string[] = [];
  const target = `${resource}:${action}`;

  for (const selectedPerm of selectedPermissions) {
    if (selectedPerm === target) continue;
    const [selResource, selAction] = selectedPerm.split(":");

    for (const rule of rules) {
      if (!ruleKeyMatches(rule.action, selResource, selAction)) continue;
      for (const dep of rule.deps) {
        const parsed = parseRuleKey(dep);
        const depResource = parsed.resource ?? selResource;
        if (depResource === resource && parsed.action === action) {
          dependents.push(selectedPerm);
        }
      }
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
