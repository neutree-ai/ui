import UserCell from "@/domains/role-assignment/components/UserCell";
import { ListPage } from "@/foundation/components/ListPage";
import { ShowButton } from "@/foundation/components/ShowButton";
import { Table, defaultSorters } from "@/foundation/components/Table";
import { useMetadataColumns } from "@/foundation/components/metadata-columns";
import { useTranslation } from "@/foundation/lib/i18n";
import { Edit, Trash2 } from "lucide-react";

const useRoleAssignmentColumns = () => {
  const { t } = useTranslation();
  return {
    workspace: (
      <Table.Column
        header={t("common.fields.workspace")}
        accessorKey="spec.workspace"
        id="workspace"
        enableHiding
        cell={({ row }) => {
          const { global, workspace } = row.original.spec;
          if (global) {
            return "*";
          }
          return (
            <ShowButton
              recordItemId={workspace}
              meta={{}}
              variant="link"
              resource="workspaces"
            >
              {workspace}
            </ShowButton>
          );
        }}
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
    user: (
      <Table.Column
        header={t("common.fields.user")}
        accessorKey="spec.user_id"
        id="user"
        enableHiding
        cell={({ row }) => {
          const { user_id } = row.original.spec;
          return <UserCell id={user_id} />;
        }}
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
        {roleAssignmentColumns.workspace}
        {roleAssignmentColumns.role}
        {roleAssignmentColumns.user}
        {metadataColumns.update_timestamp}
        {metadataColumns.creation_timestamp}
        {roleAssignmentColumns.action}
      </Table>
    </ListPage>
  );
};
