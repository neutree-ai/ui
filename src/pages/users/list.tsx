import { ListPage, Table } from "@/components/theme";
import { useMetadataColumns } from "@/components/theme/table/columns/metadata-columns";
import { useUserColumns } from "@/components/theme/table/columns/user-columns";
import { defaultSorters } from "@/components/theme/table/sorter";

export const UsersList = () => {
  const metadataColumns = useMetadataColumns({
    resource: "users",
    showExportAction: false, // 所有记录都不显示导出按钮
  });
  const userColumns = useUserColumns();

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
        {userColumns.email}
        {metadataColumns.creation_timestamp}
        {metadataColumns.update_timestamp}
        {metadataColumns.action}
      </Table>
    </ListPage>
  );
};
