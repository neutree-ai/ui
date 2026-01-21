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
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Table as UITable,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSystemApi } from "@/hooks/use-system-api";
import { getRayDashboardProxy } from "@/lib/api";
import { getClusterGrafanaProps } from "@/lib/grafana-configs";
import { useTranslation as useI18nTranslation } from "@/lib/i18n";
import { formatToDecimal } from "@/lib/unit";
import type { Cluster, ModelCache } from "@/types";
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
  const endpointColumns = useEndpointColumns();

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
          <TabsTrigger value="monitor">{t("common.tabs.monitor")}</TabsTrigger>
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
                        {record.spec.config.kubernetes_config.router
                          ?.access_mode === "LoadBalancer"
                          ? t("status.accessModes.LoadBalancer")
                          : record.spec.config.kubernetes_config.router
                                ?.access_mode === "NodePort"
                            ? t("status.accessModes.NodePort")
                            : record.spec.config.kubernetes_config.router
                                  ?.access_mode === "Ingress"
                              ? t("status.accessModes.Ingress")
                              : "-"}
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
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">
                          {t("common.fields.cpu")}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {formatToDecimal(
                            record.status.resource_info.allocatable.cpu -
                              (record.status.resource_info.available?.cpu || 0),
                          )}{" "}
                          /{" "}
                          {formatToDecimal(
                            record.status.resource_info.allocatable.cpu,
                          )}{" "}
                          cores (
                          {Math.round(
                            ((record.status.resource_info.allocatable.cpu -
                              (record.status.resource_info.available?.cpu ||
                                0)) /
                              record.status.resource_info.allocatable.cpu) *
                              100,
                          )}
                          %)
                        </span>
                      </div>
                      <Progress
                        value={
                          ((record.status.resource_info.allocatable.cpu -
                            (record.status.resource_info.available?.cpu || 0)) /
                            record.status.resource_info.allocatable.cpu) *
                          100
                        }
                      />
                    </div>
                  )}

                  {/* Memory */}
                  {record.status.resource_info.allocatable && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">
                          {t("common.fields.memory")}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {formatToDecimal(
                            record.status.resource_info.allocatable.memory -
                              (record.status.resource_info.available?.memory ||
                                0),
                          )}{" "}
                          /{" "}
                          {formatToDecimal(
                            record.status.resource_info.allocatable.memory,
                          )}{" "}
                          GiB (
                          {Math.round(
                            ((record.status.resource_info.allocatable.memory -
                              (record.status.resource_info.available?.memory ||
                                0)) /
                              record.status.resource_info.allocatable.memory) *
                              100,
                          )}
                          %)
                        </span>
                      </div>
                      <Progress
                        value={
                          ((record.status.resource_info.allocatable.memory -
                            (record.status.resource_info.available?.memory ||
                              0)) /
                            record.status.resource_info.allocatable.memory) *
                          100
                        }
                      />
                    </div>
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
                      const used =
                        allocatableGroup.quantity -
                        (availableGroup?.quantity || 0);
                      const usagePercent = Math.round(
                        (used / allocatableGroup.quantity) * 100,
                      );

                      return (
                        <div key={type}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">
                              {t(`clusters.acceleratorTypes.${type}`, {
                                defaultValue: type,
                              })}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {formatToDecimal(used)} /{" "}
                              {formatToDecimal(allocatableGroup.quantity)} (
                              {usagePercent}%)
                            </span>
                          </div>
                          <Progress value={usagePercent} />

                          {/* Product breakdown */}
                          {allocatableGroup.product_groups &&
                            Object.keys(allocatableGroup.product_groups)
                              .length > 0 && (
                              <div className="mt-2 ml-4 space-y-1">
                                {Object.entries(
                                  allocatableGroup.product_groups,
                                ).map(([product, quantity]) => (
                                  <div
                                    key={product}
                                    className="text-xs text-muted-foreground flex items-center justify-between"
                                  >
                                    <span>{product}</span>
                                    <span>{formatToDecimal(quantity)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}
          {record.status?.resource_info?.node_resources &&
            Object.keys(record.status.resource_info.node_resources).length >
              0 &&
            (() => {
              const acceleratorTypes = Object.keys(
                record.status?.resource_info?.allocatable?.accelerator_groups ||
                  {},
              );
              return (
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
                        {Object.entries(
                          record.status?.resource_info?.node_resources || {},
                        ).map(([nodeName, nodeStatus]) => {
                          const cpuAllocatable =
                            nodeStatus.allocatable?.cpu || 0;
                          const cpuAvailable = nodeStatus.available?.cpu || 0;
                          const cpuUsed = cpuAllocatable - cpuAvailable;
                          const cpuPercent =
                            cpuAllocatable > 0
                              ? Math.round((cpuUsed / cpuAllocatable) * 100)
                              : 0;

                          const memoryAllocatable =
                            nodeStatus.allocatable?.memory || 0;
                          const memoryAvailable =
                            nodeStatus.available?.memory || 0;
                          const memoryUsed =
                            memoryAllocatable - memoryAvailable;
                          const memoryPercent =
                            memoryAllocatable > 0
                              ? Math.round(
                                  (memoryUsed / memoryAllocatable) * 100,
                                )
                              : 0;

                          return (
                            <TableRow key={nodeName}>
                              <TableCell className="font-medium">
                                {nodeName}
                              </TableCell>
                              <TableCell className="align-top">
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>
                                      {formatToDecimal(cpuUsed)} /{" "}
                                      {formatToDecimal(cpuAllocatable)}
                                    </span>
                                    <span className="tabular-nums">
                                      {cpuPercent}%
                                    </span>
                                  </div>
                                  <Progress
                                    value={cpuPercent}
                                    className="h-2"
                                  />
                                </div>
                              </TableCell>
                              <TableCell className="align-top">
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>
                                      {formatToDecimal(memoryUsed)} /{" "}
                                      {formatToDecimal(memoryAllocatable)} GiB
                                    </span>
                                    <span className="tabular-nums">
                                      {memoryPercent}%
                                    </span>
                                  </div>
                                  <Progress
                                    value={memoryPercent}
                                    className="h-2"
                                  />
                                </div>
                              </TableCell>
                              {acceleratorTypes.map((accType) => {
                                const accGroup =
                                  nodeStatus.allocatable?.accelerator_groups?.[
                                    accType
                                  ];
                                const accAllocatable = accGroup?.quantity || 0;
                                const accAvailable =
                                  nodeStatus.available?.accelerator_groups?.[
                                    accType
                                  ]?.quantity || 0;
                                const accUsed = accAllocatable - accAvailable;
                                const accPercent =
                                  accAllocatable > 0
                                    ? Math.round(
                                        (accUsed / accAllocatable) * 100,
                                      )
                                    : 0;
                                const productGroups = accGroup?.product_groups;

                                return (
                                  <TableCell
                                    key={accType}
                                    className="align-top"
                                  >
                                    {accAllocatable === 0 ? (
                                      <span className="text-muted-foreground">
                                        -
                                      </span>
                                    ) : (
                                      <div>
                                        <div className="space-y-1">
                                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <span>
                                              {formatToDecimal(accUsed)} /{" "}
                                              {formatToDecimal(accAllocatable)}
                                            </span>
                                            <span className="tabular-nums">
                                              {accPercent}%
                                            </span>
                                          </div>
                                          <Progress
                                            value={accPercent}
                                            className="h-2"
                                          />
                                        </div>
                                        {productGroups &&
                                          Object.keys(productGroups).length >
                                            0 && (
                                            <div className="mt-2 ml-4 space-y-1">
                                              {Object.entries(
                                                productGroups,
                                              ).map(([product, total]) => {
                                                const productAvailable =
                                                  nodeStatus.available
                                                    ?.accelerator_groups?.[
                                                    accType
                                                  ]?.product_groups?.[
                                                    product
                                                  ] || 0;
                                                const productUsed =
                                                  total - productAvailable;
                                                return (
                                                  <div
                                                    key={product}
                                                    className="text-xs text-muted-foreground flex items-center justify-between"
                                                  >
                                                    <span>{product}</span>
                                                    <span>
                                                      {formatToDecimal(
                                                        productUsed,
                                                      )}{" "}
                                                      / {formatToDecimal(total)}
                                                    </span>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
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
            })()}
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
        <TabsContent
          value="monitor"
          className="h-[calc(100%-theme('spacing.9'))] overflow-auto"
        >
          {grafanaUrl ? (
            <GrafanaPanels
              {...getClusterGrafanaProps(
                grafanaUrl,
                record.metadata.name,
                record.spec.type,
              )}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">
                {t("common.messages.grafanaNotConfigured")}
              </p>
            </div>
          )}
        </TabsContent>
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
