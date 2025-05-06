import { ListPage, Table } from "@/components/theme";
import { useMetadataColumns } from "@/components/theme/table/columns/metadata-columns";
import { useModelRegistryColumns } from "@/components/theme/table/columns/model-registry-columns";

export const ModelRegistriesList = () => {
  const metadataColumns = useMetadataColumns();
  const modelRegistryColumns = useModelRegistryColumns();

  return (
    <ListPage>
      <Table enableSorting enableFilters>
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
