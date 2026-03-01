import ClusterStatus from "@/domains/cluster/components/ClusterStatus";
import ClusterType from "@/domains/cluster/components/ClusterType";
import { ListPage } from "@/foundation/components/ListPage";
import { ShowButton } from "@/foundation/components/ShowButton";
import { Table } from "@/foundation/components/Table";
import { defaultSorters } from "@/foundation/components/Table";
import { useMetadataColumns } from "@/foundation/components/metadata-columns";
import type { BaseStatus } from "@/foundation/types/basic-types";
import { useTranslate } from "@refinedev/core";

export const ClustersList = () => {
  const t = useTranslate();
  const metadataColumns = useMetadataColumns();

  return (
    <ListPage>
      <Table
        enableSorting
        enableFilters
        enableBatchDelete
        searchField="metadata->>name"
        refineCoreProps={{
          sorters: defaultSorters,
        }}
      >
        {metadataColumns.name}
        {metadataColumns.workspace}
        <Table.Column
          header={t("common.fields.status")}
          accessorKey="status"
          id="status"
          enableHiding
          cell={({ getValue }) => {
            return <ClusterStatus {...(getValue() as unknown as BaseStatus)} />;
          }}
        />
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
        {metadataColumns.update_timestamp}
        {metadataColumns.creation_timestamp}
        {metadataColumns.action}
      </Table>
    </ListPage>
  );
};
