import {
  type IResourceComponentsProps,
  useList,
  useOne,
  useShow,
} from "@refinedev/core";
import { lazy, Suspense, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getRayDashboardProxy } from "@/domains/cluster/lib/get-ray-dashboard-proxy";
import { EndpointAccessSummary } from "@/domains/endpoint/components/EndpointAccessSummary";
import { EndpointAdvancedParameters } from "@/domains/endpoint/components/EndpointAdvancedParameters";
import EndpointEngine from "@/domains/endpoint/components/EndpointEngine";
import EndpointModel from "@/domains/endpoint/components/EndpointModel";
import { EndpointPauseAction } from "@/domains/endpoint/components/EndpointPauseAction";
import EndpointRuntimeResourcesCard, {
  EndpointRuntimeResourcesSummary,
} from "@/domains/endpoint/components/EndpointRuntimeResourcesCard";
import EndpointStatus from "@/domains/endpoint/components/EndpointStatus";
import ModelTask from "@/domains/endpoint/components/ModelTask";
import { useEndpointMonitorPanels } from "@/domains/endpoint/hooks/use-endpoint-monitor-panels";
import type { Endpoint } from "@/domains/endpoint/types";
import { resolvePlayground } from "@/domains/engine/lib/resolve-capabilities";
import type { Engine } from "@/domains/engine/types";
import GrafanaDashboard from "@/foundation/components/GrafanaDashboard";
import { Loader } from "@/foundation/components/Loader";
import { SegmentedControl } from "@/foundation/components/SegmentedControl";
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

/** Suspense fallback for a whole tab panel.
 *
 * The Loader is an inline SVG, so its own `mx-auto` does nothing: dropped
 * straight into a Suspense fallback it lands in the top-left corner of the
 * panel, on top of whatever the tab renders next. The panel owns the space, so
 * the centring belongs to a wrapper here.
 */
const TabLoader = () => (
  <div className="flex h-full items-center justify-center">
    <Loader className="w-16 text-muted-foreground" />
  </div>
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

const getSchedulerText = (
  schedulerType: string | null | undefined,
  t: (key: string) => string,
) => {
  switch (schedulerType) {
    case "consistent_hash":
      return t("models.scheduler.consistentHashing");
    case "roundrobin":
      return t("models.scheduler.roundRobin");
    default:
      return t("models.scheduler.unavailable");
  }
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

  const replicaCount = record.spec.replicas?.num ?? 1;
  const shouldShowScheduler = replicaCount > 1;
  const schedulerText = getSchedulerText(
    record.spec.deployment_options?.scheduler?.type,
    t,
  );
  const engineVersion = engineData?.data?.spec.versions.find(
    (v) => v.version === record.spec.engine.version,
  );
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
          descriptionClassName="max-w-none"
          description={
            <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-0.5">
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
              {url && (
                <EndpointAccessSummary serviceUrl={url} className="shrink-0" />
              )}
              <ShowPage.Meta label={t("endpoints.fields.replicas")}>
                {replicaCount}
              </ShowPage.Meta>
              {shouldShowScheduler && (
                <ShowPage.Meta label={t("common.fields.scheduler")}>
                  {schedulerText}
                </ShowPage.Meta>
              )}
              <ShowPage.Meta label={t("common.fields.createdAt")}>
                <Timestamp
                  timestamp={record.metadata.creation_timestamp}
                  relative
                />
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
          className="mt-0 flex-1 space-y-3 overflow-auto pt-4"
        >
          <div className="space-y-3">
            <ShowPage.Section
              title={t("endpoints.sections.runtimeAllocation")}
              actions={
                <EndpointRuntimeResourcesSummary
                  resources={record.status?.resources}
                />
              }
            >
              <div className="space-y-6">
                <EndpointRuntimeResourcesCard
                  resources={record.status?.resources}
                  requestedResources={record.spec.resources}
                />
              </div>
            </ShowPage.Section>
          </div>
          <EndpointAdvancedParameters
            engineParameters={
              record.spec.variables?.engine_args as
                | Record<string, unknown>
                | undefined
            }
            environmentVariables={record.spec.env}
          />
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
                <div className="flex justify-start pb-2">
                  <SegmentedControl
                    ariaLabel={t("common.tabs.monitor")}
                    className="shrink-0"
                    items={panels.map((panel) => ({
                      value: panel,
                      description:
                        panel === "latency"
                          ? t("endpoints.monitor.latencyDescription")
                          : panel === "throughput"
                            ? t("endpoints.monitor.throughputDescription")
                            : panel === "queue"
                              ? t("endpoints.monitor.queueDescription")
                              : panel === "cache"
                                ? t("endpoints.monitor.cacheDescription")
                                : t("endpoints.monitor.overviewDescription"),
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
                </div>
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
          <Suspense fallback={<TabLoader />}>
            <EndpointLogTabs endpoint={record} />
          </Suspense>
        </TabsContent>
        {playground.enabled && (
          <TabsContent
            value="playground"
            className="mt-0 flex-1 overflow-hidden"
          >
            <Suspense fallback={<TabLoader />}>
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
