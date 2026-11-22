import { useTranslation } from "@/foundation/lib/i18n";
import RegistryStatus from "@/foundation/role/RegistryStatus";
import { ListPage } from "@/foundation/scene/ListPage";
import { useMetadataColumns } from "@/foundation/scene/metadata-columns";
import { defaultSorters, Table } from "@/foundation/scene/Table";
import type { BaseStatus } from "@/foundation/types/basic-types";

export const ImageRegistriesList = () => {
  const { t } = useTranslation();
  const metadataColumns = useMetadataColumns();

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
        {metadataColumns.workspace}
        <Table.Column
          header={t("common.fields.status")}
          accessorKey="status"
          id="status"
          enableHiding
          cell={({ getValue }) => {
            return (
              <RegistryStatus {...(getValue() as unknown as BaseStatus)} />
            );
          }}
        />
        {metadataColumns.creation_timestamp}
        {metadataColumns.action}
      </Table>
    </ListPage>
  );
};
