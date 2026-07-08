import {
  type IResourceComponentsProps,
  useList,
  useOne,
  useShow,
} from "@refinedev/core";
import { lazy, Suspense, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getRayDashboardProxy } from "@/domains/cluster/lib/get-ray-dashboard-proxy";
import DeploymentConfigCard from "@/domains/endpoint/components/DeploymentConfigCard";
import EndpointEngine from "@/domains/endpoint/components/EndpointEngine";
import EndpointModel from "@/domains/endpoint/components/EndpointModel";
import { EndpointPauseAction } from "@/domains/endpoint/components/EndpointPauseAction";
import EndpointRuntimeResourcesCard from "@/domains/endpoint/components/EndpointRuntimeResourcesCard";
import EndpointStatus from "@/domains/endpoint/components/EndpointStatus";
import ModelTask from "@/domains/endpoint/components/ModelTask";
import ResourcesCard from "@/domains/endpoint/components/ResourcesCard";
import { useEndpointMonitorPanels } from "@/domains/endpoint/hooks/use-endpoint-monitor-panels";
import type { Endpoint } from "@/domains/endpoint/types";
import EngineVariablesCard from "@/domains/engine/components/EngineVariablesCard";
import type { Engine } from "@/domains/engine/types";
import GrafanaDashboard from "@/foundation/components/GrafanaDashboard";
import { Loader } from "@/foundation/components/Loader";
import MetadataCard from "@/foundation/components/MetadataCard";
import { SegmentedControl } from "@/foundation/components/SegmentedControl";
import ServiceUrls from "@/foundation/components/ServiceUrls";
import { ShowButton } from "@/foundation/components/ShowButton";
import { ShowPage } from "@/foundation/components/ShowPage";
import { useSystemApi } from "@/foundation/hooks/use-system-api";
import { getEndpointSplitDashboardProps } from "@/foundation/lib/grafana-dashboard-configs";

const EndpointLogTabs = lazy(() =>
  import("@/domains/endpoint/components/EndpointLogTabs").then((m) => ({
    default: m.EndpointLogTabs,
  })),
);
const ChatPlayground = lazy(
  () => import("@/domains/endpoint/components/ChatPlayground"),
);
const EmbeddingPlayground = lazy(
  () => import("@/domains/endpoint/components/EmbeddingPlayground"),
);
const RerankPlayground = lazy(
  () => import("@/domains/endpoint/components/RerankPlayground"),
);

const RayDashboardTab = ({
  record,
  cluster,
}: {
  record: Endpoint;
  cluster?: unknown;
}) => {
  const { t } = useTranslation();
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

  const rayDashboardUrl = getRayDashboardProxy(cluster);

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
      src={`${rayDashboardUrl}#/serve/applications/${record.metadata.workspace}_${record.metadata.name}`}
      className="w-full h-full"
      onLoad={handleIframeLoad}
      ref={iframeRef}
      title={t("common.tabs.rayDashboard")}
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

  const { data: clusterData } = useList({
    resource: "clusters",
    filters: [
      {
        field: "metadata->name",
        operator: "eq",
        value: JSON.stringify(record?.spec.cluster),
      },
    ],
    queryOptions: {
      enabled: Boolean(record?.spec.cluster),
    },
  });

  const clusterType = clusterData?.data?.[0]?.spec?.type;
  const isSSHCluster = clusterType === "ssh";
  const shouldShowRayDashboard = isSSHCluster;

  const {
    panels,
    selectedPanel,
    setSelectedPanel,
    showMonitorTab,
    showSelector,
  } = useEndpointMonitorPanels({
    engineType: record?.spec.engine.engine,
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
    <ShowPage
      record={record}
      extraActions={() => <EndpointPauseAction endpoint={record} />}
    >
      <Tabs defaultValue="basic" className="h-full">
        <TabsList>
          <TabsTrigger value="basic">{t("common.tabs.basic")}</TabsTrigger>
          {shouldShowRayDashboard && (
            <TabsTrigger value="ray">
              {t("common.tabs.rayDashboard")}
            </TabsTrigger>
          )}
          {showMonitorTab && (
            <TabsTrigger value="monitor">
              {t("common.tabs.monitor")}
            </TabsTrigger>
          )}
          <TabsTrigger value="logs">{t("common.tabs.logs")}</TabsTrigger>
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
                <ShowPage.Row title={t("common.fields.status")}>
                  <EndpointStatus {...record.status} />
                </ShowPage.Row>
                {url && (
                  <div className="col-span-3">
                    <ShowPage.Row title={t("endpoints.fields.serviceUrl")}>
                      <ServiceUrls serviceUrl={url} />
                    </ShowPage.Row>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-4 gap-8">
                <ShowPage.Row title={t("common.fields.cluster")}>
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
                <ShowPage.Row title={t("common.fields.engine")}>
                  <EndpointEngine {...record} />
                </ShowPage.Row>
                <div>
                  <ShowPage.Row title={t("common.fields.model")}>
                    <EndpointModel model={record.spec.model} />
                  </ShowPage.Row>
                </div>
                <div>
                  <ShowPage.Row title={t("common.fields.task")}>
                    <ModelTask task={record.spec.model.task} />
                  </ShowPage.Row>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-8">
                <ShowPage.Row title={t("endpoints.fields.modelFile")}>
                  {record.spec.model.file}
                </ShowPage.Row>
              </div>
              <EndpointRuntimeResourcesCard
                configuredResources={record.spec.resources}
                resources={record.status?.resources}
              />
            </CardContent>
          </Card>
          <ResourcesCard
            resources={record.spec.resources}
            showGpuConditionally={true}
            titleTranslationKey="endpoints.sections.requestedResources"
          />
          <DeploymentConfigCard
            replicas={record.spec.replicas}
            deploymentOptions={record.spec.deployment_options}
          />
          <EngineVariablesCard
            schema={engineVersionSchema}
            variables={record.spec.variables}
            useNestedPath={true}
          />
          {record.spec.env && Object.keys(record.spec.env).length > 0 && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>
                  {t("endpoints.sections.environmentVariables")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(record.spec.env).map(([key, value]) => (
                    <ShowPage.Row key={key} title={key}>
                      {value}
                    </ShowPage.Row>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        {shouldShowRayDashboard && (
          <TabsContent
            value="ray"
            className="h-[calc(100%-theme('spacing.9'))]"
          >
            <RayDashboardTab record={record} cluster={clusterData?.data?.[0]} />
          </TabsContent>
        )}
        <TabsContent
          value="monitor"
          className="h-[calc(100%-theme('spacing.9'))] overflow-hidden"
        >
          {grafanaUrl ? (
            <div className="flex flex-col gap-4 h-full">
              {showSelector && (
                <Card className="p-4">
                  <div className="grid gap-3 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
                    <SegmentedControl
                      ariaLabel={t("common.tabs.monitor")}
                      items={panels.map((panel) => ({
                        value: panel,
                        label:
                          panel === "overview"
                            ? t("endpoints.monitor.overviewMetrics")
                            : panel === "latency"
                              ? t("endpoints.monitor.latencyMetrics")
                              : panel === "throughput"
                                ? t("endpoints.monitor.throughputMetrics")
                                : panel === "queue"
                                  ? t("endpoints.monitor.queueMetrics")
                                  : t("endpoints.monitor.cacheMetrics"),
                      }))}
                      onValueChange={setSelectedPanel}
                      value={selectedPanel || undefined}
                    />
                    <p className="min-w-0 text-sm text-muted-foreground lg:text-right">
                      {selectedPanel === "latency"
                        ? t("endpoints.monitor.latencyDescription")
                        : selectedPanel === "throughput"
                          ? t("endpoints.monitor.throughputDescription")
                          : selectedPanel === "queue"
                            ? t("endpoints.monitor.queueDescription")
                            : selectedPanel === "cache"
                              ? t("endpoints.monitor.cacheDescription")
                              : t("endpoints.monitor.overviewDescription")}
                    </p>
                  </div>
                </Card>
              )}

              {selectedPanel ? (
                <GrafanaDashboard
                  {...getEndpointSplitDashboardProps(
                    grafanaUrl,
                    selectedPanel,
                    {
                      clusterName: record.spec.cluster,
                      endpointName: record.metadata.name,
                    },
                  )}
                  className="flex-1"
                  hideVariables
                />
              ) : null}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">
                {t("common.messages.grafanaNotConfigured")}
              </p>
            </div>
          )}
        </TabsContent>
        <TabsContent
          value="logs"
          className="h-[calc(100%-theme('spacing.9'))] overflow-hidden"
        >
          <Suspense fallback={<Loader width="20" height="20" />}>
            <EndpointLogTabs endpoint={record} />
          </Suspense>
        </TabsContent>
        <TabsContent
          value="playground"
          className="h-[calc(100%-theme('spacing.9'))] overflow-hidden"
        >
          <Suspense
            fallback={<Loader className="w-16 text-muted-foreground" />}
          >
            {record.spec.model.task === "text-embedding" ? (
              <EmbeddingPlayground endpoint={record} />
            ) : record.spec.model.task === "text-rerank" ? (
              <RerankPlayground endpoint={record} />
            ) : (
              <ChatPlayground endpoint={record} />
            )}
          </Suspense>
        </TabsContent>
      </Tabs>
    </ShowPage>
  );
};
