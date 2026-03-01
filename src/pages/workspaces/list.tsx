import { ListPage } from "@/foundation/components/ListPage";
import { Table } from "@/foundation/components/Table";
import { defaultSorters } from "@/foundation/components/Table";
import { useMetadataColumns } from "@/foundation/components/metadata-columns";
import { useTranslation } from "@/foundation/lib/i18n";
import { Trash2 } from "lucide-react";

const useWorkspaceColumns = () => {
  const { t } = useTranslation();

  return {
    action: (
      <Table.Column
        accessorKey={"id"}
        id={"actions"}
        cell={({ row: { original } }) => (
          <Table.Actions>
            <Table.DeleteAction
              title={t("buttons.delete")}
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

export const WorkspacesList = () => {
  const metadataColumns = useMetadataColumns();
  const workspaceColumns = useWorkspaceColumns();

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
        {metadataColumns.update_timestamp}
        {metadataColumns.creation_timestamp}
        {workspaceColumns.action}
      </Table>
    </ListPage>
  );
};
