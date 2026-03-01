import { ListPage } from "@/foundation/components/ListPage";
import { Table } from "@/foundation/components/Table";
import { defaultSorters } from "@/foundation/components/Table";
import { useMetadataColumns } from "@/foundation/components/metadata-columns";
import { useTranslation } from "@/foundation/lib/i18n";

const useUserColumns = () => {
  const { t } = useTranslation();

  return {
    email: (
      <Table.Column
        header={t("common.fields.email")}
        accessorKey="spec.email"
        id="email"
        enableHiding
      />
    ),
  };
};

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
