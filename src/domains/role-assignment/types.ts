import type { Metadata } from "@/foundation/types/basic-types";

export interface RoleAssignmentSpec {
  user_id: string;
  workspace: string | null;
  global: boolean;
  role: string;
}

export interface RoleAssignment {
  id: number;
  api_version: "v1";
  kind: "RoleAssignment";
  metadata: Metadata;
  spec: RoleAssignmentSpec;
}
