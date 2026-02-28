import { ListPage } from "@/components/business/ListPage";
import { ModelTaskFilter } from "@/components/business/ModelTaskFilter";
import { Table } from "@/components/business/Table";
import { defaultSorters } from "@/components/business/Table";
import { useMetadataColumns } from "@/components/business/metadata-columns";
import { useModelCatalogColumns } from "@/components/business/model-catalog-columns";

export const ModelCatalogsList = () => {
  const metadataColumns = useMetadataColumns();
  const modelCatalogColumns = useModelCatalogColumns();

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
        filters={({ filters, setFilters }) => (
          <ModelTaskFilter filters={filters} setFilters={setFilters} />
        )}
      >
        {metadataColumns.name}
        {metadataColumns.workspace}
        {modelCatalogColumns.model}
        {modelCatalogColumns.task}
        {modelCatalogColumns.engine}
        {modelCatalogColumns.status}
        {metadataColumns.update_timestamp}
        {metadataColumns.creation_timestamp}
        {modelCatalogColumns.action}
      </Table>
    </ListPage>
  );
};
