import { Table } from "@/foundation/components/Table";
import type { BaseStatus } from "@/foundation/types";
import { useTranslate } from "@refinedev/core";
import ImageRegistryStatus from "./ImageRegistryStatus";

export const useImageRegistryColumns = () => {
  const t = useTranslate();
  return {
    status: (
      <Table.Column
        header={t("common.fields.status")}
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
  };
};
