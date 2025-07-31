import ImageRegistryStatus from "@/components/business/ImageRegistryStatus";
import type { ImageRegistryPhase } from "@/types";
import { useTranslate } from "@refinedev/core";
import { Table } from "..";

export const useImageRegistryColumns = () => {
  const t = useTranslate();
  return {
    status: (
      <Table.Column
        header={t("table.column.status")}
        accessorKey="status.phase"
        id="status"
        enableHiding
        cell={({ getValue }) => {
          return (
            <ImageRegistryStatus
              phase={getValue() as unknown as ImageRegistryPhase}
            />
          );
        }}
      />
    ),
  };
};
