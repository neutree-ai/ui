import { ListPage } from "@/components/business/ListPage";
import { Table } from "@/components/business/Table";
import { defaultSorters } from "@/components/business/Table";
import { useImageRegistryColumns } from "@/components/business/image-registry-columns";
import { useMetadataColumns } from "@/components/business/metadata-columns";

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
