import ImageRegistryStatus from "@/components/business/ImageRegistryStatus";
import type { BaseStatus } from "@/types";
import { useTranslate } from "@refinedev/core";
import { Table } from "..";

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
