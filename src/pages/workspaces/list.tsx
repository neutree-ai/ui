import { ListPage, Table } from "@/components/theme";
import { useMetadataColumns } from "@/components/theme/table/columns/metadata-columns";
import { useWorkspacesColumns } from "@/components/theme/table/columns/workspaces-columns";
import { defaultSorters } from "@/components/theme/table/sorter";

export const WorkspacesList = () => {
  const metadataColumns = useMetadataColumns({
    resource: "workspaces",
  });
  const workspacesColumns = useWorkspacesColumns();

  return (
    <ListPage>
      <Table
        enableSorting
        enableFilters
        refineCoreProps={{
          sorters: defaultSorters,
        }}
      >
        {metadataColumns.name}
        {metadataColumns.update_timestamp}
        {metadataColumns.creation_timestamp}
        {workspacesColumns.action}
      </Table>
    </ListPage>
  );
};
