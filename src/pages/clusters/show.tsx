import { getRayDashboardProxy } from "@/lib/api";
import { useShow, useTranslation } from "@refinedev/core";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShowButton, ShowPage, Table } from "@/components/theme";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Loader from "@/components/theme/components/loader";
import MetadataCard from "@/components/business/MetadataCard";
import type { Cluster } from "@/types";
import { useMetadataColumns } from "@/components/theme/table/columns/metadata-columns";
import { useEndpointColumns } from "@/components/theme/table/columns/endpoint-columns";
import ClusterStatus from "@/components/business/ClusterStatus";
import ClusterType from "@/components/business/ClusterType";
import { useTranslation as useI18nTranslation } from "@/lib/i18n";
import GrafanaPanels from "@/components/business/GrafanaPanels";
import { useSystemApi } from "@/hooks/use-system-api";
import { getClusterGrafanaProps } from "@/lib/grafana-configs";

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

  // Calculate accelerator info for head node
  const headNodeAcceleratorEntry =
    record && "kubeconfig" in record.spec.config
      ? Object.entries(record.spec.config.head_node_spec?.resources || {}).find(
          ([key]) => key.includes("gpu") || key.includes("Ascend"),
        )
      : null;

  const headNodeAcceleratorCount = headNodeAcceleratorEntry?.[1];
  const hasHeadNodeAccelerator =
    headNodeAcceleratorCount &&
    typeof headNodeAcceleratorCount === "string" &&
    Number.parseInt(headNodeAcceleratorCount) > 0;

  // Calculate accelerator info for worker node
  const workerNodeAcceleratorEntry =
    record && "kubeconfig" in record.spec.config
      ? Object.entries(
          record.spec.config.worker_group_specs?.[0]?.resources || {},
        ).find(([key]) => key.includes("gpu") || key.includes("Ascend"))
      : null;

  const workerNodeAcceleratorCount = workerNodeAcceleratorEntry?.[1];
  const hasWorkerNodeAccelerator =
    workerNodeAcceleratorCount &&
    typeof workerNodeAcceleratorCount === "string" &&
    Number.parseInt(workerNodeAcceleratorCount) > 0;

  return (
    <ShowPage record={record}>
      <Tabs defaultValue="basic" className="h-full">
        <TabsList>
          <TabsTrigger value="basic">{t("clusters.tabs.basic")}</TabsTrigger>
          <TabsTrigger value="monitor">
            {t("clusters.tabs.monitor")}
          </TabsTrigger>
          <TabsTrigger value="ray">
            {t("clusters.tabs.rayDashboard")}
          </TabsTrigger>
        </TabsList>
        <TabsContent
          value="basic"
          className="h-[calc(100%-theme('spacing.9'))] overflow-auto"
        >
          <MetadataCard metadata={record.metadata} />
          <Card className="mt-4">
            <CardContent>
              <ShowPage.Row title={t("clusters.fields.status")}>
                <ClusterStatus phase={record.status?.phase} />
              </ShowPage.Row>
              <div className="grid grid-cols-4 gap-8">
                <ShowPage.Row title={t("clusters.fields.type")}>
                  <ClusterType type={record.spec.type} />
                </ShowPage.Row>
                <ShowPage.Row title={t("clusters.fields.imageRegistry")}>
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
              {"provider" in record.spec.config && (
                <div>
                  <ShowPage.Row title={t("clusters.fields.headIp")}>
                    {record.spec.config.provider.head_ip ?? ""}
                  </ShowPage.Row>
                  <ShowPage.Row title={t("clusters.fields.workerIps")}>
                    {(record.spec.config.provider.worker_ips || [])?.join(",")}
                  </ShowPage.Row>
                </div>
              )}
              {"kubeconfig" in record.spec.config && (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>{t("clusters.sections.headNode")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 gap-8">
                        <ShowPage.Row title={t("clusters.fields.accessMode")}>
                          {record.spec.config.head_node_spec?.access_mode ?? ""}
                        </ShowPage.Row>

                        <ShowPage.Row title={t("clusters.fields.cpu")}>
                          {record.spec.config.head_node_spec?.resources?.cpu ??
                            ""}
                        </ShowPage.Row>

                        <ShowPage.Row title={t("clusters.fields.memory")}>
                          {record.spec.config.head_node_spec?.resources
                            ?.memory ?? ""}
                        </ShowPage.Row>

                        <div />

                        {hasHeadNodeAccelerator && (
                          <>
                            <ShowPage.Row
                              title={t("clusters.fields.acceleratorType")}
                            >
                              {headNodeAcceleratorEntry?.[0]}
                            </ShowPage.Row>

                            <ShowPage.Row
                              title={t("clusters.fields.acceleratorCount")}
                            >
                              {headNodeAcceleratorCount}
                            </ShowPage.Row>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>{t("clusters.sections.workerNode")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 gap-8">
                        <ShowPage.Row title={t("clusters.fields.replicas")}>
                          {record.spec.config.worker_group_specs?.[0]
                            ?.max_replicas ?? ""}
                        </ShowPage.Row>

                        <ShowPage.Row title={t("clusters.fields.cpu")}>
                          {record.spec.config.worker_group_specs?.[0].resources
                            ?.cpu ?? ""}
                        </ShowPage.Row>

                        <ShowPage.Row title={t("clusters.fields.memory")}>
                          {record.spec.config.worker_group_specs?.[0].resources
                            ?.memory ?? ""}
                        </ShowPage.Row>

                        <div />

                        {hasWorkerNodeAccelerator && (
                          <>
                            <ShowPage.Row
                              title={t("clusters.fields.acceleratorType")}
                            >
                              {workerNodeAcceleratorEntry?.[0]}
                            </ShowPage.Row>

                            <ShowPage.Row
                              title={t("clusters.fields.acceleratorCount")}
                            >
                              {workerNodeAcceleratorCount}
                            </ShowPage.Row>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>{translate("endpoints.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table
                refineCoreProps={{
                  resource: "endpoints",
                  filters: {
                    initial: [
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
              {...getClusterGrafanaProps(grafanaUrl, record.metadata.name)}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">
                {t("common.messages.grafanaNotConfigured")}
              </p>
            </div>
          )}
        </TabsContent>
        <TabsContent value="ray" className="h-[calc(100%-theme('spacing.9'))]">
          {dashboardUrl && (
            <iframe
              src={dashboardUrl}
              className="w-full h-full"
              title={t("clusters.messages.rayDashboardTitle")}
            />
          )}
        </TabsContent>
      </Tabs>
    </ShowPage>
  );
};
