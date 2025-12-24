import { ListPage, Table } from "@/components/theme";
import { useMetadataColumns } from "@/components/theme/table/columns/metadata-columns";
import { useRoleAssignmentColumns } from "@/components/theme/table/columns/role-assignment-columns";
import { defaultSorters } from "@/components/theme/table/sorter";

export const RoleAssignmentsList = () => {
  const metadataColumns = useMetadataColumns({
    resource: "role_assignments",
    showEditAction: (original) => {
      // admin-global-role-assignment不显示编辑按钮
      const isAdminGlobalAssignment =
        original.metadata.name === "admin-global-role-assignment";
      return !isAdminGlobalAssignment;
    },
    showDeleteAction: (original) => {
      // admin-global-role-assignment不显示删除按钮
      const isAdminGlobalAssignment =
        original.metadata.name === "admin-global-role-assignment";
      return !isAdminGlobalAssignment;
    },
    showExportAction: true, // 所有记录都显示导出按钮
  });
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
        {metadataColumns.action}
      </Table>
    </ListPage>
  );
};
