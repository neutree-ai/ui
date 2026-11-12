import { useNotification } from "@refinedev/core";
import { OrgUnitField } from "@/domains/organization/components/OrgUnitField";
import {
  useCreateOrgUnitMembership,
  useOrgTree,
} from "@/domains/organization/hooks/use-organization";
import { ORGANIZATION_ERROR_KEYS } from "@/domains/organization/lib/organization-errors";
import { useUserForm } from "@/domains/user/hooks/use-user-form";
import { ResourceForm } from "@/foundation/components/ResourceForm";
import { useHasGlobalPermission } from "@/foundation/hooks/use-has-permission";
import { translateApiErrorOr } from "@/foundation/lib/api-error-code";
import { useTranslation } from "@/foundation/lib/i18n";

export const UsersCreate = () => {
  const { t } = useTranslation();
  const { open: openNotification } = useNotification();
  // A new user is in no department yet, so only a global grant can place
  // them: a subtree grant cannot cover a user outside every subtree.
  const { allowed } = useHasGlobalPermission("org_unit:assign-member");
  const canAssign = allowed === true;
  const { byName } = useOrgTree(canAssign);
  const createMembership = useCreateOrgUnitMembership();

  const { form, registerFields } = useUserForm({
    action: "create",
    departmentField: canAssign ? <OrgUnitField /> : undefined,
    // The user exists by now; a failed assignment is reported, not undone.
    onCreated: async ({ id, orgUnit }) => {
      if (!canAssign || !orgUnit) return;
      try {
        const unit = byName.get(orgUnit)?.unit;
        if (!unit) throw new Error(`department ${orgUnit} not found`);
        await createMembership(id, unit.id);
      } catch (cause) {
        openNotification?.({
          type: "error",
          message: t("user_profiles.department.errors.createdNotAssigned"),
          description: translateApiErrorOr(
            t,
            cause,
            ORGANIZATION_ERROR_KEYS,
            "common.errors.unknown",
          ),
        });
      }
    },
  });
  return (
    <ResourceForm {...form} title={t("user_profiles.create")}>
      {registerFields}
    </ResourceForm>
  );
};
