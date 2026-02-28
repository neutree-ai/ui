import { useMetadataColumns } from "@/components/business/metadata-columns";
import { useRoleAssignmentColumns } from "@/components/business/role-assignment-columns";
import { ListPage, Table } from "@/components/theme";
import { defaultSorters } from "@/components/theme/table";

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
