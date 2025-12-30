import { useTranslate } from "@refinedev/core";
import { Download, Trash2 } from "lucide-react";
import { Table } from "..";

export const useWorkspacesColumns = () => {
  const t = useTranslate();
  return {
    action: (
      <Table.Column
        accessorKey={"id"}
        id={"actions"}
        cell={({ row: { original } }) => (
          <Table.Actions>
            <Table.ExportYamlAction
              row={original}
              resource="workspaces"
              icon={<Download size={16} />}
            />
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
