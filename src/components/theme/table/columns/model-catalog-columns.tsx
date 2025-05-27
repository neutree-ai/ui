import type { ModelCatalogPhase } from "@/types";
import { Table } from "..";
import ModelCatalogStatus from "@/components/business/ModelCatalogStatus";

export const useModelCatalogColumns = () => {
  return {
    model: (
      <Table.Column
        header={"Model"}
        accessorKey="spec.model.name"
        id="model"
        enableHiding
      />
    ),
    engine: (
      <Table.Column
        header={"Engine"}
        accessorKey="spec.engine.engine"
        id="engine"
        enableHiding
      />
    ),
    status: (
      <Table.Column
        header={"Status"}
        accessorKey="status.phase"
        id="status"
        enableHiding
        cell={({ getValue }) => {
          const phase = getValue() as unknown as ModelCatalogPhase;
          return <ModelCatalogStatus phase={phase} />;
        }}
      />
    ),
  };
};
