import { ListPage } from "@/foundation/components/ListPage";
import { Table } from "@/foundation/components/Table";
import { defaultSorters } from "@/foundation/components/Table";
import { useMetadataColumns } from "@/foundation/components/metadata-columns";
import { useRoleColumns } from "./columns";

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
