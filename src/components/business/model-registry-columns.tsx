import ModelRegistryStatus from "@/components/business/ModelRegistryStatus";
import ModelRegistryType from "@/components/business/ModelRegistryType";
import { Table } from "@/components/business/Table";
import type { BaseStatus } from "@/types";
import { useTranslate } from "@refinedev/core";

export const useModelRegistryColumns = () => {
  const t = useTranslate();
  return {
    type: (
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
    ),
    status: (
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
    ),
  };
};
