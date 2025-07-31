import { ListPage, Table } from "@/components/theme";
import { useClusterColumns } from "@/components/theme/table/columns/cluster-columns";
import { useMetadataColumns } from "@/components/theme/table/columns/metadata-columns";
import { defaultSorters } from "@/components/theme/table/sorter";

export const ClustersList = () => {
  const metadataColumns = useMetadataColumns();
  const clusterColumns = useClusterColumns();

  return (
    <ListPage>
      <Table
        enableSorting
        enableFilters
        refineCoreProps={{
          sorters: defaultSorters,
        }}
      >
        {metadataColumns.name}
        {metadataColumns.workspace}
        {clusterColumns.status}
        {clusterColumns.type}
        {clusterColumns.image_registry}
        {metadataColumns.action}
      </Table>
    </ListPage>
  );
};
