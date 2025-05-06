import { ListPage, Table } from "@/components/theme";
import { useMetadataColumns } from "@/components/theme/table/columns/metadata-columns";
import { useClusterColumns } from "@/components/theme/table/columns/cluster-columns";

export const ClustersList = () => {
  const metadataColumns = useMetadataColumns();
  const clusterColumns = useClusterColumns();

  return (
    <ListPage>
      <Table enableSorting enableFilters>
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
