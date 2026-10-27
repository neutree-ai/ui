import type { UserProfile } from "@/domains/user/types";
import { EmptyValue } from "@/foundation/components/EmptyValue";
import { ListPage } from "@/foundation/components/ListPage";
import { useMetadataColumns } from "@/foundation/components/metadata-columns";
import { defaultSorters, Table } from "@/foundation/components/Table";
import { useTranslation } from "@/foundation/lib/i18n";
import {
  profileDisplayName,
  profileEmail,
} from "@/foundation/lib/user-identity";

const useUserColumns = () => {
  const { t } = useTranslation();

  return {
    displayName: (
      <Table.Column
        header={t("user_profiles.fields.displayName")}
        accessorKey="metadata.display_name"
        id="display_name"
        enableHiding
        cell={({ row }) => profileDisplayName(row.original.metadata)}
      />
    ),
    email: (
      <Table.Column
        header={t("common.fields.email")}
        accessorKey="spec.email"
        id="email"
        enableHiding
        cell={({ row }) =>
          profileEmail(row.original as UserProfile) || <EmptyValue />
        }
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
        {userColumns.displayName}
        {userColumns.email}

        {metadataColumns.creation_timestamp}

        {metadataColumns.action}
      </Table>
    </ListPage>
  );
};
