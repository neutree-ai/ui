import UserCell from "@/components/business/UserCell";
import { useTranslate } from "@refinedev/core";
import { Download, Edit, Trash2 } from "lucide-react";
import { Table } from "..";
import { ShowButton } from "../../buttons";

export const useRoleAssignmentColumns = () => {
  const t = useTranslate();
  return {
    workspace: (
      <Table.Column
        header={t("table.column.workspace")}
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
        header={t("table.column.role")}
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
        header={t("table.column.user")}
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
          // admin-global-role-assignment不显示编辑和删除按钮
          const isAdminGlobalAssignment =
            original.metadata.name === "admin-global-role-assignment";

          return (
            <Table.Actions>
              <Table.ExportYamlAction
                row={original}
                resource="role_assignments"
                icon={<Download size={16} />}
              />
              {!isAdminGlobalAssignment && (
                <>
                  <Table.EditAction
                    title="Edit"
                    row={original}
                    resource="role_assignments"
                    icon={<Edit size={16} />}
                  />
                  <Table.DeleteAction
                    title="Delete"
                    row={original}
                    resource="role_assignments"
                    icon={<Trash2 size={16} />}
                  />
                </>
              )}
            </Table.Actions>
          );
        }}
      />
    ),
  };
};
