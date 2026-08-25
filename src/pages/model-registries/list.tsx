import {
  ModelRegistryModelCount,
  ModelRegistryStorage,
} from "@/domains/model-registry/components/ModelRegistryStats";
import ModelRegistryStatus from "@/domains/model-registry/components/ModelRegistryStatus";
import ModelRegistryType from "@/domains/model-registry/components/ModelRegistryType";
import { ModelRegistryWriteActions } from "@/domains/model-registry/components/ModelRegistryWriteActions";
import { RegistryTypeFilter } from "@/domains/model-registry/components/RegistryTypeFilter";
import { RegistryVisibility } from "@/domains/model-registry/components/RegistryVisibility";
import type { ModelRegistry } from "@/domains/model-registry/types";
import { ListPage } from "@/foundation/components/ListPage";
import { useMetadataColumns } from "@/foundation/components/metadata-columns";
import { defaultSorters, Table } from "@/foundation/components/Table";
import { useTranslation } from "@/foundation/lib/i18n";
import {
  MODEL_REGISTRY_SELECT,
  MODEL_REGISTRY_VISIBILITY_FIELD,
} from "@/foundation/lib/model-registry-visibility";
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
          // `visibility` is a computed field: filterable and selectable, and
          // absent from `select=*`. Both the column and the counters below read
          // it, so it has to be asked for by name.
          meta: { select: MODEL_REGISTRY_SELECT },
        }}
        filters={({ filters, setFilters }) => (
          <RegistryTypeFilter filters={filters} setFilters={setFilters} />
        )}
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
          header={t("model_registries.fields.visibility")}
          accessorKey={MODEL_REGISTRY_VISIBILITY_FIELD}
          id="visibility"
          enableHiding
          cell={({ row }) => (
            <RegistryVisibility
              visibility={(row.original as ModelRegistry).visibility}
            />
          )}
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
        <Table.Column
          accessorKey="id"
          id="actions"
          cell={({ row }) => (
            <ModelRegistryWriteActions
              registry={row.original as ModelRegistry}
            />
          )}
        />
      </Table>
    </ListPage>
  );
};
