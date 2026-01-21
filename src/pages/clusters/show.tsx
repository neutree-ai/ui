import ClusterStatus from "@/components/business/ClusterStatus";
import ClusterType from "@/components/business/ClusterType";
import GrafanaPanels from "@/components/business/GrafanaPanels";
import MetadataCard from "@/components/business/MetadataCard";
import { ShowButton, ShowPage, Table } from "@/components/theme";
import Loader from "@/components/theme/components/loader";
import { useEndpointColumns } from "@/components/theme/table/columns/endpoint-columns";
import { useMetadataColumns } from "@/components/theme/table/columns/metadata-columns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Table as UITable,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type ClusterMonitorPanelType,
  useClusterMonitorPanels,
} from "@/hooks/use-monitor-panels";
import { useSystemApi } from "@/hooks/use-system-api";
import { getRayDashboardProxy } from "@/lib/api";
import {
  getClusterRayGrafanaProps,
  getClusterRouterGrafanaProps,
  getGpuDcgmGrafanaProps,
  getNodeExporterGrafanaProps,
} from "@/lib/grafana-configs";
import { useTranslation as useI18nTranslation } from "@/lib/i18n";
import { formatToDecimal } from "@/lib/unit";
import type { Cluster, ModelCache } from "@/types";
import { useShow, useTranslation } from "@refinedev/core";

// Utility function to calculate resource usage
const calcResourceUsage = (allocatable: number, available?: number) => {
  const used = allocatable - (available || 0);
  const percent = allocatable > 0 ? Math.round((used / allocatable) * 100) : 0;
  return { used, percent };
};

// Component for displaying resource usage with progress bar
interface ResourceProgressBarProps {
  label: string;
  used: number;
  total: number;
  unit?: string;
  compact?: boolean;
  className?: string;
}

const ResourceProgressBar = ({
  label,
  used,
  total,
  unit,
  compact = false,
  className,
}: ResourceProgressBarProps) => {
  const percent = total > 0 ? Math.round((used / total) * 100) : 0;

  if (compact) {
    return (
      <div className={className}>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {formatToDecimal(used)} / {formatToDecimal(total)}
              {unit ? ` ${unit}` : ""}
            </span>
            <span className="tabular-nums">{percent}%</span>
          </div>
          <Progress value={percent} className="h-2" />
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm text-muted-foreground">
          {formatToDecimal(used)} / {formatToDecimal(total)}
          {unit ? ` ${unit}` : ""} ({percent}%)
        </span>
      </div>
      <Progress value={percent} />
    </div>
  );
};

// Component for displaying product groups breakdown
interface ProductGroupsBreakdownProps {
  allocatableGroups?: Record<string, number> | null;
  availableGroups?: Record<string, number> | null;
}

const ProductGroupsBreakdown = ({
  allocatableGroups,
  availableGroups,
}: ProductGroupsBreakdownProps) => {
  if (!allocatableGroups || Object.keys(allocatableGroups).length === 0) {
    return null;
  }

  return (
    <div className="mt-2 ml-4 space-y-1">
      {Object.entries(allocatableGroups).map(([product, total]) => {
        const productUsed = total - (availableGroups?.[product] || 0);
        return (
          <div
            key={product}
            className="text-xs text-muted-foreground flex items-center justify-between"
          >
            <span>{product}</span>
            <span>
              {formatToDecimal(productUsed)} / {formatToDecimal(total)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// Access mode labels mapping
const ACCESS_MODE_KEYS = ["LoadBalancer", "NodePort", "Ingress"] as const;
type AccessMode = (typeof ACCESS_MODE_KEYS)[number];

const getAccessModeLabel = (
  mode: string | undefined,
  t: (key: string) => string,
): string => {
  if (mode && ACCESS_MODE_KEYS.includes(mode as AccessMode)) {
    return t(`status.accessModes.${mode}`);
  }
  return "-";
};

// Component for displaying node resources table
interface NodeResourcesTableProps {
  nodeResources: Record<string, import("@/types").ResourceStatus>;
  acceleratorTypes: string[];
  t: (key: string, options?: { defaultValue?: string }) => string;
}

const NodeResourcesTable = ({
  nodeResources,
  acceleratorTypes,
  t,
}: NodeResourcesTableProps) => (
  <Card className="mt-4">
    <CardHeader>
      <CardTitle>{t("clusters.sections.nodes")}</CardTitle>
    </CardHeader>
    <CardContent>
      <UITable>
        <TableHeader>
          <TableRow>
            <TableHead>{t("clusters.fields.nodeName")}</TableHead>
            <TableHead className="min-w-[140px]">
              {t("common.fields.cpu")}
            </TableHead>
            <TableHead className="min-w-[140px]">
              {t("common.fields.memory")}
            </TableHead>
            {acceleratorTypes.map((accType) => (
              <TableHead key={accType} className="min-w-[140px]">
                {t(`clusters.acceleratorTypes.${accType}`, {
                  defaultValue: accType,
                })}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.entries(nodeResources).map(([nodeName, nodeStatus]) => {
            const cpu = calcResourceUsage(
              nodeStatus.allocatable?.cpu || 0,
              nodeStatus.available?.cpu,
            );
            const memory = calcResourceUsage(
              nodeStatus.allocatable?.memory || 0,
              nodeStatus.available?.memory,
            );

            return (
              <TableRow key={nodeName}>
                <TableCell className="font-medium">{nodeName}</TableCell>
                <TableCell className="align-top">
                  <ResourceProgressBar
                    label=""
                    used={cpu.used}
                    total={nodeStatus.allocatable?.cpu || 0}
                    compact
                  />
                </TableCell>
                <TableCell className="align-top">
                  <ResourceProgressBar
                    label=""
                    used={memory.used}
                    total={nodeStatus.allocatable?.memory || 0}
                    unit="GiB"
                    compact
                  />
                </TableCell>
                {acceleratorTypes.map((accType) => {
                  const accGroup =
                    nodeStatus.allocatable?.accelerator_groups?.[accType];
                  const accAllocatable = accGroup?.quantity || 0;
                  const acc = calcResourceUsage(
                    accAllocatable,
                    nodeStatus.available?.accelerator_groups?.[accType]
                      ?.quantity,
                  );

                  return (
                    <TableCell key={accType} className="align-top">
                      {accAllocatable === 0 ? (
                        <span className="text-muted-foreground">-</span>
                      ) : (
                        <div>
                          <ResourceProgressBar
                            label=""
                            used={acc.used}
                            total={accAllocatable}
                            compact
                          />
                          <ProductGroupsBreakdown
                            allocatableGroups={accGroup?.product_groups}
                            availableGroups={
                              nodeStatus.available?.accelerator_groups?.[
                                accType
                              ]?.product_groups
                            }
                          />
                        </div>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </UITable>
    </CardContent>
  </Card>
);

export const ClustersShow = () => {
  const {
    query: { data, isLoading },
  } = useShow<Cluster>();
  const record = data?.data;

  const { translate } = useTranslation();
  const { t } = useI18nTranslation();
  const { grafanaUrl } = useSystemApi();

  const metadataColumns = useMetadataColumns({ resource: "endpoints" });
  const endpointColumns = useEndpointColumns();

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

  const getCacheType = (cache: ModelCache): "nfs" | "host_path" | "pvc" => {
    if (cache.nfs) return "nfs";
    if (cache.pvc) return "pvc";
    return "host_path";
  };

  return (
    <ShowPage record={record}>
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
                {endpointColumns.status}
                {endpointColumns.model}
                {endpointColumns.engine}
                {metadataColumns.update_timestamp}
                {metadataColumns.creation_timestamp}
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        {showMonitorTab && (
          <TabsContent
            value="monitor"
            className="h-[calc(100%-theme('spacing.9'))] overflow-auto"
          >
            {grafanaUrl ? (
              <div className="space-y-4">
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
                  <GrafanaPanels
                    {...getClusterRayGrafanaProps(
                      grafanaUrl,
                      record.metadata.name,
                    )}
                  />
                )}
                {selectedPanel === "router" && (
                  <GrafanaPanels
                    {...getClusterRouterGrafanaProps(
                      grafanaUrl,
                      record.metadata.name,
                    )}
                  />
                )}
                {selectedPanel === "node" && (
                  <GrafanaPanels
                    {...getNodeExporterGrafanaProps(
                      grafanaUrl,
                      record.metadata.name,
                    )}
                  />
                )}
                {selectedPanel === "gpu" && (
                  <GrafanaPanels
                    {...getGpuDcgmGrafanaProps(
                      grafanaUrl,
                      record.metadata.name,
                    )}
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
  );
};
