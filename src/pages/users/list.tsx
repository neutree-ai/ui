import { useMetadataColumns } from "@/components/business/metadata-columns";
import { useUserColumns } from "@/components/business/user-columns";
import { ListPage, Table } from "@/components/theme";
import { defaultSorters } from "@/components/theme/table";

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
