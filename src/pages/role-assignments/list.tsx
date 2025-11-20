import { ListPage, Table } from "@/components/theme";
import { useMetadataColumns } from "@/components/theme/table/columns/metadata-columns";
import { useRoleAssignmentColumns } from "@/components/theme/table/columns/role-assignment-columns";
import { defaultSorters } from "@/components/theme/table/sorter";

export const RoleAssignmentsList = () => {
  const metadataColumns = useMetadataColumns();
  const roleAssignmentColumns = useRoleAssignmentColumns();

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
