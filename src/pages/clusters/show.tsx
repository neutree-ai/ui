import { useShow, useTranslation } from "@refinedev/core";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClusterResourceSummary } from "@/domains/cluster/components/ClusterResourceSummary";
import ClusterStatus from "@/domains/cluster/components/ClusterStatus";
import ClusterType from "@/domains/cluster/components/ClusterType";
import {
  ClusterUpgradeAction,
  ClusterUpgradeProvider,
} from "@/domains/cluster/components/ClusterUpgradeAction";
import { ClusterUpgradeTip } from "@/domains/cluster/components/ClusterUpgradeTip";
import { NodeResourcesTable } from "@/domains/cluster/components/NodeResourcesTable";
import { useClusterMonitorPanels } from "@/domains/cluster/hooks/use-cluster-monitor-panels";
import { isAcceleratorVirtualizationEnabled } from "@/domains/cluster/lib/accelerator-virtualization";
import { getAccessModeLabel } from "@/domains/cluster/lib/get-access-mode-label";
import { getCacheType } from "@/domains/cluster/lib/get-cache-type";
import { getRayDashboardProxy } from "@/domains/cluster/lib/get-ray-dashboard-proxy";
import type { Cluster } from "@/domains/cluster/types";
import EndpointEngine from "@/domains/endpoint/components/EndpointEngine";
import EndpointModel from "@/domains/endpoint/components/EndpointModel";
import type { Endpoint } from "@/domains/endpoint/types";
import EndpointStatus from "@/foundation/components/EndpointStatus";
import GrafanaDashboard from "@/foundation/components/GrafanaDashboard";
import { Loader } from "@/foundation/components/Loader";
import { useMetadataColumns } from "@/foundation/components/metadata-columns";
import { ResourceUsageLegend } from "@/foundation/components/ResourceUsageLegend";
import { ShowButton } from "@/foundation/components/ShowButton";
import { ShowPage } from "@/foundation/components/ShowPage";
import { Table } from "@/foundation/components/Table";
import Timestamp from "@/foundation/components/Timestamp";
import { useSystemApi } from "@/foundation/hooks/use-system-api";
import { getClusterSplitDashboardProps } from "@/foundation/lib/grafana-dashboard-configs";
import { useTranslation as useI18nTranslation } from "@/foundation/lib/i18n";
import type { BaseStatus } from "@/foundation/types/basic-types";

const detailTabTriggerClassName =
  "relative z-10 h-full rounded-none border-0 bg-transparent px-0 py-2 text-sm font-semibold text-muted-foreground shadow-none transition-colors after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent hover:bg-transparent hover:text-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:after:bg-primary data-[state=active]:hover:bg-transparent";

export const ClustersShow = () => {
  const {
    query: { data, isLoading },
  } = useShow<Cluster>();
  const record = data?.data;

  const { translate } = useTranslation();
  const { t } = useI18nTranslation();
  const { grafanaUrl } = useSystemApi();

  const metadataColumns = useMetadataColumns({ resource: "endpoints" });

  const { selectedPanel, showMonitorTab } = useClusterMonitorPanels();

  if (isLoading) {
    return <Loader className="h-4 text-primary" />;
  }

  if (!record) {
    return <div>{t("clusters.messages.notFound")}</div>;
  }

  const dashboardUrl = getRayDashboardProxy(data?.data);
  const acceleratorVirtualizationEnabled =
    isAcceleratorVirtualizationEnabled(record);
  return (
    <ClusterUpgradeProvider>
      <ShowPage
        record={record}
        showCurrentBreadcrumb={false}
        extraActions={(record) => (
          <ClusterUpgradeAction cluster={record as Cluster} />
        )}
      >
        <Tabs defaultValue="basic" className="flex h-full flex-col">
          <ShowPage.ObjectHeader
            title={record.metadata.name}
            descriptionClassName="max-w-none"
            description={
              <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-0.5">
                <ShowPage.Meta label={t("common.fields.type")}>
                  <ClusterType type={record.spec.type} />
                </ShowPage.Meta>
                <ShowPage.Meta label={t("common.fields.version")}>
                  <span className="inline-flex min-w-0 items-center">
                    {record.status?.version ?? "-"}
                    {record.status?.phase === "Upgrading" &&
                      record.spec.version && (
                        <span className="text-muted-foreground">
                          {" "}
                          &rarr; {record.spec.version}
                        </span>
                      )}
                    <ClusterUpgradeTip cluster={record} />
                  </span>
                </ShowPage.Meta>
                <ShowPage.Meta label={t("common.fields.imageRegistry")}>
                  <ShowButton
                    recordItemId={record.spec.image_registry}
                    meta={{ workspace: record.metadata.workspace }}
                    variant="link"
                    resource="image_registries"
                  >
                    {record.spec.image_registry}
                  </ShowButton>
                </ShowPage.Meta>
                {record.spec.type === "kubernetes" && (
                  <ShowPage.Meta
                    label={t("clusters.fields.acceleratorVirtualization")}
                  >
                    {acceleratorVirtualizationEnabled
                      ? t("common.options.enabled")
                      : t("common.options.disabled")}
                  </ShowPage.Meta>
                )}
                <ShowPage.Meta label={t("common.fields.createdAt")}>
                  <Timestamp
                    timestamp={record.metadata.creation_timestamp}
                    relative
                  />
                </ShowPage.Meta>
              </span>
            }
            status={<ClusterStatus {...record.status} />}
          />
          <TabsList className="relative mt-0 h-11 w-full items-end justify-start gap-8 rounded-none border-0 bg-transparent p-0 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-border">
            <TabsTrigger value="basic" className={detailTabTriggerClassName}>
              {t("common.tabs.basic")}
            </TabsTrigger>
            {showMonitorTab && (
              <TabsTrigger
                value="monitor"
                className={detailTabTriggerClassName}
              >
                {t("common.tabs.monitor")}
              </TabsTrigger>
            )}
            {record.spec.type === "ssh" && (
              <TabsTrigger value="ray" className={detailTabTriggerClassName}>
                {t("common.tabs.rayDashboard")}
              </TabsTrigger>
            )}
          </TabsList>
          <TabsContent
            value="basic"
            className="mt-0 flex-1 space-y-3 overflow-auto pt-4"
          >
            {record.spec.config.ssh_config && (
              <ShowPage.Section>
                <div className="grid gap-5 md:grid-cols-2">
                  <ShowPage.Row title={t("clusters.fields.headIp")}>
                    {record.spec.config.ssh_config.provider.head_ip ?? ""}
                  </ShowPage.Row>
                  <ShowPage.Row title={t("clusters.fields.workerIps")}>
                    {(
                      record.spec.config.ssh_config.provider.worker_ips || []
                    )?.join(",")}
                  </ShowPage.Row>
                </div>
              </ShowPage.Section>
            )}
            {record.spec.config.kubernetes_config && (
              <ShowPage.Section title={t("clusters.sections.router")}>
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                  <ShowPage.Row title={t("clusters.fields.accessMode")}>
                    {getAccessModeLabel(
                      record.spec.config.kubernetes_config.router?.access_mode,
                      t,
                    )}
                  </ShowPage.Row>
                  <ShowPage.Row title={t("clusters.fields.replicas")}>
                    {record.spec.config.kubernetes_config.router?.replicas ??
                      ""}
                  </ShowPage.Row>
                  <ShowPage.Row title={t("common.fields.cpu")}>
                    {record.spec.config.kubernetes_config.router?.resources
                      ?.cpu ?? ""}
                  </ShowPage.Row>
                  <ShowPage.Row title={t("common.fields.memory")}>
                    {record.spec.config.kubernetes_config.router?.resources
                      ?.memory ?? ""}
                  </ShowPage.Row>
                </div>
              </ShowPage.Section>
            )}
            {record.status?.resource_info && (
              <ShowPage.Section title={t("common.fields.resources")}>
                <ClusterResourceSummary
                  resourceInfo={record.status.resource_info}
                  t={t}
                />
              </ShowPage.Section>
            )}
            {record.status?.resource_info?.node_resources &&
              Object.keys(record.status.resource_info.node_resources).length >
                0 && (
                <ShowPage.Section
                  title={t("clusters.sections.nodes")}
                  actions={
                    <ResourceUsageLegend
                      items={[
                        {
                          label: t("clusters.fields.vramUsed"),
                          markerClassName:
                            "h-2 w-2 rounded-sm bg-[var(--nt-chart-series-1)]",
                        },
                        {
                          label: t("clusters.fields.coreUsed"),
                          markerClassName:
                            "h-2 w-2 rounded-sm bg-[var(--nt-chart-series-2)]",
                        },
                      ]}
                    />
                  }
                >
                  <NodeResourcesTable
                    nodeResources={record.status.resource_info.node_resources}
                    acceleratorTypes={Object.keys(
                      record.status.resource_info.allocatable
                        ?.accelerator_groups || {},
                    )}
                    t={t}
                    framed={false}
                  />
                </ShowPage.Section>
              )}
            {Number(record.spec.config.model_caches?.length) > 0 ? (
              <ShowPage.Section
                title={translate("clusters.fields.modelCache.title")}
              >
                <div className="space-y-4">
                  {(record.spec.config.model_caches || []).map(
                    (cache, index) => {
                      const cacheType = getCacheType(cache);

                      return (
                        // Nested surfaces step down a radius level. Repeating
                        // the card radius inside a card reads as a seam rather
                        // than as containment.
                        <div
                          key={index}
                          className="rounded-md border border-[var(--nt-stroke-neutral-trans-2)] p-4"
                        >
                          <div className="flex items-center gap-1 pb-3 text-sm font-medium leading-none text-[var(--nt-text-neutral-super)]">
                            <span className="mr-1 text-xs">#{index + 1}</span>
                            {cache.name ||
                              t(`clusters.fields.modelCache.type.${cacheType}`)}
                          </div>

                          <div className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {cache.name && (
                                <ShowPage.Row title={t("common.fields.name")}>
                                  {cache.name}
                                </ShowPage.Row>
                              )}

                              <ShowPage.Row
                                title={t(
                                  "clusters.fields.modelCache.cacheType",
                                )}
                              >
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                                  {cacheType === "nfs"
                                    ? t("clusters.options.nfs")
                                    : cacheType === "pvc"
                                      ? t("clusters.options.pvc")
                                      : t("clusters.options.hostPath")}
                                </span>
                              </ShowPage.Row>

                              {cache.nfs && (
                                <>
                                  <ShowPage.Row
                                    title={t(
                                      "clusters.fields.modelCache.nfsServer",
                                    )}
                                  >
                                    <code className="text-sm bg-muted text-foreground px-2 py-1 rounded">
                                      {cache.nfs.server}
                                    </code>
                                  </ShowPage.Row>

                                  <ShowPage.Row
                                    title={t(
                                      "clusters.fields.modelCache.cachePath",
                                    )}
                                  >
                                    <code className="text-sm bg-muted text-foreground px-2 py-1 rounded">
                                      {cache.nfs.path}
                                    </code>
                                  </ShowPage.Row>
                                </>
                              )}

                              {cache.host_path && (
                                <ShowPage.Row
                                  title={t(
                                    "clusters.fields.modelCache.cachePath",
                                  )}
                                >
                                  <code className="text-sm bg-muted text-foreground px-2 py-1 rounded">
                                    {cache.host_path.path}
                                  </code>
                                </ShowPage.Row>
                              )}

                              {cache.pvc && (
                                <>
                                  <ShowPage.Row
                                    title={t(
                                      "clusters.fields.modelCache.storage",
                                    )}
                                  >
                                    {cache.pvc.resources?.requests?.storage ??
                                      ""}
                                  </ShowPage.Row>

                                  {cache.pvc.storageClassName && (
                                    <ShowPage.Row
                                      title={t(
                                        "clusters.fields.modelCache.storageClassName",
                                      )}
                                    >
                                      {cache.pvc.storageClassName}
                                    </ShowPage.Row>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              </ShowPage.Section>
            ) : null}
            <ShowPage.Section title={translate("endpoints.title")}>
              <Table
                refineCoreProps={{
                  resource: "endpoints",
                  filters: {
                    permanent: [
                      {
                        field: "spec->cluster",
                        operator: "eq",
                        value: JSON.stringify(record.metadata.name),
                      },
                    ],
                  },
                }}
              >
                {metadataColumns.name}
                <Table.Column
                  header={t("common.fields.status")}
                  accessorKey="status"
                  id="status"
                  enableHiding
                  cell={({ getValue }) => (
                    <EndpointStatus
                      {...(getValue() as unknown as BaseStatus)}
                    />
                  )}
                />
                <Table.Column
                  header={t("common.fields.model")}
                  accessorKey="status"
                  id="model"
                  enableHiding
                  cell={({ row }) => (
                    <EndpointModel
                      model={(row.original as Endpoint).spec.model}
                    />
                  )}
                />
                <Table.Column
                  header={t("common.fields.engine")}
                  accessorKey="spec.engine.engine"
                  id="engine"
                  enableHiding
                  cell={({ row }) => (
                    <EndpointEngine {...(row.original as Endpoint)} />
                  )}
                />
                {metadataColumns.creation_timestamp}
              </Table>
            </ShowPage.Section>
          </TabsContent>
          {showMonitorTab && (
            <TabsContent
              value="monitor"
              className="mt-0 flex-1 overflow-hidden pt-4"
            >
              {grafanaUrl ? (
                <div className="flex flex-col gap-4 h-full">
                  {selectedPanel && (
                    <GrafanaDashboard
                      {...getClusterSplitDashboardProps(
                        grafanaUrl,
                        selectedPanel,
                        record.metadata.name,
                      )}
                      className="flex-1"
                      hideVariables
                    />
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">
                    {t("common.messages.grafanaNotConfigured")}
                  </p>
                </div>
              )}
            </TabsContent>
          )}
          {record.spec.type === "ssh" && (
            <TabsContent value="ray" className="mt-0 flex-1">
              {dashboardUrl && (
                <iframe
                  src={dashboardUrl}
                  className="w-full h-full"
                  title={t("common.tabs.rayDashboard")}
                />
              )}
            </TabsContent>
          )}
        </Tabs>
      </ShowPage>
    </ClusterUpgradeProvider>
  );
};
