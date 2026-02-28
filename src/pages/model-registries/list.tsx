import { ListPage } from "@/components/business/ListPage";
import { Table } from "@/components/business/Table";
import { defaultSorters } from "@/components/business/Table";
import { useMetadataColumns } from "@/components/business/metadata-columns";
import { useModelRegistryColumns } from "@/components/business/model-registry-columns";

export const ModelRegistriesList = () => {
  const metadataColumns = useMetadataColumns();
  const modelRegistryColumns = useModelRegistryColumns();

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
        {metadataColumns.workspace}

        {modelRegistryColumns.status}
        {modelRegistryColumns.type}

        {metadataColumns.update_timestamp}
        {metadataColumns.creation_timestamp}
        {metadataColumns.action}
      </Table>
    </ListPage>
  );
};
