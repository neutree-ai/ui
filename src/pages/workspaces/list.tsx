import { useMetadataColumns } from "@/components/business/metadata-columns";
import { useWorkflowColumns } from "@/components/business/workflow-columns";
import { ListPage, Table } from "@/components/theme";
import { defaultSorters } from "@/components/theme/table";

export const WorkspacesList = () => {
  const metadataColumns = useMetadataColumns();
  const workflowColumns = useWorkflowColumns();

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
        {metadataColumns.update_timestamp}
        {metadataColumns.creation_timestamp}
        {workflowColumns.action}
      </Table>
    </ListPage>
  );
};
