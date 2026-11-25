import type { Role } from "@/domains/role/types";
import { type DetailField, field } from "@/foundation/scene/detail-field";

/** A built-in role: neither editable nor deletable. */
export const isPresetRole = (role: Role) => Boolean(role.spec.preset_key);

export const roleHeaderFields: DetailField<Role>[] = [
  field("common.fields.permissions", (role, t) =>
    t("common.fields.permissionsCount", {
      count: role.spec.permissions.length,
    }),
  ),
  field("common.fields.type", (role, t) =>
    t(
      isPresetRole(role)
        ? "roles.fields.presetRole"
        : "roles.fields.customRole",
    ),
  ),
];
