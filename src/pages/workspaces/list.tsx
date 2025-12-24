import { ListPage, Table } from "@/components/theme";
import { useMetadataColumns } from "@/components/theme/table/columns/metadata-columns";
import { defaultSorters } from "@/components/theme/table/sorter";

export const WorkspacesList = () => {
  const metadataColumns = useMetadataColumns({
    resource: "workspaces",
    showEditAction: false,
    showDeleteAction: true,
    showExportAction: true,
  });

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
        {metadataColumns.action}
      </Table>
    </ListPage>
  );
};
