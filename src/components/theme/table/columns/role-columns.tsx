import { Edit, Lock, Trash2 } from "lucide-react";
import { Table } from "..";
import { ShowButton } from "../../buttons";

export const useRoleColumns = () => {
  return {
    name: (
      <Table.Column
        header={"Name"}
        accessorKey="metadata.name"
        id="name"
        enableHiding
        cell={({ row }) => {
          const { name } = row.original.metadata;
          const isPreset = Boolean(row.original.spec.preset_key);
          return (
            <div className="flex items-center">
              {isPreset && <Lock size={16} className="mr-1" />}
              <ShowButton
                recordItemId={row.original.metadata.name}
                meta={{}}
                variant="link"
              >
                {name}
              </ShowButton>
            </div>
          );
        }}
      />
    ),
    permissions: (
      <Table.Column
        header={"Permissions"}
        accessorKey="spec.permissions"
        id="permissions"
        enableHiding
        cell={({ getValue }) => {
          const value = getValue() as unknown as string[];
          return `${value.length} permissions`;
        }}
      />
    ),
    action: (
      <Table.Column
        accessorKey={"id"}
        id={"actions"}
        cell={({ row: { original } }) => {
          const isPreset = Boolean(original.spec.preset_key);
          if (isPreset) {
            return null;
          }
          return (
            <Table.Actions>
              <Table.EditAction
                title="Edit"
                row={original}
                resource="roles"
                icon={<Edit size={16} />}
              />
              <Table.DeleteAction
                title="Delete"
                row={original}
                resource="roles"
                icon={<Trash2 size={16} />}
              />
            </Table.Actions>
          );
        }}
      />
    ),
  };
};
