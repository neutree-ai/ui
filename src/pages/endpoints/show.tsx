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
import { resolvePlayground } from "@/domains/engine/lib/resolve-capabilities";
import type { Engine } from "@/domains/engine/types";
import GrafanaDashboard from "@/foundation/components/GrafanaDashboard";
import { Loader } from "@/foundation/components/Loader";
import { SegmentedControl } from "@/foundation/components/SegmentedControl";
import ServiceUrls from "@/foundation/components/ServiceUrls";
import { ShowButton } from "@/foundation/components/ShowButton";
import { ShowPage } from "@/foundation/components/ShowPage";
import Timestamp from "@/foundation/components/Timestamp";
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

const detailTabTriggerClassName =
  "relative z-10 h-full rounded-none border-0 bg-transparent px-0 py-2 text-sm font-semibold text-muted-foreground shadow-none transition-colors after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent hover:bg-transparent hover:text-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:after:bg-primary data-[state=active]:hover:bg-transparent";

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

  const engineVersion = engineData?.data?.spec.versions.find(
    (v) => v.version === record.spec.engine.version,
  );
  const engineVersionSchema = engineVersion?.values_schema;
  const playground = resolvePlayground(engineVersion, record.spec.model.task);

  return (
    <ShowPage
      record={record}
      showCurrentBreadcrumb={false}
      extraActions={() => <EndpointPauseAction endpoint={record} />}
    >
      <Tabs defaultValue="basic" className="flex h-full flex-col">
        <ShowPage.ObjectHeader
          title={record.metadata.name}
          description={
            <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
              <ShowPage.Meta label={t("common.fields.model")}>
                <EndpointModel model={record.spec.model} />
              </ShowPage.Meta>
              <ShowPage.Meta label={t("common.fields.task")}>
                <ModelTask task={record.spec.model.task} />
              </ShowPage.Meta>
              <ShowPage.Meta label={t("common.fields.engine")}>
                <EndpointEngine {...record} />
              </ShowPage.Meta>
              <ShowPage.Meta label={t("common.fields.cluster")}>
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
              </ShowPage.Meta>
            </span>
          }
          status={<EndpointStatus {...record.status} />}
        />
        <TabsList className="relative h-11 w-full items-end justify-start gap-8 rounded-none border-0 bg-transparent p-0 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-border">
          <TabsTrigger value="basic" className={detailTabTriggerClassName}>
            {t("common.tabs.basic")}
          </TabsTrigger>
          {shouldShowRayDashboard && (
            <TabsTrigger value="ray" className={detailTabTriggerClassName}>
              {t("common.tabs.rayDashboard")}
            </TabsTrigger>
          )}
          {showMonitorTab && (
            <TabsTrigger value="monitor" className={detailTabTriggerClassName}>
              {t("common.tabs.monitor")}
            </TabsTrigger>
          )}
          <TabsTrigger value="logs" className={detailTabTriggerClassName}>
            {t("common.tabs.logs")}
          </TabsTrigger>
          {playground.enabled && (
            <TabsTrigger
              value="playground"
              className={detailTabTriggerClassName}
            >
              {t("endpoints.tabs.playground")}
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent
          value="basic"
          className="mt-0 flex-1 space-y-4 overflow-auto pt-4"
        >
          <div className="space-y-4">
            <ShowPage.Section title={t("common.sections.basicInformation")}>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                <ShowPage.Row title={t("common.fields.status")}>
                  <EndpointStatus {...record.status} />
                </ShowPage.Row>
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
                <ShowPage.Row title={t("common.fields.model")}>
                  <EndpointModel model={record.spec.model} />
                </ShowPage.Row>
                <ShowPage.Row title={t("common.fields.task")}>
                  <ModelTask task={record.spec.model.task} />
                </ShowPage.Row>
                <ShowPage.Row title={t("endpoints.fields.modelFile")}>
                  {record.spec.model.file || "-"}
                </ShowPage.Row>
                <ShowPage.Row title={t("common.fields.workspace")}>
                  {record.metadata.workspace ?? "-"}
                </ShowPage.Row>
                <ShowPage.Row title={t("common.fields.createdAt")}>
                  <Timestamp timestamp={record.metadata.creation_timestamp} />
                </ShowPage.Row>
                <ShowPage.Row title={t("common.fields.updatedAt")}>
                  <Timestamp timestamp={record.metadata.update_timestamp} />
                </ShowPage.Row>
              </div>
            </ShowPage.Section>

            {url && (
              <ShowPage.Section title={t("endpoints.sections.access")}>
                <ServiceUrls serviceUrl={url} />
              </ShowPage.Section>
            )}

            <ShowPage.Section title={t("endpoints.sections.runtimeAllocation")}>
              <div className="space-y-6">
                <EndpointRuntimeResourcesCard
                  configuredResources={record.spec.resources}
                  resources={record.status?.resources}
                />
                <div className="border-t pt-4">
                  <ResourcesCard
                    resources={record.spec.resources}
                    showGpuConditionally={true}
                    titleTranslationKey="endpoints.sections.requestedResources"
                    framed={false}
                  />
                </div>
                <div className="border-t pt-4">
                  <DeploymentConfigCard
                    replicas={record.spec.replicas}
                    deploymentOptions={record.spec.deployment_options}
                    framed={false}
                  />
                </div>
              </div>
            </ShowPage.Section>
          </div>
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
          <TabsContent value="ray" className="mt-0 flex-1">
            <RayDashboardTab record={record} cluster={clusterData?.data?.[0]} />
          </TabsContent>
        )}
        <TabsContent
          value="monitor"
          className="mt-0 flex-1 overflow-hidden pt-4"
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
        <TabsContent value="logs" className="mt-0 flex-1 overflow-hidden pt-4">
          <Suspense fallback={<Loader width="20" height="20" />}>
            <EndpointLogTabs endpoint={record} />
          </Suspense>
        </TabsContent>
        {playground.enabled && (
          <TabsContent
            value="playground"
            className="mt-0 flex-1 overflow-hidden"
          >
            <Suspense
              fallback={<Loader className="w-16 text-muted-foreground" />}
            >
              {playground.mode === "embedding" ? (
                <EmbeddingPlayground endpoint={record} />
              ) : playground.mode === "rerank" ? (
                <RerankPlayground endpoint={record} />
              ) : (
                <ChatPlayground endpoint={record} />
              )}
            </Suspense>
          </TabsContent>
        )}
      </Tabs>
    </ShowPage>
  );
};
