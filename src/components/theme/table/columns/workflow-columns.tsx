import { Trash2 } from "lucide-react";
import { Table } from "..";

export const useWorkflowColumns = () => {
  return {
    action: (
      <Table.Column
        accessorKey={"id"}
        id={"actions"}
        cell={({ row: { original } }) => (
          <Table.Actions>
            <Table.DeleteAction
              title="Delete"
              row={original}
              resource="workspaces"
              icon={<Trash2 size={16} />}
            />
          </Table.Actions>
        )}
      />
    ),
  };
};
