import { Edit, Trash2 } from "lucide-react";
import { OrgUnitLabel } from "@/domains/organization/components/OrgUnitField";
import { TeamLabel } from "@/domains/organization/components/TeamField";
import { RoleAssignmentScopeLabel } from "@/domains/role-assignment/components/RoleAssignmentScopeLabel";
import { RoleAssignmentSubjectLabel } from "@/domains/role-assignment/components/RoleAssignmentSubjectLabel";
import { ListPage } from "@/foundation/components/ListPage";
import { useMetadataColumns } from "@/foundation/components/metadata-columns";
import { ShowButton } from "@/foundation/components/ShowButton";
import { defaultSorters, Table } from "@/foundation/components/Table";
import { useTranslation } from "@/foundation/lib/i18n";

const useRoleAssignmentColumns = () => {
  const { t } = useTranslation();
  return {
    scope: (
      <Table.Column
        header={t("role_assignments.fields.scope")}
        accessorKey="spec.workspace"
        id="scope"
        enableHiding
        cell={({ row }) => (
          <RoleAssignmentScopeLabel
            spec={row.original.spec}
            renderOrgUnit={(name) => <OrgUnitLabel name={name} />}
          />
        )}
      />
    ),
    role: (
      <Table.Column
        header={t("common.fields.role")}
        accessorKey="spec.role"
        id="role"
        enableHiding
        cell={({ row }) => {
          const { role } = row.original.spec;
          return (
            <ShowButton
              recordItemId={role}
              meta={{}}
              variant="link"
              resource="roles"
            >
              {role}
            </ShowButton>
          );
        }}
      />
    ),
    subject: (
      <Table.Column
        header={t("role_assignments.fields.subject")}
        accessorKey="spec.subject_name"
        id="subject"
        enableHiding
        cell={({ row }) => (
          <RoleAssignmentSubjectLabel
            spec={row.original.spec}
            renderTeam={(name) => <TeamLabel name={name} />}
            renderOrgUnit={(name) => <OrgUnitLabel name={name} />}
          />
        )}
      />
    ),
    action: (
      <Table.Column
        accessorKey={"id"}
        id={"actions"}
        cell={({ row: { original } }) => {
          const isAdminGlobalAssignment =
            original.metadata.name === "admin-global-role-assignment";
          if (isAdminGlobalAssignment) {
            return null;
          }
          return (
            <Table.Actions>
              <Table.EditAction
                title={t("buttons.edit")}
                row={original}
                resource="role_assignments"
                icon={<Edit size={16} />}
              />
              <Table.DeleteAction
                title={t("buttons.delete")}
                row={original}
                resource="role_assignments"
                icon={<Trash2 size={16} />}
              />
            </Table.Actions>
          );
        }}
      />
    ),
  };
};

export const RoleAssignmentsList = () => {
  const metadataColumns = useMetadataColumns();
  const roleAssignmentColumns = useRoleAssignmentColumns();

  return (
    <ListPage>
      <Table
        enableSorting
        enableFilters
        enableBatchDelete
        searchField="metadata->>name"
        refineCoreProps={{
          sorters: defaultSorters,
        }}
      >
        {metadataColumns.name}
        {roleAssignmentColumns.scope}
        {roleAssignmentColumns.role}
        {roleAssignmentColumns.subject}
        {metadataColumns.creation_timestamp}
        {roleAssignmentColumns.action}
      </Table>
    </ListPage>
  );
};
