import ImageRegistryStatus from "@/domains/image-registry/components/ImageRegistryStatus";
import { Table } from "@/foundation/components/Table";
import type { BaseStatus } from "@/foundation/types/basic-types";
import { useTranslate } from "@refinedev/core";

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
