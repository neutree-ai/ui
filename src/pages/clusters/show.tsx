import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  type ClusterMonitorPanelType,
  useClusterMonitorPanels,
} from "@/domains/cluster/hooks/use-cluster-monitor-panels";
import { calcResourceUsage } from "@/domains/cluster/lib/calc-resource-usage";
import { getAccessModeLabel } from "@/domains/cluster/lib/get-access-mode-label";
import { getCacheType } from "@/domains/cluster/lib/get-cache-type";
import { getRayDashboardProxy } from "@/domains/cluster/lib/get-ray-dashboard-proxy";
import type { Cluster } from "@/domains/cluster/types";
import EndpointEngine from "@/domains/endpoint/components/EndpointEngine";
import EndpointModel from "@/domains/endpoint/components/EndpointModel";
import EndpointStatus from "@/domains/endpoint/components/EndpointStatus";
import type { Endpoint } from "@/domains/endpoint/types";
import GrafanaDashboard from "@/foundation/components/GrafanaDashboard";
import { Loader } from "@/foundation/components/Loader";
import MetadataCard from "@/foundation/components/MetadataCard";
import { ShowButton } from "@/foundation/components/ShowButton";
import { ShowPage } from "@/foundation/components/ShowPage";
import { Table } from "@/foundation/components/Table";
import { useMetadataColumns } from "@/foundation/components/metadata-columns";
import { useSystemApi } from "@/foundation/hooks/use-system-api";
import {
  getClusterRayDashboardProps,
  getClusterRouterDashboardProps,
  getGpuDcgmDashboardProps,
  getNodeExporterDashboardProps,
} from "@/foundation/lib/grafana-dashboard-configs";
import { useTranslation as useI18nTranslation } from "@/foundation/lib/i18n";
import type { BaseStatus } from "@/foundation/types/basic-types";
import { useShow, useTranslation } from "@refinedev/core";

export const ClustersShow = () => {
  const {
    query: { data, isLoading },
  } = useShow<Cluster>();
  const record = data?.data;

  const { translate } = useTranslation();
  const { t } = useI18nTranslation();
  const { grafanaUrl } = useSystemApi();

  const metadataColumns = useMetadataColumns({ resource: "endpoints" });

  const {
    panels: monitorPanels,
    selectedPanel,
    setSelectedPanel,
    showMonitorTab,
    showSelector,
  } = useClusterMonitorPanels({
    clusterType: record?.spec.type,
  });

  if (isLoading) {
    return <Loader className="h-4 text-primary" />;
  }

  if (!record) {
    return <div>{t("clusters.messages.notFound")}</div>;
  }

  const dashboardUrl = getRayDashboardProxy(data?.data);

  return (
    <ClusterUpgradeProvider>
    <ShowPage
      record={record}
      extraActions={(record) => (
        <ClusterUpgradeAction cluster={record as Cluster} />
      )}
    >
      <Tabs defaultValue="basic" className="h-full">
        <TabsList>
          <TabsTrigger value="basic">{t("common.tabs.basic")}</TabsTrigger>
          {showMonitorTab && (
            <TabsTrigger value="monitor">
              {t("common.tabs.monitor")}
            </TabsTrigger>
          )}
          {record.spec.type === "ssh" && (
            <TabsTrigger value="ray">
              {t("common.tabs.rayDashboard")}
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent
          value="basic"
          className="h-[calc(100%-theme('spacing.9'))] overflow-auto"
        >
          <MetadataCard metadata={record.metadata} />
          <Card className="mt-4">
            <CardContent>
              <ShowPage.Row title={t("common.fields.status")}>
                <ClusterStatus {...record.status} />
              </ShowPage.Row>
              <ShowPage.Row title={t("common.fields.version")}>
                <span className="inline-flex items-center">
                  {record.status?.version ?? "-"}
                  {record.status?.phase === "Upgrading" && record.spec.version && (
                    <span className="text-muted-foreground">
                      {" "}
                      &rarr; {record.spec.version}
                    </span>
                  )}
                  <ClusterUpgradeTip cluster={record} />
                </span>
              </ShowPage.Row>
              <div className="grid grid-cols-4 gap-8">
                <ShowPage.Row title={t("common.fields.type")}>
                  <ClusterType type={record.spec.type} />
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
              </div>
              {record.spec.config.ssh_config && (
                <div>
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
                <Card>
                  <CardHeader>
                    <CardTitle>{t("clusters.sections.router")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-8">
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
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
          {record.status?.resource_info && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>{t("common.fields.resources")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* CPU */}
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

                  {/* Memory */}
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

                  {/* Accelerators */}
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
                            allocatableGroups={allocatableGroup.product_groups}
                            availableGroups={availableGroup?.product_groups}
                          />
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}
          {record.status?.resource_info?.node_resources &&
            Object.keys(record.status.resource_info.node_resources).length >
              0 && (
              <NodeResourcesTable
                nodeResources={record.status.resource_info.node_resources}
                acceleratorTypes={Object.keys(
                  record.status?.resource_info?.allocatable
                    ?.accelerator_groups || {},
                )}
                t={t}
              />
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
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
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
                                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                                      {cache.nfs.server}
                                    </code>
                                  </ShowPage.Row>

                                  <ShowPage.Row
                                    title={t(
                                      "clusters.fields.modelCache.cachePath",
                                    )}
                                  >
                                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">
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
                                  <code className="text-sm bg-gray-100 px-2 py-1 rounded">
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
            className="h-[calc(100%-theme('spacing.9'))] overflow-hidden"
          >
            {grafanaUrl ? (
              <div className="flex flex-col gap-4 h-full">
                {showSelector && (
                  <Card className="p-4">
                    <div className="flex items-center justify-start">
                      <Select
                        value={selectedPanel || undefined}
                        onValueChange={(value: ClusterMonitorPanelType) =>
                          setSelectedPanel(value)
                        }
                      >
                        <SelectTrigger className="w-[220px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {monitorPanels.includes("ray") && (
                            <SelectItem value="ray">
                              {t("clusters.monitor.rayMetrics")}
                            </SelectItem>
                          )}
                          {monitorPanels.includes("router") && (
                            <SelectItem value="router">
                              {t("clusters.monitor.routerMetrics")}
                            </SelectItem>
                          )}
                          {monitorPanels.includes("node") && (
                            <SelectItem value="node">
                              {t("clusters.monitor.nodeMetrics")}
                            </SelectItem>
                          )}
                          {monitorPanels.includes("gpu") && (
                            <SelectItem value="gpu">
                              {t("clusters.monitor.gpuMetrics")}
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </Card>
                )}

                {selectedPanel === "ray" && (
                  <GrafanaDashboard
                    {...getClusterRayDashboardProps(
                      grafanaUrl,
                      record.metadata.name,
                    )}
                    className="flex-1"
                    hideVariables
                  />
                )}
                {selectedPanel === "router" && (
                  <GrafanaDashboard
                    {...getClusterRouterDashboardProps(
                      grafanaUrl,
                      record.metadata.name,
                    )}
                    className="flex-1"
                    hideVariables
                  />
                )}
                {selectedPanel === "node" && (
                  <GrafanaDashboard
                    {...getNodeExporterDashboardProps(
                      grafanaUrl,
                      record.metadata.name,
                    )}
                    className="flex-1"
                    hideVariables
                  />
                )}
                {selectedPanel === "gpu" && (
                  <GrafanaDashboard
                    {...getGpuDcgmDashboardProps(
                      grafanaUrl,
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
          <TabsContent
            value="ray"
            className="h-[calc(100%-theme('spacing.9'))]"
          >
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
