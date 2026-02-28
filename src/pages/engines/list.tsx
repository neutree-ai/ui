import { useEngineColumns } from "@/components/business/engine-columns";
import { useMetadataColumns } from "@/components/business/metadata-columns";
import { ListPage, Table } from "@/components/theme";
import { defaultSorters } from "@/components/theme/table";

export const EnginesList = () => {
  const metadataColumns = useMetadataColumns();
  const engineColumns = useEngineColumns();

  return (
    <ListPage canCreate={false}>
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
        {metadataColumns.workspace}
        {engineColumns.status}
        {engineColumns.versions}
        {metadataColumns.update_timestamp}
        {metadataColumns.creation_timestamp}
      </Table>
    </ListPage>
  );
};
