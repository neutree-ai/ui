import { ListPage } from "@/foundation/components/ListPage";
import { Table } from "@/foundation/components/Table";
import { defaultSorters } from "@/foundation/components/Table";
import { useMetadataColumns } from "@/foundation/components/metadata-columns";
import { useRoleAssignmentColumns } from "./columns";

export const RoleAssignmentsList = () => {
  const metadataColumns = useMetadataColumns();
  const roleAssignmentColumns = useRoleAssignmentColumns();

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
        {roleAssignmentColumns.workspace}
        {roleAssignmentColumns.role}
        {roleAssignmentColumns.user}
        {metadataColumns.update_timestamp}
        {metadataColumns.creation_timestamp}
        {roleAssignmentColumns.action}
      </Table>
    </ListPage>
  );
};
