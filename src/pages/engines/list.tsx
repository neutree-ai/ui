import { ListPage } from "@/foundation/components/ListPage";
import { Table } from "@/foundation/components/Table";
import { defaultSorters } from "@/foundation/components/Table";
import { useMetadataColumns } from "@/foundation/components/metadata-columns";
import { useEngineColumns } from "./columns";

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
