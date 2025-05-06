import { ListPage, Table } from "@/components/theme";
import { useMetadataColumns } from "@/components/theme/table/columns/metadata-columns";
import { useWorkflowColumns } from "@/components/theme/table/columns/workflow-columns";

export const WorkspacesList = () => {
  const metadataColumns = useMetadataColumns();
  const workflowColumns = useWorkflowColumns();

  return (
    <ListPage>
      <Table enableSorting enableFilters>
        {metadataColumns.name}
        {metadataColumns.update_timestamp}
        {metadataColumns.creation_timestamp}
        {workflowColumns.action}
      </Table>
    </ListPage>
  );
};
