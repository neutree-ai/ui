import type { Metadata } from "@/foundation/types/basic-types";

export interface RoleAssignmentSpec {
  user_id: string;
  workspace: string | null;
  global: boolean;
  role: string;
  /**
   * metadata.name of an OrgUnit: the assignment covers that subtree, with
   * global false and no workspace. Absent on servers older than the field.
   */
  org_unit?: string | null;
}

export interface RoleAssignment {
  id: number;
  api_version: "v1";
  kind: "RoleAssignment";
  metadata: Metadata;
  spec: RoleAssignmentSpec;
}
