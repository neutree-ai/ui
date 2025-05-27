import { ListPage, Table } from "@/components/theme";
import { useMetadataColumns } from "@/components/theme/table/columns/metadata-columns";
import { useModelCatalogColumns } from "@/components/theme/table/columns/model-catalog-columns";

export const ModelCatalogsList = () => {
  const metadataColumns = useMetadataColumns();
  const modelCatalogColumns = useModelCatalogColumns();

  return (
    <ListPage canCreate={false}>
      <Table enableSorting enableFilters>
        {metadataColumns.name}
        {metadataColumns.workspace}
        {modelCatalogColumns.model}
        {modelCatalogColumns.engine}
        {modelCatalogColumns.status}
        {metadataColumns.update_timestamp}
        {metadataColumns.creation_timestamp}
      </Table>
    </ListPage>
  );
};
