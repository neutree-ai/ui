import ModelRegistryStatus from "@/components/business/ModelRegistryStatus";
import ModelRegistryType from "@/components/business/ModelRegistryType";
import type { BaseStatus } from "@/types";
import { useTranslate } from "@refinedev/core";
import { Download, Edit, Trash2 } from "lucide-react";
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
    action: (
      <Table.Column
        accessorKey={"id"}
        id={"actions"}
        cell={({ row: { original } }) => (
          <Table.Actions>
            <Table.ExportYamlAction
              row={original}
              resource="model_registries"
              icon={<Download size={16} />}
            />
            <Table.EditAction
              title={t("buttons.edit")}
              row={original}
              resource="model_registries"
              icon={<Edit size={16} />}
            />
            <Table.DeleteAction
              title={t("buttons.delete")}
              row={original}
              resource="model_registries"
              icon={<Trash2 size={16} />}
            />
          </Table.Actions>
        )}
      />
    ),
  };
};
