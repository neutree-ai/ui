import { ModelTaskFilter } from "@/components/business/ModelTaskFilter";
import { ListPage, Table } from "@/components/theme";
import { useMetadataColumns } from "@/components/theme/table/columns/metadata-columns";
import { useModelCatalogColumns } from "@/components/theme/table/columns/model-catalog-columns";
import { defaultSorters } from "@/components/theme/table/sorter";

export const ModelCatalogsList = () => {
  const metadataColumns = useMetadataColumns();
  const modelCatalogColumns = useModelCatalogColumns();

  return (
    <ListPage canCreate={false}>
      <Table
        enableSorting
        enableFilters
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
