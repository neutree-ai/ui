import type { RoleAssignmentSpec } from "@/domains/role-assignment/types";

/**
 * Where a role assignment applies: everywhere, one workspace, a subtree, or
 * one Team.
 */
export type RoleAssignmentScope = "global" | "workspace" | "org_unit" | "team";

type ScopeFields = Pick<
  RoleAssignmentSpec,
  "global" | "workspace" | "org_unit" | "team"
>;

/**
 * A string org_unit or team, even empty, marks that scope: the form sets ""
 * when the scope is picked, before a department or Team is.
 */
export const scopeOf = (spec: ScopeFields): RoleAssignmentScope => {
  if (typeof spec.team === "string") return "team";
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
      return { global: true, workspace: null, org_unit: null, team: null };
    case "workspace":
      return {
        global: false,
        workspace: scopeOf(current) === "workspace" ? current.workspace : "",
        org_unit: null,
        team: null,
      };
    case "org_unit":
      return {
        global: false,
        workspace: null,
        org_unit: typeof current.org_unit === "string" ? current.org_unit : "",
        team: null,
      };
    case "team":
      return {
        global: false,
        workspace: null,
        org_unit: null,
        team: typeof current.team === "string" ? current.team : "",
      };
  }
};

/**
 * The scopes the caller may pick. A delegated administrator (role_assignment
 * granted only on a subtree) can grant subtree assignments only; the
 * workspace scope needs a multi-workspace license; the Team scope needs a
 * global role_assignment grant, which `canScopeTeam` reports.
 */
export const availableScopes = ({
  supportMultiWorkspace,
  delegated,
  canScopeTeam = false,
}: {
  supportMultiWorkspace: boolean;
  delegated: boolean;
  canScopeTeam?: boolean;
}): RoleAssignmentScope[] => {
  if (delegated) return ["org_unit"];
  return [
    "global",
    ...(supportMultiWorkspace ? (["workspace"] as const) : []),
    "org_unit",
    ...(canScopeTeam ? (["team"] as const) : []),
  ];
};
