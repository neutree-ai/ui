import { useTranslate } from "@refinedev/core";
import { Edit, Lock, Trash2 } from "lucide-react";
import { Table } from "..";
import { ShowButton } from "../../buttons";

export const useRoleColumns = () => {
  const t = useTranslate();
  return {
    name: (
      <Table.Column
        header={t("table.column.name")}
        accessorKey="metadata.name"
        id="name"
        enableHiding
        cell={({ row }) => {
          const { name } = row.original.metadata;
          const isPreset = Boolean(row.original.spec.preset_key);
          return (
            <div className="flex items-center">
              {isPreset && <Lock size={16} className="mr-1" />}
              <ShowButton
                recordItemId={row.original.metadata.name}
                meta={{}}
                variant="link"
              >
                {name}
              </ShowButton>
            </div>
          );
        }}
      />
    ),
    permissions: (
      <Table.Column
        header={t("table.column.permissions")}
        accessorKey="spec.permissions"
        id="permissions"
        enableHiding
        cell={({ getValue }) => {
          const value = getValue() as unknown as string[];
          return t("table.column.permissionsCount", { count: value.length });
        }}
      />
    ),
  };
};
