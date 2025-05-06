import { ListPage, Table } from "@/components/theme";
import { useMetadataColumns } from "@/components/theme/table/columns/metadata-columns";
import { useUserColumns } from "@/components/theme/table/columns/user-columns";

export const UsersList = () => {
  const metadataColumns = useMetadataColumns();
  const userColumns = useUserColumns();

  return (
    <ListPage>
      <Table enableSorting enableFilters>
        {metadataColumns.name}
        {userColumns.email}

        {metadataColumns.creation_timestamp}
        {metadataColumns.update_timestamp}

        {metadataColumns.action}
      </Table>
    </ListPage>
  );
};
