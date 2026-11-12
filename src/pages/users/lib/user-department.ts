import { orgUnitPathLabel } from "@/domains/organization/lib/org-tree";
import type { OrgUnit } from "@/domains/organization/types";

/**
 * The department path of a user, "A / B / C", from the unit the profile embeds
 * (it needs `path`) and the units the caller can read. Ancestors the caller
 * cannot read are left out; "" for a user without a department.
 */
export function userDepartmentPath(
  unit: OrgUnit | null | undefined,
  unitsById: ReadonlyMap<number, OrgUnit>,
): string {
  return unit ? orgUnitPathLabel(unit, unitsById) : "";
}
