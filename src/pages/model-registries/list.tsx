import {
  ModelRegistryModelCount,
  ModelRegistryStorage,
} from "@/domains/model-registry/components/ModelRegistryStats";
import ModelRegistryStatus from "@/domains/model-registry/components/ModelRegistryStatus";
import ModelRegistryType from "@/domains/model-registry/components/ModelRegistryType";
import type { ModelRegistry } from "@/domains/model-registry/types";
import { ListPage } from "@/foundation/components/ListPage";
import { useMetadataColumns } from "@/foundation/components/metadata-columns";
import { defaultSorters, Table } from "@/foundation/components/Table";
import { useTranslation } from "@/foundation/lib/i18n";
import type { BaseStatus } from "@/foundation/types/basic-types";

export const ModelRegistriesList = () => {
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
              <ModelRegistryStatus {...(getValue() as unknown as BaseStatus)} />
            );
          }}
        />
        <Table.Column
          header={t("common.fields.type")}
          accessorKey="spec.type"
          id="type"
          enableHiding
          cell={({ getValue }) => {
            const value = String(getValue());
            return <ModelRegistryType type={value} />;
          }}
        />
        <Table.Column
          header={t("model_registries.stats.modelCount")}
          accessorKey="status.stats.model_count"
          id="model_count"
          enableHiding
          cell={({ row }) => (
            <ModelRegistryModelCount registry={row.original as ModelRegistry} />
          )}
        />
        <Table.Column
          header={t("model_registries.stats.storage")}
          accessorKey="status.stats.storage_bytes"
          id="storage_bytes"
          enableHiding
          cell={({ row }) => (
            <ModelRegistryStorage registry={row.original as ModelRegistry} />
          )}
        />
        {metadataColumns.creation_timestamp}
        {metadataColumns.action}
      </Table>
    </ListPage>
  );
};
