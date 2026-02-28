import { ModelTaskFilter } from "@/domains/endpoint/components/ModelTaskFilter";
import { ListPage } from "@/foundation/components/ListPage";
import { Table } from "@/foundation/components/Table";
import { defaultSorters } from "@/foundation/components/Table";
import { useMetadataColumns } from "@/foundation/components/metadata-columns";
import { useModelCatalogColumns } from "./columns";

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
