import { useNotification } from "@refinedev/core";
import { ManualTeamsField } from "@/domains/organization/components/ManualTeamsField";
import { OrgUnitField } from "@/domains/organization/components/OrgUnitField";
import {
  useCreateOrgUnitMembership,
  useCreateTeamMemberships,
  useOrgTree,
  useTeamsByName,
} from "@/domains/organization/hooks/use-organization";
import { ORGANIZATION_ERROR_KEYS } from "@/domains/organization/lib/organization-errors";
import { useUserForm } from "@/domains/user/hooks/use-user-form";
import { useHasGlobalPermission } from "@/foundation/hooks/use-has-permission";
import { useTranslation } from "@/foundation/lib/i18n";
import { displayName } from "@/foundation/role/display-name";
import { translateApiErrorOr } from "@/foundation/scene/api-error-code";
import { ResourceForm } from "@/foundation/scene/ResourceForm";

export const UsersCreate = () => {
  const { t } = useTranslation();
  const { open: openNotification } = useNotification();
  // A new user is in no department yet, so only a global grant can place
  // them: a subtree grant cannot cover a user outside every subtree.
  const { allowed } = useHasGlobalPermission("org_unit:assign-member");
  const canAssign = allowed === true;
  const { byName } = useOrgTree(canAssign);
  const createMembership = useCreateOrgUnitMembership();
  // Likewise for Teams: the same permission as Add Members on the
  // organization page, held globally.
  const canAssignTeams =
    useHasGlobalPermission("team:assign-member").allowed === true;
  const { byName: teamsByName } = useTeamsByName(canAssignTeams);
  const createTeamMemberships = useCreateTeamMemberships();

  const notFailed = (message: string, cause: unknown) =>
    openNotification?.({
      type: "error",
      message,
      description: translateApiErrorOr(
        t,
        cause,
        ORGANIZATION_ERROR_KEYS,
        "common.errors.unknown",
      ),
    });

  const { form, registerFields } = useUserForm({
    action: "create",
    departmentField: canAssign ? <OrgUnitField /> : undefined,
    teamsField: canAssignTeams ? <ManualTeamsField /> : undefined,
    // The user exists by now; a failed assignment is reported, not undone.
    onCreated: async ({ id, orgUnit, teams }) => {
      if (canAssign && orgUnit) {
        try {
          const unit = byName.get(orgUnit)?.unit;
          if (!unit) throw new Error(`department ${orgUnit} not found`);
          await createMembership(id, unit.id);
        } catch (cause) {
          notFailed(
            t("user_profiles.department.errors.createdNotAssigned"),
            cause,
          );
        }
      }
      if (canAssignTeams && teams.length) {
        const picked = teams.flatMap((name) => {
          const team = teamsByName.get(name);
          return team ? [team] : [];
        });
        const failed = await createTeamMemberships(
          id,
          picked.map((team) => team.id),
        );
        if (failed.length) {
          const names = failed.flatMap(({ teamId }) => {
            const team = picked.find((item) => item.id === teamId);
            return team ? [displayName(team.metadata)] : [];
          });
          notFailed(
            t("user_profiles.teams.errors.createdNotAssigned", {
              teams: names.join(", "),
            }),
            failed[0].cause,
          );
        }
      }
    },
  });
  return (
    <ResourceForm {...form} title={t("user_profiles.create")}>
      {registerFields}
    </ResourceForm>
  );
};
