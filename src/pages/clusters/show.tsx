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
                <div>
                  <div className="grid grid-cols-4 gap-8">
                    <ShowPage.Row title={t("clusters.fields.accessMode")}>
                      {record.spec.config.head_node_spec?.access_mode ?? ""}
                    </ShowPage.Row>

                    <ShowPage.Row title={t("clusters.fields.headNodeCpu")}>
                      {record.spec.config.head_node_spec?.resources?.cpu ?? ""}
                    </ShowPage.Row>

                    <ShowPage.Row title={t("clusters.fields.headNodeMemory")}>
                      {record.spec.config.head_node_spec?.resources?.memory ??
                        ""}
                    </ShowPage.Row>
                  </div>

                  <div className="grid grid-cols-4 gap-8">
                    <ShowPage.Row
                      title={t("clusters.fields.workerNodeReplica")}
                    >
                      {record.spec.config.worker_group_specs?.[0]
                        ?.max_replicas ?? ""}
                    </ShowPage.Row>

                    <ShowPage.Row title={t("clusters.fields.workerNodeCpu")}>
                      {record.spec.config.worker_group_specs?.[0].resources
                        ?.cpu ?? ""}
                    </ShowPage.Row>

                    <ShowPage.Row title={t("clusters.fields.workerNodeMemory")}>
                      {record.spec.config.worker_group_specs?.[0].resources
                        ?.memory ?? ""}
                    </ShowPage.Row>
                  </div>
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
              dashboardConfig={{
                baseUrl: grafanaUrl,
                dashboardId: "rayDefaultDashboard",
                orgId: 1,
                timezone: "browser",
                variables: {
                  datasource: "neutree-cluster",
                  SessionName: "$__all",
                  Instance: "$__all",
                  Cluster: record.metadata.name,
                },
              }}
              panels={[
                {
                  id: 26,
                },
                {
                  id: 35,
                },
                {
                  id: 38,
                },
                {
                  id: 33,
                },
                {
                  id: 42,
                },
                {
                  id: 36,
                },
                {
                  id: 27,
                },
                {
                  id: 29,
                },
                {
                  id: 28,
                },
                {
                  id: 40,
                },
                {
                  id: 2,
                },
                {
                  id: 8,
                },
                {
                  id: 6,
                },
                {
                  id: 32,
                },
                {
                  id: 4,
                },
                {
                  id: 48,
                },
                {
                  id: 44,
                },
                {
                  id: 34,
                },
                {
                  id: 37,
                },
                {
                  id: 18,
                },
                {
                  id: 20,
                },
                {
                  id: 24,
                },
                {
                  id: 41,
                },
              ]}
              enableAutoRefresh={true}
              refreshIntervals={[0, 5, 10, 30, 60, 300, 600]}
              className="w-full"
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
