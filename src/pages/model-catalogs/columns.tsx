import EndpointEngine from "@/domains/endpoint/components/EndpointEngine";
import EndpointModel from "@/domains/endpoint/components/EndpointModel";
import ModelTask from "@/domains/endpoint/components/ModelTask";
import ModelCatalogStatus from "@/domains/model-catalog/components/ModelCatalogStatus";
import { Table } from "@/foundation/components/Table";
import type { BaseStatus } from "@/foundation/types/basic-types";
import { useTranslate } from "@refinedev/core";
import { Trash2 } from "lucide-react";

export const useModelCatalogColumns = () => {
  const t = useTranslate();
  return {
    model: (
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
    ),
    task: (
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
    ),
    engine: (
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
    ),
    status: (
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
    ),
    action: (
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
    ),
  };
};
