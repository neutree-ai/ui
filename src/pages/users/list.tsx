import { displayName, isInactive } from "@/domains/organization/lib/org-tree";
import type { OrgUnit } from "@/domains/organization/types";
import type { UserProfile } from "@/domains/user/types";
import { EmptyValue } from "@/foundation/components/EmptyValue";
import { ListPage } from "@/foundation/components/ListPage";
import { useMetadataColumns } from "@/foundation/components/metadata-columns";
import { defaultSorters, Table } from "@/foundation/components/Table";
import { useHasPermission } from "@/foundation/hooks/use-has-permission";
import { useTranslation } from "@/foundation/lib/i18n";
import {
  profileDisplayName,
  profileEmail,
} from "@/foundation/lib/user-identity";

const useUserColumns = () => {
  const { t } = useTranslation();

  return {
    displayName: (
      <Table.Column
        header={t("user_profiles.fields.displayName")}
        accessorKey="metadata.display_name"
        id="display_name"
        enableHiding
        cell={({ row }) => profileDisplayName(row.original.metadata)}
      />
    ),
    email: (
      <Table.Column
        header={t("common.fields.email")}
        accessorKey="spec.email"
        id="email"
        enableHiding
        cell={({ row }) =>
          profileEmail(row.original as UserProfile) || <EmptyValue />
        }
      />
    ),
    department: (
      <Table.Column
        header={t("organization.fields.department")}
        accessorKey="org_unit_members.org_units.metadata.display_name"
        id="department"
        enableHiding
        enableSorting={false}
        cell={({ row }) => {
          const unit: OrgUnit | undefined =
            row.original.org_unit_members?.org_units;
          if (!unit) return <EmptyValue />;
          return (
            <span className={isInactive(unit) ? "text-muted-foreground" : ""}>
              {displayName(unit.metadata)}
            </span>
          );
        }}
      />
    ),
  };
};

// One query: org_unit_members.user_id is both the key and a foreign key to
// user_profiles, so PostgREST embeds it as a single object.
const USER_SELECT = "*,org_unit_members(org_units(id,metadata,status))";

export const UsersList = () => {
  const metadataColumns = useMetadataColumns();
  const userColumns = useUserColumns();
  // Membership rows need org_unit:read; without it the column would read empty.
  const { allowed: canReadOrgUnits } = useHasPermission("org_unit:read");

  return (
    <ListPage>
      <Table
        enableSorting
        enableFilters
        enableBatchDelete
        searchField="metadata->>name"
        refineCoreProps={{
          sorters: defaultSorters,
          meta: { select: USER_SELECT },
        }}
      >
        {metadataColumns.name}
        {userColumns.displayName}
        {userColumns.email}
        {canReadOrgUnits === true && userColumns.department}

        {metadataColumns.creation_timestamp}

        {metadataColumns.action}
      </Table>
    </ListPage>
  );
};
