import {
  type IResourceComponentsProps,
  useList,
  useOne,
  useShow,
} from "@refinedev/core";
import { ShowButton, ShowPage } from "@/components/theme";
import type { Endpoint, Engine } from "@/types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ChatPlayground from "@/components/business/ChatPlayground";
import EmbeddingPlayground from "@/components/business/EmbeddingPlayground";
import { getRayDashboardProxy } from "@/lib/api";
import MetadataCard from "@/components/business/MetadataCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import EndpointStatus from "@/components/business/EndpointStatus";
import EndpointModel from "@/components/business/EndpointModel";
import EndpointEngine from "@/components/business/EndpointEngine";
import ModelTask from "@/components/business/ModelTask";
import JSONSchemaValueVisualizer from "@/components/business/JsonSchemaValueVisualizer";
import Loader from "@/components/theme/components/loader";
import { useCallback, useRef } from "react";
import RerankPlayground from "@/components/business/RerankPlayground";
import { useTranslation } from "react-i18next";
import GrafanaPanels from "@/components/business/GrafanaPanels";
import { useSystemApi } from "@/hooks/use-system-api";

const RayDashboardTab = ({ record }: { record: Endpoint }) => {
  const { t } = useTranslation();
  const { data: clusterData, isLoading } = useList({
    resource: "clusters",
    filters: [
      {
        field: "metadata->name",
        operator: "eq",
        value: JSON.stringify(record.spec.cluster),
      },
    ],
    queryOptions: {
      enabled: Boolean(record.spec.cluster),
    },
  });

  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleIframeLoad = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    if (doc.getElementById("injected-style")) return;
    const style = doc.createElement("style");
    style.id = "injected-style";
    style.textContent = `
      nav > div:first-child {
        display: none !important;
      }
      .css-1snkach {
        padding-top: 37px;
      }
    `;
    doc.head.appendChild(style);
  }, []);

  if (isLoading) {
    return <Loader className="h-4 text-primary" />;
  }

  const rayDashboardUrl = getRayDashboardProxy(clusterData?.data[0]);

  if (!rayDashboardUrl) {
    return (
      <p>
        <span className="text-red-500">
          {t("endpoints.messages.rayDashboardNotAvailable")}
        </span>
      </p>
    );
  }

  return (
    <iframe
      src={`${rayDashboardUrl}#/serve/applications/${record.metadata.name}`}
      className="w-full h-full"
      onLoad={handleIframeLoad}
      ref={iframeRef}
      title={t("endpoints.tabs.rayDashboard")}
    />
  );
};

export const EndpointsShow: React.FC<IResourceComponentsProps> = () => {
  const { t } = useTranslation();
  const { grafanaUrl } = useSystemApi();
  const {
    query: { data, isLoading },
  } = useShow<Endpoint>();
  const record = data?.data;

  const { data: engineData } = useOne<Engine>({
    resource: "engines",
    id: record?.spec.engine.engine,
    queryOptions: {
      enabled: Boolean(record?.spec.engine.engine),
    },
  });

  const url = record?.status?.service_url ?? "";

  if (isLoading) {
    return <Loader className="h-4 text-primary" />;
  }

  if (!record) {
    return <div>{t("pages.error.notFound")}</div>;
  }

  const engineVersionSchema = engineData?.data?.spec.versions.find(
    (v) => v.version === record.spec.engine.version,
  )?.values_schema;

  return (
    <ShowPage record={record}>
      <Tabs defaultValue="basic" className="h-full">
        <TabsList>
          <TabsTrigger value="basic">{t("endpoints.tabs.basic")}</TabsTrigger>
          <TabsTrigger value="ray">
            {t("endpoints.tabs.rayDashboard")}
          </TabsTrigger>
          <TabsTrigger value="monitor">
            {t("endpoints.tabs.monitor")}
          </TabsTrigger>
          <TabsTrigger value="playground">
            {t("endpoints.tabs.playground")}
          </TabsTrigger>
        </TabsList>
        <TabsContent
          value="basic"
          className="overflow-auto h-[calc(100%-theme('spacing.9'))]"
        >
          <MetadataCard metadata={record.metadata} />
          <Card className="mt-4">
            <CardContent>
              <div className="grid grid-cols-4 gap-8">
                <ShowPage.Row title={t("endpoints.fields.status")}>
                  <EndpointStatus phase={record.status?.phase} />
                </ShowPage.Row>
                <ShowPage.Row
                  title={t("endpoints.fields.serviceUrl")}
                  children={
                    <a href={url} target="_blank" rel="noreferrer">
                      <Button variant="link" className="p-0">
                        {url}
                      </Button>
                    </a>
                  }
                />
              </div>
              <div className="grid grid-cols-4 gap-8">
                <ShowPage.Row title={t("endpoints.fields.cluster")}>
                  <ShowButton
                    recordItemId={record.spec.cluster}
                    meta={{
                      workspace: record.metadata.workspace,
                    }}
                    variant="link"
                    resource="clusters"
                  >
                    {record.spec.cluster}
                  </ShowButton>
                </ShowPage.Row>
                <ShowPage.Row title={t("endpoints.fields.engine")}>
                  <EndpointEngine {...record} />
                </ShowPage.Row>
                <div>
                  <ShowPage.Row title={t("endpoints.fields.model")}>
                    <EndpointModel model={record.spec.model} />
                  </ShowPage.Row>
                </div>
                <div>
                  <ShowPage.Row title={t("endpoints.fields.task")}>
                    <ModelTask task={record.spec.model.task} />
                  </ShowPage.Row>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>{t("endpoints.fields.resources")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-8">
                <ShowPage.Row title={t("endpoints.fields.gpu")}>
                  {Object.values(record.spec.resources?.accelerator || {})[0] ??
                    record.spec.resources?.gpu ??
                    "-"}
                </ShowPage.Row>
                <ShowPage.Row title={t("endpoints.fields.cpu")}>
                  {record.spec.resources?.cpu ?? "-"}
                </ShowPage.Row>
                <ShowPage.Row title={t("endpoints.fields.memory")}>
                  {record.spec.resources?.memory ?? "-"}
                </ShowPage.Row>
              </div>

              {record.spec.resources?.accelerator && (
                <ShowPage.Row
                  title={Object.keys(record.spec.resources?.accelerator)[0]}
                >
                  {Object.values(record.spec.resources.accelerator)[0] ?? "-"}
                </ShowPage.Row>
              )}
            </CardContent>
          </Card>
          <Card className="mt-4">
            <CardContent>
              <div className="grid grid-cols-4 gap-8">
                <ShowPage.Row title={t("endpoints.fields.replica")}>
                  {record.spec.replicas?.num ?? 1}
                </ShowPage.Row>
                <ShowPage.Row title={t("endpoints.fields.scheduler")}>
                  {record.spec.deployment_options?.scheduler.type ??
                    t("model_catalogs.values.powerOfTwo")}
                </ShowPage.Row>
              </div>
            </CardContent>
          </Card>
          {engineVersionSchema && record.spec.variables?.engine_args && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>{t("endpoints.fields.variables")}</CardTitle>
              </CardHeader>
              <CardContent>
                <JSONSchemaValueVisualizer
                  schema={engineVersionSchema}
                  value={record.spec.variables.engine_args}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="ray" className="h-[calc(100%-theme('spacing.9'))]">
          <RayDashboardTab record={record} />
        </TabsContent>{" "}
        <TabsContent
          value="monitor"
          className="h-[calc(100%-theme('spacing.9'))] overflow-auto"
        >
          {grafanaUrl ? (
            <GrafanaPanels
              dashboardConfig={{
                baseUrl: grafanaUrl,
                dashboardId: "rayServeDeploymentDashboard",
                orgId: 1,
                timezone: "browser",
                variables: {
                  datasource: "neutree-cluster",
                  Application: record.metadata.name,
                  Deployment: "$__all",
                  Replica: "$__all",
                  Route: "$__all",
                  Cluster: record.spec.cluster,
                },
              }}
              panels={[
                {
                  id: 1,
                },
                {
                  id: 2,
                },
                {
                  id: 3,
                },
                {
                  id: 4,
                },
                {
                  id: 5,
                },
                {
                  id: 6,
                },
                {
                  id: 7,
                },
                {
                  id: 8,
                },
                {
                  id: 9,
                },
                {
                  id: 10,
                },
                {
                  id: 11,
                },
                {
                  id: 12,
                },
                {
                  id: 13,
                },
                {
                  id: 14,
                },
                {
                  id: 15,
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
        <TabsContent
          value="playground"
          className="h-[calc(100%-theme('spacing.9'))] overflow-hidden"
        >
          {record.spec.model.task === "text-embedding" ? (
            <EmbeddingPlayground endpoint={record} />
          ) : record.spec.model.task === "text-rerank" ? (
            <RerankPlayground endpoint={record} />
          ) : (
            <ChatPlayground endpoint={record} />
          )}
        </TabsContent>
      </Tabs>
    </ShowPage>
  );
};
