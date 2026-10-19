import type { RoleAssignmentSpec } from "@/domains/role-assignment/types";

/** Where a role assignment applies: everywhere, one workspace, or a subtree. */
export type RoleAssignmentScope = "global" | "workspace" | "org_unit";

type ScopeFields = Pick<
  RoleAssignmentSpec,
  "global" | "workspace" | "org_unit"
>;

/**
 * A string org_unit, even empty, marks the subtree scope: the form sets ""
 * when the scope is picked, before a department is.
 */
export const scopeOf = (spec: ScopeFields): RoleAssignmentScope => {
  if (typeof spec.org_unit === "string") return "org_unit";
  return spec.global ? "global" : "workspace";
};

/** The scope fields for a scope, with the other scopes' fields cleared. */
export const scopeFields = (
  scope: RoleAssignmentScope,
  current: ScopeFields,
): ScopeFields => {
  switch (scope) {
    case "global":
      return { global: true, workspace: null, org_unit: null };
    case "workspace":
      return {
        global: false,
        workspace: scopeOf(current) === "workspace" ? current.workspace : "",
        org_unit: null,
      };
    case "org_unit":
      return {
        global: false,
        workspace: null,
        org_unit: typeof current.org_unit === "string" ? current.org_unit : "",
      };
  }
};

/**
 * The scopes the caller may pick. A delegated administrator (role_assignment
 * granted only on a subtree) can grant subtree assignments only; the
 * workspace scope needs a multi-workspace license.
 */
export const availableScopes = ({
  supportMultiWorkspace,
  delegated,
}: {
  supportMultiWorkspace: boolean;
  delegated: boolean;
}): RoleAssignmentScope[] => {
  if (delegated) return ["org_unit"];
  return [
    "global",
    ...(supportMultiWorkspace ? (["workspace"] as const) : []),
    "org_unit",
  ];
};
