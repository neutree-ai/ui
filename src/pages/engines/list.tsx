import EngineStatus from "@/domains/engine/components/EngineStatus";
import EngineVersions from "@/domains/engine/components/EngineVersions";
import type { EngineVersion } from "@/domains/engine/types";
import { ListPage } from "@/foundation/components/ListPage";
import { useMetadataColumns } from "@/foundation/components/metadata-columns";
import { defaultSorters, Table } from "@/foundation/components/Table";
import { useTranslation } from "@/foundation/lib/i18n";
import type { BaseStatus } from "@/foundation/types/basic-types";

export const EnginesList = () => {
  const { t } = useTranslation();
  const metadataColumns = useMetadataColumns();

  return (
    <ListPage canCreate={false}>
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
            return <EngineStatus {...(getValue() as unknown as BaseStatus)} />;
          }}
        />
        <Table.Column
          header={t("common.fields.versions")}
          accessorKey="spec.versions"
          id="version"
          enableHiding
          cell={({ getValue }) => {
            return (
              <EngineVersions
                versions={getValue() as unknown as EngineVersion[]}
              />
            );
          }}
        />
        {metadataColumns.update_timestamp}
        {metadataColumns.creation_timestamp}
      </Table>
    </ListPage>
  );
};
