import ClusterStatus from "@/domains/cluster/components/ClusterStatus";
import ClusterType from "@/domains/cluster/components/ClusterType";
import { ShowButton } from "@/foundation/components/ShowButton";
import { Table } from "@/foundation/components/Table";
import type { BaseStatus } from "@/foundation/types/basic-types";
import { useTranslate } from "@refinedev/core";

export const useClusterColumns = () => {
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
          return <ClusterType type={value} />;
        }}
      />
    ),
    image_registry: (
      <Table.Column
        header={t("common.fields.imageRegistry")}
        accessorKey="spec.image_registry"
        id="registry"
        enableHiding
        cell={({ row }) => {
          const { spec, metadata } = row.original;
          return (
            <ShowButton
              recordItemId={spec.image_registry}
              meta={{
                workspace: metadata.workspace,
              }}
              variant="link"
              resource="image_registries"
            >
              {spec.image_registry}
            </ShowButton>
          );
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
          return <ClusterStatus {...(getValue() as unknown as BaseStatus)} />;
        }}
      />
    ),
  };
};
