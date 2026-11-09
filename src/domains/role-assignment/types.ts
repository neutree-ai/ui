import type { Metadata } from "@/foundation/types/basic-types";

/**
 * Who holds a role assignment: a user or every member of a group.
 */
export type RoleAssignmentSubjectKind = "User" | "Team" | "OrgUnit";

export interface RoleAssignmentSpec {
  /** Set for a User subject, null for a group. */
  user_id: string | null;
  workspace: string | null;
  global: boolean;
  role: string;
  /**
   * metadata.name of an OrgUnit: the assignment covers that subtree, with
   * global false and no workspace. Absent on servers older than the field.
   */
  org_unit?: string | null;
  /**
   * metadata.name of a Team: the assignment applies to that Team only, with
   * global false and no workspace or OrgUnit. Absent on older servers.
   */
  team?: string | null;
  /** Absent or null reads as "User" (older rows and servers). */
  subject_kind?: RoleAssignmentSubjectKind | null;
  /** metadata.name of the Team or OrgUnit; null for a User subject. */
  subject_name?: string | null;
}

/** A row of get_user_effective_role_assignments. */
export interface EffectiveRoleAssignment {
  id: number;
  name: string;
  spec: RoleAssignmentSpec;
  via_kind: RoleAssignmentSubjectKind;
  /** The group's metadata.name; null when via_kind is User. */
  via_name: string | null;
}

export interface RoleAssignment {
  id: number;
  api_version: "v1";
  kind: "RoleAssignment";
  metadata: Metadata;
  spec: RoleAssignmentSpec;
}
