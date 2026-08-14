import { Badge } from "@/components/ui/badge";
import ClusterStatus from "@/domains/cluster/components/ClusterStatus";
import ClusterType from "@/domains/cluster/components/ClusterType";
import {
  ClusterUpgradeAction,
  ClusterUpgradeProvider,
} from "@/domains/cluster/components/ClusterUpgradeAction";
import { ClusterUpgradeTip } from "@/domains/cluster/components/ClusterUpgradeTip";
import { isAcceleratorVirtualizationEnabled } from "@/domains/cluster/lib/accelerator-virtualization";
import type { Cluster } from "@/domains/cluster/types";
import { ListPage } from "@/foundation/components/ListPage";
import { useMetadataColumns } from "@/foundation/components/metadata-columns";
import { ShowButton } from "@/foundation/components/ShowButton";
import { defaultSorters, Table } from "@/foundation/components/Table";
import { useTranslation } from "@/foundation/lib/i18n";
import type { BaseStatus } from "@/foundation/types/basic-types";

export const ClustersList = () => {
  const { t } = useTranslation();
  const metadataColumns = useMetadataColumns({
    extraActions: (row) => <ClusterUpgradeAction cluster={row as Cluster} />,
  });

  return (
    <ClusterUpgradeProvider>
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
              return (
                <ClusterStatus {...(getValue() as unknown as BaseStatus)} />
              );
            }}
          />
          <Table.Column
            header={t("common.fields.version")}
            accessorKey="status.version"
            id="version"
            enableHiding
            cell={({ row }) => {
              const cluster = row.original as Cluster;
              const version = cluster.status?.version;
              if (!version) return "-";
              if (
                cluster.status?.phase === "Upgrading" &&
                cluster.spec.version
              ) {
                return (
                  <span className="inline-flex items-center">
                    {version}{" "}
                    <span className="text-muted-foreground">
                      &rarr; {cluster.spec.version}
                    </span>
                  </span>
                );
              }
              return (
                <span className="inline-flex items-center">
                  {version}
                  <ClusterUpgradeTip cluster={cluster} />
                </span>
              );
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
            header={() => (
              <span className="inline-flex flex-col leading-tight">
                {t("clusters.fields.acceleratorVirtualization")
                  .split(" ")
                  .map((word, index) => (
                    <span key={`${word}-${index}`}>{word}</span>
                  ))}
              </span>
            )}
            viewOptionsLabel={t("clusters.fields.acceleratorVirtualization")}
            accessorKey="spec.accelerator_virtualization"
            id="accelerator_virtualization"
            enableHiding
            cell={({ row }) => {
              const enabled = isAcceleratorVirtualizationEnabled(
                row.original as Cluster,
              );
              return (
                <Badge
                  variant="outline"
                  className={
                    enabled
                      ? "border-[var(--nt-stroke-positive-light)] bg-[var(--nt-fill-positive-light)] text-[var(--nt-text-colorful-positive)]"
                      : "border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-opaque-1)] text-[var(--nt-text-neutral-secondary)]"
                  }
                  title={t("clusters.fields.acceleratorVirtualization")}
                >
                  {enabled
                    ? t("common.options.enabled")
                    : t("common.options.disabled")}
                </Badge>
              );
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
          {metadataColumns.creation_timestamp}
          {metadataColumns.action}
        </Table>
      </ListPage>
    </ClusterUpgradeProvider>
  );
};
