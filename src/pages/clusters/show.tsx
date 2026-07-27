import { useShow, useTranslation } from "@refinedev/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ClusterStatus from "@/domains/cluster/components/ClusterStatus";
import ClusterType from "@/domains/cluster/components/ClusterType";
import {
  ClusterUpgradeAction,
  ClusterUpgradeProvider,
} from "@/domains/cluster/components/ClusterUpgradeAction";
import { ClusterUpgradeTip } from "@/domains/cluster/components/ClusterUpgradeTip";
import {
  NodeResourcesTable,
  ProductGroupsBreakdown,
} from "@/domains/cluster/components/NodeResourcesTable";
import { ResourceProgressBar } from "@/domains/cluster/components/ResourceProgressBar";
import { useClusterMonitorPanels } from "@/domains/cluster/hooks/use-cluster-monitor-panels";
import {
  getAcceleratorProductResourceRows,
  isAcceleratorVirtualizationEnabled,
} from "@/domains/cluster/lib/accelerator-virtualization";
import {
  calcResourceUsage,
  formatResourceUsageRatio,
} from "@/domains/cluster/lib/calc-resource-usage";
import { getAccessModeLabel } from "@/domains/cluster/lib/get-access-mode-label";
import { getCacheType } from "@/domains/cluster/lib/get-cache-type";
import { getRayDashboardProxy } from "@/domains/cluster/lib/get-ray-dashboard-proxy";
import { getAcceleratorProductQuantities } from "@/domains/cluster/lib/resource-status";
import type { Cluster } from "@/domains/cluster/types";
import EndpointEngine from "@/domains/endpoint/components/EndpointEngine";
import EndpointModel from "@/domains/endpoint/components/EndpointModel";
import EndpointStatus from "@/domains/endpoint/components/EndpointStatus";
import type { Endpoint } from "@/domains/endpoint/types";
import GrafanaDashboard from "@/foundation/components/GrafanaDashboard";
import { Loader } from "@/foundation/components/Loader";
import { useMetadataColumns } from "@/foundation/components/metadata-columns";
import { ShowButton } from "@/foundation/components/ShowButton";
import { ShowPage } from "@/foundation/components/ShowPage";
import { Table } from "@/foundation/components/Table";
import Timestamp from "@/foundation/components/Timestamp";
import { useSystemApi } from "@/foundation/hooks/use-system-api";
import { getClusterSplitDashboardProps } from "@/foundation/lib/grafana-dashboard-configs";
import { useTranslation as useI18nTranslation } from "@/foundation/lib/i18n";
import { formatMiBAsGiB, formatMiBAsGiBValue } from "@/foundation/lib/unit";
import type { BaseStatus } from "@/foundation/types/basic-types";

const formatVramUsageRatio = (
  allocatable: number | null | undefined,
  available?: number | null,
) => {
  if (allocatable == null) {
    return "-";
  }

  const { used } = calcResourceUsage(allocatable, available ?? undefined);
  const usedGiB = formatMiBAsGiBValue(used);
  const totalGiB = formatMiBAsGiBValue(allocatable);
  return usedGiB && totalGiB ? `${usedGiB} / ${totalGiB} GiB` : "-";
};

const detailTabTriggerClassName =
  "relative z-10 h-full rounded-none border-0 bg-transparent px-0 py-2 text-sm font-semibold text-muted-foreground shadow-none transition-colors after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent hover:text-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:after:bg-primary";

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
  const acceleratorProductResourceRows = getAcceleratorProductResourceRows(
    record.status?.resource_info,
  );

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
            description={
              <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
                <ShowPage.Meta label={t("common.fields.type")}>
                  <ClusterType type={record.spec.type} />
                </ShowPage.Meta>
                <ShowPage.Meta label={t("common.fields.version")}>
                  <span>
                    {record.status?.version ?? record.spec.version ?? "-"}
                  </span>
                </ShowPage.Meta>
                <ShowPage.Meta label={t("common.fields.workspace")}>
                  <span>{record.metadata.workspace ?? "-"}</span>
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
            className="mt-0 flex-1 space-y-4 overflow-auto pt-4"
          >
            <div className="space-y-4">
              <ShowPage.Section>
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                  <ShowPage.Row title={t("common.fields.status")}>
                    <ClusterStatus {...record.status} />
                  </ShowPage.Row>
                  <ShowPage.Row title={t("common.fields.type")}>
                    <ClusterType type={record.spec.type} />
                  </ShowPage.Row>
                  {record.spec.type === "kubernetes" && (
                    <ShowPage.Row
                      title={t("clusters.fields.acceleratorVirtualization")}
                    >
                      {acceleratorVirtualizationEnabled
                        ? t("common.options.enabled")
                        : t("common.options.disabled")}
                    </ShowPage.Row>
                  )}
                  <ShowPage.Row title={t("common.fields.workspace")}>
                    {record.metadata.workspace ?? "-"}
                  </ShowPage.Row>
                  <ShowPage.Row title={t("common.fields.version")}>
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
                  </ShowPage.Row>
                  <ShowPage.Row title={t("common.fields.imageRegistry")}>
                    <ShowButton
                      recordItemId={record.spec.image_registry}
                      meta={{
                        workspace: record.metadata.workspace,
                      }}
                      variant="link"
                      resource="image_registries"
                    >
                      {record.spec.image_registry}
                    </ShowButton>
                  </ShowPage.Row>
                  <ShowPage.Row title={t("common.fields.createdAt")}>
                    <Timestamp timestamp={record.metadata.creation_timestamp} />
                  </ShowPage.Row>
                  <ShowPage.Row title={t("common.fields.updatedAt")}>
                    <Timestamp timestamp={record.metadata.update_timestamp} />
                  </ShowPage.Row>
                </div>
                {record.spec.config.ssh_config && (
                  <div className="mt-5 grid gap-5 border-t pt-4 md:grid-cols-2">
                    <ShowPage.Row title={t("clusters.fields.headIp")}>
                      {record.spec.config.ssh_config.provider.head_ip ?? ""}
                    </ShowPage.Row>
                    <ShowPage.Row title={t("clusters.fields.workerIps")}>
                      {(
                        record.spec.config.ssh_config.provider.worker_ips || []
                      )?.join(",")}
                    </ShowPage.Row>
                  </div>
                )}
                {record.spec.config.kubernetes_config && (
                  <div className="mt-5 border-t pt-4">
                    <h3 className="mb-3 text-sm font-semibold text-foreground">
                      {t("clusters.sections.router")}
                    </h3>
                    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                      <ShowPage.Row title={t("clusters.fields.accessMode")}>
                        {getAccessModeLabel(
                          record.spec.config.kubernetes_config.router
                            ?.access_mode,
                          t,
                        )}
                      </ShowPage.Row>

                      <ShowPage.Row title={t("clusters.fields.replicas")}>
                        {record.spec.config.kubernetes_config.router
                          ?.replicas ?? ""}
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
                  </div>
                )}
              </ShowPage.Section>
            </div>
            {record.status?.resource_info && (
              <ShowPage.Section title={t("common.fields.resources")}>
                <div className="space-y-5">
                  <div>
                    <h3 className="mb-3 text-sm font-semibold text-foreground">
                      {t("endpoints.sections.resourceSummary")}
                    </h3>
                    <div className="space-y-4">
                      {record.status.resource_info.allocatable && (
                        <ResourceProgressBar
                          label={t("common.fields.cpu")}
                          used={
                            calcResourceUsage(
                              record.status.resource_info.allocatable.cpu,
                              record.status.resource_info.available?.cpu,
                            ).used
                          }
                          total={record.status.resource_info.allocatable.cpu}
                          unit="cores"
                        />
                      )}

                      {record.status.resource_info.allocatable && (
                        <ResourceProgressBar
                          label={t("common.fields.memory")}
                          used={
                            calcResourceUsage(
                              record.status.resource_info.allocatable.memory,
                              record.status.resource_info.available?.memory,
                            ).used
                          }
                          total={record.status.resource_info.allocatable.memory}
                          unit="GiB"
                        />
                      )}

                      {record.status.resource_info.allocatable
                        ?.accelerator_groups &&
                        Object.entries(
                          record.status.resource_info.allocatable
                            .accelerator_groups,
                        ).map(([type, allocatableGroup]) => {
                          const availableGroup =
                            record.status?.resource_info?.available
                              ?.accelerator_groups?.[type];
                          const { used } = calcResourceUsage(
                            allocatableGroup.quantity,
                            availableGroup?.quantity,
                          );

                          return (
                            <div key={type}>
                              <ResourceProgressBar
                                label={t(`clusters.acceleratorTypes.${type}`, {
                                  defaultValue: type,
                                })}
                                used={used}
                                total={allocatableGroup.quantity}
                              />
                              <ProductGroupsBreakdown
                                allocatableGroups={getAcceleratorProductQuantities(
                                  allocatableGroup,
                                )}
                                availableGroups={getAcceleratorProductQuantities(
                                  availableGroup,
                                )}
                              />
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {acceleratorProductResourceRows.length > 0 && (
                    <div className="border-t pt-4">
                      <h3 className="mb-3 text-sm font-semibold text-foreground">
                        {t("common.fields.acceleratorProduct")}
                      </h3>
                      <div className="overflow-x-auto rounded-md border">
                        <div className="grid min-w-[880px] grid-cols-6 gap-4 border-b bg-muted/40 px-3 py-2 text-sm font-medium">
                          <span>{t("common.fields.acceleratorType")}</span>
                          <span>{t("common.fields.acceleratorProduct")}</span>
                          <span>{t("clusters.fields.physicalGpu")}</span>
                          <span>{t("clusters.fields.singleCardVram")}</span>
                          <span>
                            {t("clusters.fields.acceleratorMemoryPool")}
                          </span>
                          <span>
                            {t("clusters.fields.acceleratorCorePool")}
                          </span>
                        </div>
                        {acceleratorProductResourceRows.map((row) => (
                          <div
                            key={`${row.acceleratorType}:${row.product}`}
                            className="grid min-w-[880px] grid-cols-6 gap-4 border-b px-3 py-2 text-sm last:border-b-0"
                          >
                            <span>
                              {t(
                                `clusters.acceleratorTypes.${row.acceleratorType}`,
                                {
                                  defaultValue: row.acceleratorType,
                                },
                              )}
                            </span>
                            <span>{row.product}</span>
                            <span>
                              {formatResourceUsageRatio(
                                row.quantity,
                                row.availableQuantity,
                              )}
                            </span>
                            <span>
                              {formatMiBAsGiB(row.memoryTotalMiB) ?? "-"}
                            </span>
                            <span>
                              {formatVramUsageRatio(
                                row.allocatableMemoryMiB,
                                row.availableMemoryMiB,
                              )}
                            </span>
                            <span>
                              {formatResourceUsageRatio(
                                row.allocatableCoreUnits,
                                row.availableCoreUnits,
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {record.status.resource_info.node_resources &&
                    Object.keys(record.status.resource_info.node_resources)
                      .length > 0 && (
                      <div className="border-t pt-4">
                        <h3 className="mb-3 text-sm font-semibold text-foreground">
                          {t("clusters.sections.nodes")}
                        </h3>
                        <NodeResourcesTable
                          nodeResources={
                            record.status.resource_info.node_resources
                          }
                          acceleratorTypes={Object.keys(
                            record.status.resource_info.allocatable
                              ?.accelerator_groups || {},
                          )}
                          t={t}
                          framed={false}
                        />
                      </div>
                    )}
                </div>
              </ShowPage.Section>
            )}
            {Number(record.spec.config.model_caches?.length) > 0 ? (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>
                    {translate("clusters.fields.modelCache.title")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {(record.spec.config.model_caches || []).map(
                      (cache, index) => {
                        const cacheType = getCacheType(cache);

                        return (
                          <Card key={index}>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm font-medium flex items-center gap-1">
                                <span className=" mr-1 py-1 rounded text-xs">
                                  #{index + 1}
                                </span>
                                {cache.name ||
                                  t(
                                    `clusters.fields.modelCache.type.${cacheType}`,
                                  )}
                              </CardTitle>
                            </CardHeader>

                            <CardContent className="space-y-4">
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
                            </CardContent>
                          </Card>
                        );
                      },
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : null}
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>{translate("endpoints.title")}</CardTitle>
              </CardHeader>
              <CardContent>
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
                      <EndpointModel model={row.original.spec.model} />
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
                  {metadataColumns.update_timestamp}
                  {metadataColumns.creation_timestamp}
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          {showMonitorTab && (
            <TabsContent
              value="monitor"
              className="mt-0 flex-1 overflow-hidden"
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
