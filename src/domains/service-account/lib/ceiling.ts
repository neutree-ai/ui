/**
 * Permissions that manage access. A role holding one may not be in a Team's
 * application permissions; the server refuses it with 10325
 * (api.is_management_role). Keep the two lists the same.
 */
export const MANAGEMENT_PERMISSIONS: ReadonlySet<string> = new Set([
  "system:admin",
  "role:create",
  "role:update",
  "role:delete",
  "role_assignment:create",
  "role_assignment:update",
  "role_assignment:delete",
  "user_profile:create",
  "user_profile:update",
  "user_profile:delete",
  "identity_source:create",
  "identity_source:update",
  "identity_source:delete",
  "org_unit:assign-member",
  "team:create",
  "team:update",
  "team:delete",
  "team:assign-member",
  "group_policy:create",
  "group_policy:update",
  "group_policy:delete",
  "service_account:create",
  "service_account:update",
  "service_account:delete",
  "service_account:assign-role",
]);

export const isManagementRole = (permissions: readonly string[] | undefined) =>
  (permissions ?? []).some((permission) =>
    MANAGEMENT_PERMISSIONS.has(permission),
  );
