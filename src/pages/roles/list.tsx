import { ListPage, Table } from "@/components/theme";
import { useMetadataColumns } from "@/components/theme/table/columns/metadata-columns";
import { useRoleColumns } from "@/components/theme/table/columns/role-columns";
import { defaultSorters } from "@/components/theme/table/sorter";

export const RolesList = () => {
  const metadataColumns = useMetadataColumns({
    resource: "roles",
    // 预设角色隐藏编辑/删除，但允许导出
    showEditAction: (original) => !original.spec?.preset_key,
    showDeleteAction: (original) => !original.spec?.preset_key,
    showExportAction: true,
  });
  const roleColumns = useRoleColumns();

  return (
    <ListPage>
      <Table
        enableSorting
        enableFilters
        refineCoreProps={{
          sorters: defaultSorters,
        }}
      >
        {roleColumns.name}
        {roleColumns.permissions}
        {metadataColumns.update_timestamp}
        {metadataColumns.creation_timestamp}
        {metadataColumns.action}
      </Table>
    </ListPage>
  );
};
