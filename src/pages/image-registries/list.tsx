import { useImageRegistryColumns } from "@/components/business/image-registry-columns";
import { useMetadataColumns } from "@/components/business/metadata-columns";
import { ListPage, Table } from "@/components/theme";
import { defaultSorters } from "@/components/theme/table";

export const ImageRegistriesList = () => {
  const metadataColumns = useMetadataColumns();
  const imageRegistryColumns = useImageRegistryColumns();

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
        {imageRegistryColumns.status}
        {metadataColumns.update_timestamp}
        {metadataColumns.creation_timestamp}
        {metadataColumns.action}
      </Table>
    </ListPage>
  );
};
