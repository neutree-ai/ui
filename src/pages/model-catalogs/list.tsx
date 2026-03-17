import { Trash2 } from "lucide-react";
import EndpointEngine from "@/domains/endpoint/components/EndpointEngine";
import EndpointModel from "@/domains/endpoint/components/EndpointModel";
import ModelTask from "@/domains/endpoint/components/ModelTask";
import { ModelTaskFilter } from "@/domains/endpoint/components/ModelTaskFilter";
import ModelCatalogStatus from "@/domains/model-catalog/components/ModelCatalogStatus";
import { ListPage } from "@/foundation/components/ListPage";
import { useMetadataColumns } from "@/foundation/components/metadata-columns";
import { defaultSorters, Table } from "@/foundation/components/Table";
import { useTranslation } from "@/foundation/lib/i18n";
import type { BaseStatus } from "@/foundation/types/basic-types";

export const ModelCatalogsList = () => {
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
        filters={({ filters, setFilters }) => (
          <ModelTaskFilter filters={filters} setFilters={setFilters} />
        )}
      >
        {metadataColumns.name}
        {metadataColumns.workspace}
        <Table.Column
          header={t("common.fields.model")}
          accessorKey="spec.model.name"
          id="model"
          enableHiding
          cell={({ row }) => {
            const { model } = row.original.spec;
            return <EndpointModel model={model} />;
          }}
        />
        <Table.Column
          header={t("common.fields.task")}
          accessorKey="spec.model.task"
          id="task"
          enableHiding
          cell={({ row }) => {
            const { model } = row.original.spec;
            return <ModelTask task={model.task} />;
          }}
        />
        <Table.Column
          header={t("common.fields.engine")}
          accessorKey="spec.engine.engine"
          id="engine"
          enableHiding
          cell={({ row }) => {
            const { spec, metadata } = row.original;
            return <EndpointEngine spec={spec} metadata={metadata} />;
          }}
        />
        <Table.Column
          header={t("common.fields.status")}
          accessorKey="status"
          id="status"
          enableHiding
          cell={({ getValue }) => {
            return (
              <ModelCatalogStatus {...(getValue() as unknown as BaseStatus)} />
            );
          }}
        />
        {metadataColumns.update_timestamp}
        {metadataColumns.creation_timestamp}
        <Table.Column
          accessorKey={"id"}
          id={"actions"}
          cell={({ row: { original } }) => (
            <Table.Actions>
              <Table.DeleteAction
                title={t("buttons.delete")}
                row={original}
                resource="model_catalogs"
                icon={<Trash2 size={16} />}
              />
            </Table.Actions>
          )}
        />
      </Table>
    </ListPage>
  );
};
