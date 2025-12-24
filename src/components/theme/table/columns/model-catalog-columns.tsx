import ModelCatalogStatus from "@/components/business/ModelCatalogStatus";
import ModelTask from "@/components/business/ModelTask";
import type { BaseStatus } from "@/types";
import { useTranslate } from "@refinedev/core";
import { Table } from "..";

export const useModelCatalogColumns = () => {
  const t = useTranslate();
  return {
    model: (
      <Table.Column
        header={t("table.column.model")}
        accessorKey="spec.model.name"
        id="model"
        enableHiding
      />
    ),
    task: (
      <Table.Column
        header={t("table.column.task")}
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
        header={t("table.column.engine")}
        accessorKey="spec.engine.engine"
        id="engine"
        enableHiding
      />
    ),
    status: (
      <Table.Column
        header={t("table.column.status")}
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
  };
};
