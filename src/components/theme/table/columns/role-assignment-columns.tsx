import UserCell from "@/components/business/UserCell";
import { Table } from "..";
import { ShowButton } from "../../buttons";

export const useRoleAssignmentColumns = () => {
  return {
    workspace: (
      <Table.Column
        header={"Workspace"}
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
        header={"Role"}
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
        header={"User"}
        accessorKey="spec.user_id"
        id="user"
        enableHiding
        cell={({ row }) => {
          const { user_id } = row.original.spec;
          return <UserCell id={user_id} />;
        }}
      />
    ),
  };
};
