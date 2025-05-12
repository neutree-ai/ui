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

export const ClustersShow = () => {
  const {
    query: { data, isLoading },
  } = useShow<Cluster>();
  const record = data?.data;

  const { translate } = useTranslation();

  const metadataColumns = useMetadataColumns({ resource: "endpoints" });
  const endpointColumns = useEndpointColumns();

  if (isLoading) {
    return <Loader className="h-4 text-primary" />;
  }

  if (!record) {
    return <div>404 not found</div>;
  }

  const dashboardUrl = getRayDashboardProxy(data?.data);

  return (
    <ShowPage record={record}>
      <Tabs defaultValue="basic" className="h-full">
        <TabsList>
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="ray">Ray Dashboard</TabsTrigger>
        </TabsList>
        <TabsContent
          value="basic"
          className="h-[calc(100%-theme('spacing.9'))] overflow-auto"
        >
          <MetadataCard metadata={record.metadata} />
          <Card className="mt-4">
            <CardContent>
              <ShowPage.Row title="Status">
                <ClusterStatus phase={record.status?.phase} />
              </ShowPage.Row>
              <div className="grid grid-cols-4 gap-8">
                <ShowPage.Row title="Type">
                  <ClusterType type={record.spec.type} />
                </ShowPage.Row>
                <ShowPage.Row title="Image Registry">
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
                  <ShowPage.Row title="Head IP">
                    {record.spec.config.provider.head_ip ?? ""}
                  </ShowPage.Row>
                  <ShowPage.Row title="Worker IPs">
                    {(record.spec.config.provider.worker_ips || [])?.join(",")}
                  </ShowPage.Row>
                </div>
              )}
              {"kubeconfig" in record.spec.config && (
                <div>
                  <div className="grid grid-cols-4 gap-8">
                    <ShowPage.Row title="Access Mode">
                      {record.spec.config.head_node_spec?.access_mode ?? ""}
                    </ShowPage.Row>

                    <ShowPage.Row title="Head Node CPU">
                      {record.spec.config.head_node_spec?.resources?.cpu ?? ""}
                    </ShowPage.Row>

                    <ShowPage.Row title="Head Node Memory">
                      {record.spec.config.head_node_spec?.resources?.memory ??
                        ""}
                    </ShowPage.Row>
                  </div>

                  <div className="grid grid-cols-4 gap-8">
                    <ShowPage.Row title="Worker Node Replica">
                      {record.spec.config.worker_group_specs?.[0]
                        ?.max_replicas ?? ""}
                    </ShowPage.Row>

                    <ShowPage.Row title="Worker Node CPU">
                      {record.spec.config.worker_group_specs?.[0].resources
                        ?.cpu ?? ""}
                    </ShowPage.Row>

                    <ShowPage.Row title="Worker Node Memory">
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
        <TabsContent value="ray" className="h-[calc(100%-theme('spacing.9'))]">
          {dashboardUrl && (
            <iframe
              src={dashboardUrl}
              className="w-full h-full"
              title="Ray Dashboard"
            />
          )}
        </TabsContent>
      </Tabs>
    </ShowPage>
  );
};
