import { useMetadataColumns } from "@/components/business/metadata-columns";
import { useRoleColumns } from "@/components/business/role-columns";
import { ListPage, Table } from "@/components/theme";
import { defaultSorters } from "@/components/theme/table";

export const RolesList = () => {
  const metadataColumns = useMetadataColumns();
  const roleColumns = useRoleColumns();

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
        {roleColumns.name}
        {roleColumns.permissions}

        {metadataColumns.update_timestamp}
        {metadataColumns.creation_timestamp}
        {roleColumns.action}
      </Table>
    </ListPage>
  );
};
