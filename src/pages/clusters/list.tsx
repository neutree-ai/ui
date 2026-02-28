import { useClusterColumns } from "@/components/business/cluster-columns";
import { useMetadataColumns } from "@/components/business/metadata-columns";
import { ListPage, Table } from "@/components/theme";
import { defaultSorters } from "@/components/theme/table";

export const ClustersList = () => {
  const metadataColumns = useMetadataColumns();
  const clusterColumns = useClusterColumns();

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
        {clusterColumns.status}
        {clusterColumns.type}
        {clusterColumns.image_registry}
        {metadataColumns.update_timestamp}
        {metadataColumns.creation_timestamp}
        {metadataColumns.action}
      </Table>
    </ListPage>
  );
};
