import { ListPage } from "@/components/business/ListPage";
import { Table } from "@/components/business/Table";
import { defaultSorters } from "@/components/business/Table";
import { useMetadataColumns } from "@/components/business/metadata-columns";
import { useWorkflowColumns } from "@/components/business/workflow-columns";

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
