import type { Metadata } from "./basic-types";
export type RolePreset = "admin" | "workspace_user";

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

export interface RoleSpec {
  preset_key: RolePreset | null;
  permissions: string[];
}

export interface Role {
  id: number;
  api_version: "v1";
  kind: "Role";
  metadata: Metadata;
  spec: RoleSpec;
}

export const ALL_PERMISSIONS = [
  "workspace:read",
  "workspace:create",
  "workspace:update",
  "workspace:delete",
  "role:read",
  "role:create",
  "role:update",
  "role:delete",
  "role_assignment:read",
  "role_assignment:create",
  "role_assignment:update",
  "role_assignment:delete",
  "endpoint:read",
  "endpoint:create",
  "endpoint:update",
  "endpoint:delete",
  "image_registry:read",
  "image_registry:create",
  "image_registry:update",
  "image_registry:delete",
  "model_registry:read",
  "model_registry:create",
  "model_registry:update",
  "model_registry:delete",
  "engine:read",
  "engine:create",
  "engine:update",
  "engine:delete",
  "cluster:read",
  "cluster:create",
  "cluster:update",
  "cluster:delete",
];
