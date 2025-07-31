import ModelRegistryStatus from "@/components/business/ModelRegistryStatus";
import ModelRegistryType from "@/components/business/ModelRegistryType";
import type { ModelRegistryPhase } from "@/types";
import { useTranslate } from "@refinedev/core";
import { Table } from "..";

export const useModelRegistryColumns = () => {
  const t = useTranslate();
  return {
    type: (
      <Table.Column
        header={t("table.column.type")}
        accessorKey="spec.type"
        id="type"
        enableHiding
        cell={({ getValue }) => {
          const value = String(getValue());
          return <ModelRegistryType type={value} />;
        }}
      />
    ),
    status: (
      <Table.Column
        header={t("table.column.status")}
        accessorKey="status.phase"
        id="status"
        enableHiding
        cell={({ getValue }) => {
          return (
            <ModelRegistryStatus
              phase={getValue() as unknown as ModelRegistryPhase}
            />
          );
        }}
      />
    ),
  };
};
