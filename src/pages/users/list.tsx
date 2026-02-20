import { ListPage, Table } from "@/components/theme";
import { useMetadataColumns } from "@/components/theme/table/columns/metadata-columns";
import { useUserColumns } from "@/components/theme/table/columns/user-columns";
import { defaultSorters } from "@/components/theme/table/sorter";

export const UsersList = () => {
  const metadataColumns = useMetadataColumns();
  const userColumns = useUserColumns();

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
        {userColumns.email}

        {metadataColumns.creation_timestamp}
        {metadataColumns.update_timestamp}

        {metadataColumns.action}
      </Table>
    </ListPage>
  );
};
