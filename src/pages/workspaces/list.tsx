import { Trash2 } from "lucide-react";
import { WORKSPACE_NAME_FIELD } from "@/foundation/hooks/use-workspace";
import { useTranslation } from "@/foundation/lib/i18n";
import { ListPage } from "@/foundation/scene/ListPage";
import { useMetadataColumns } from "@/foundation/scene/metadata-columns";
import { defaultSorters, Table } from "@/foundation/scene/Table";

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
        searchField={WORKSPACE_NAME_FIELD}
        refineCoreProps={{
          sorters: defaultSorters,
        }}
      >
        {metadataColumns.name}
        {metadataColumns.creation_timestamp}
        {workspaceColumns.action}
      </Table>
    </ListPage>
  );
};
