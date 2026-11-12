import { useMemo } from "react";
import { useOrgUnits } from "@/domains/organization/hooks/use-organization";
import { isInactive } from "@/domains/organization/lib/org-tree";
import type { OrgUnit } from "@/domains/organization/types";
import type { UserProfile } from "@/domains/user/types";
import { EmptyValue } from "@/foundation/components/EmptyValue";
import { ListPage } from "@/foundation/components/ListPage";
import { useMetadataColumns } from "@/foundation/components/metadata-columns";
import { defaultSorters, Table } from "@/foundation/components/Table";
import { useHasPermission } from "@/foundation/hooks/use-has-permission";
import { displayName } from "@/foundation/lib/display-name";
import { useTranslation } from "@/foundation/lib/i18n";
import {
  profileDisplayName,
  profileEmail,
  profileIdentitySourceName,
} from "@/foundation/lib/user-identity";
import { UserSourceFilter } from "./components/UserSourceFilter";
import { userDepartmentPath } from "./lib/user-department";

const NO_UNITS: OrgUnit[] = [];

const useUserColumns = (canReadOrgUnits: boolean) => {
  const { t } = useTranslation();
  // One list of the readable departments names every user's path.
  const { data: orgUnits } = useOrgUnits(canReadOrgUnits);
  const unitsById = useMemo(
    () => new Map((orgUnits?.data ?? NO_UNITS).map((u) => [u.id, u])),
    [orgUnits],
  );

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
    source: (
      <Table.Column
        header={t("user_profiles.fields.identitySource")}
        accessorKey="metadata.labels"
        id="identity_source"
        enableHiding
        enableSorting={false}
        cell={({ row }) =>
          profileIdentitySourceName(row.original.metadata) ||
          t("user_profiles.values.local")
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
          const path =
            userDepartmentPath(unit, unitsById) || displayName(unit.metadata);
          return (
            <span
              className={isInactive(unit) ? "text-muted-foreground" : ""}
              title={path}
            >
              {path}
            </span>
          );
        }}
      />
    ),
  };
};

// One query: org_unit_members.user_id is both the key and a foreign key to
// user_profiles, so PostgREST embeds it as a single object.
const USER_SELECT = "*,org_unit_members(org_units(id,metadata,status,path))";

export const UsersList = () => {
  const metadataColumns = useMetadataColumns();
  // Membership rows need org_unit:read; without it the column would read empty.
  const { allowed: canReadOrgUnits } = useHasPermission("org_unit:read");
  const userColumns = useUserColumns(canReadOrgUnits === true);

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
        filters={({ filters, setFilters }) => (
          <UserSourceFilter filters={filters} setFilters={setFilters} />
        )}
      >
        {metadataColumns.name}
        {userColumns.displayName}
        {userColumns.email}
        {userColumns.source}
        {canReadOrgUnits === true && userColumns.department}

        {metadataColumns.creation_timestamp}

        {metadataColumns.action}
      </Table>
    </ListPage>
  );
};
