import type { Metadata } from "@/foundation/types/basic-types";

type RolePreset = "admin" | "workspace_user";

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
  "model:read",
  "model:push",
  "model:pull",
  "model:delete",
  "engine:read",
  "engine:create",
  "engine:update",
  "engine:delete",
  "cluster:read",
  "cluster:create",
  "cluster:update",
  "cluster:delete",
  "model_catalog:read",
  "model_catalog:create",
  "model_catalog:update",
  "model_catalog:delete",
  "external_endpoint:read",
  "external_endpoint:create",
  "external_endpoint:update",
  "external_endpoint:delete",
  "system:admin",
  "user_profile:read",
  "user_profile:create",
  "user_profile:update",
  "user_profile:delete",
];
