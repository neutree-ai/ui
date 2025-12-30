import ImageRegistryStatus from "@/components/business/ImageRegistryStatus";
import type { BaseStatus } from "@/types";
import { useTranslate } from "@refinedev/core";
import { Download, Edit, Trash2 } from "lucide-react";
import { Table } from "..";

export const useImageRegistryColumns = () => {
  const t = useTranslate();
  return {
    status: (
      <Table.Column
        header={t("table.column.status")}
        accessorKey="status"
        id="status"
        enableHiding
        cell={({ getValue }) => {
          return (
            <ImageRegistryStatus {...(getValue() as unknown as BaseStatus)} />
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
              resource="image_registries"
              icon={<Download size={16} />}
            />
            <Table.EditAction
              title={t("buttons.edit")}
              row={original}
              resource="image_registries"
              icon={<Edit size={16} />}
            />
            <Table.DeleteAction
              title={t("buttons.delete")}
              row={original}
              resource="image_registries"
              icon={<Trash2 size={16} />}
            />
          </Table.Actions>
        )}
      />
    ),
  };
};
