import {
  type IResourceComponentsProps,
  useList,
  useOne,
  useShow,
} from "@refinedev/core";
import { lazy, Suspense, useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getRayDashboardProxy } from "@/domains/cluster/lib/get-ray-dashboard-proxy";
import { type Cluster, zcacheStatus } from "@/domains/cluster/types";
import { EndpointAccessSummary } from "@/domains/endpoint/components/EndpointAccessSummary";
import { EndpointAdvancedParameters } from "@/domains/endpoint/components/EndpointAdvancedParameters";
import { EndpointKVCacheSummary } from "@/domains/endpoint/components/EndpointKVCacheSummary";
import { EndpointPauseAction } from "@/domains/endpoint/components/EndpointPauseAction";
import { EndpointPerformanceCard } from "@/domains/endpoint/components/EndpointPerformanceCard";
import EndpointRuntimeResourcesCard from "@/domains/endpoint/components/EndpointRuntimeResourcesCard";
import {
  EndpointSaveAsCatalogAction,
  EndpointSaveAsCatalogProvider,
} from "@/domains/endpoint/components/EndpointSaveAsCatalogAction";
import { useEndpointMonitorPanels } from "@/domains/endpoint/hooks/use-endpoint-monitor-panels";
import {
  endpointIdentityFields,
  endpointRuntimeFields,
} from "@/domains/endpoint/lib/detail-fields";
import {
  endpointEngineVersion,
  endpointShowQueries,
  isEndpointInactive,
  rayServeApplicationUrl,
  runtimeCardIdentity,
  shownEngineParameters,
} from "@/domains/endpoint/lib/endpoint-display-show";
import {
  endpointCacheDashboard,
  endpointZCacheOptions,
} from "@/domains/endpoint/lib/zcache";
import type { Endpoint } from "@/domains/endpoint/types";
import { resolvePlayground } from "@/domains/engine/lib/resolve-capabilities";
import type { Engine } from "@/domains/engine/types";
import { gpuAllocations as collectGpuAllocations } from "@/foundation/accelerator/accelerator-observations";
import {
  parseTflops,
  TFLOPS_ANNOTATION,
} from "@/foundation/accelerator/accelerator-tflops";
import { useAcceleratorObservations } from "@/foundation/accelerator/use-accelerator-observations";
import { Loader } from "@/foundation/components/Loader";
import { endpointPhases } from "@/foundation/endpoint-phase/endpoint-phases";
import GrafanaDashboard from "@/foundation/grafana/GrafanaDashboard";
import { GrafanaDashboardLink } from "@/foundation/grafana/GrafanaDashboardLink";
import { getEndpointSplitDashboardProps } from "@/foundation/grafana/grafana-dashboard-configs";
import { useSystemApi } from "@/foundation/hooks/use-system-api";
import { PhaseStatus } from "@/foundation/role/PhaseStatus";
import { DetailFields } from "@/foundation/scene/DetailFields";
import {
  detailTabsListClassName,
  detailTabTriggerClassName,
} from "@/foundation/scene/detail-tabs";
import { MetadataTimestampMeta } from "@/foundation/scene/MetadataTimestampMeta";
import { ShowPage } from "@/foundation/scene/ShowPage";
import { SegmentedControl } from "@/foundation/type/SegmentedControl";

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
      src={rayServeApplicationUrl(rayDashboardUrl, record)}
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
  // Live observations and the polling that feeds them only serve the basic
  // tab, so the other tabs do not keep refetching and re-rendering the page.
  const [tab, setTab] = useState("basic");
  const onBasicTab = tab === "basic";
  const {
    query: { data, isLoading },
  } = useShow<Endpoint>({
    queryOptions: { refetchInterval: onBasicTab ? 15000 : false },
  });
  const record = data?.data;
  const inactive = isEndpointInactive(record);
  const queries = endpointShowQueries(record);
  const observations = useAcceleratorObservations(
    "endpoints",
    record?.metadata.workspace,
    record?.metadata.name,
    !inactive && onBasicTab,
  );
  const gpuSamples = inactive ? [] : observations.samples;
  // Cluster-wide samples only feed the GPU details sheet, so they are polled
  // only while one is open.
  const [gpuDetailsOpen, setGpuDetailsOpen] = useState(false);
  const deviceObservations = useAcceleratorObservations(
    "clusters",
    record?.metadata.workspace,
    record?.spec.cluster,
    !inactive && onBasicTab && gpuDetailsOpen,
  );
  const deviceSamples = inactive ? [] : deviceObservations.samples;

  const { data: engineData } = useOne<Engine>({
    resource: "engines",
    id: queries.engine.id,
    queryOptions: { enabled: queries.engine.enabled },
  });

  const { data: clusterData } = useList<Cluster>({
    resource: "clusters",
    meta: queries.cluster.meta,
    filters: queries.cluster.filters,
    queryOptions: {
      enabled: queries.cluster.enabled,
      refetchInterval: onBasicTab ? 30_000 : false,
    },
  });
  const { data: clusterEndpoints } = useList<Endpoint>({
    resource: "endpoints",
    meta: queries.clusterEndpoints.meta,
    filters: queries.clusterEndpoints.filters,
    pagination: { mode: "off" },
    queryOptions: {
      enabled: queries.clusterEndpoints.enabled,
      refetchInterval: onBasicTab ? 15_000 : false,
    },
  });
  const clusterGpuAllocations = useMemo(
    () => collectGpuAllocations(clusterEndpoints?.data ?? []),
    [clusterEndpoints?.data],
  );

  const cluster = clusterData?.data?.[0];
  const cacheStatus = zcacheStatus(cluster);
  const clusterType = cluster?.spec?.type;
  const isSSHCluster = clusterType === "ssh";
  const shouldShowRayDashboard = isSSHCluster;
  const cacheConfigured =
    endpointZCacheOptions(clusterData?.data?.[0])?.enabled === true;

  const {
    panels,
    selectedPanel,
    setSelectedPanel,
    showMonitorTab,
    showSelector,
  } = useEndpointMonitorPanels({
    engineType: record?.spec.engine.engine,
  });

  const url = record?.status?.service_url;

  if (isLoading) {
    return <Loader className="h-4 text-primary" />;
  }

  if (!record) {
    return <div>{t("pages.error.notFound")}</div>;
  }

  const monitorDashboardProps =
    grafanaUrl && selectedPanel
      ? getEndpointSplitDashboardProps(grafanaUrl, selectedPanel, {
          clusterName: record.spec.cluster,
          endpointName: record.metadata.name,
          cache: endpointCacheDashboard({
            workspace: record.metadata.workspace,
            provider: record.spec.kv_cache?.provider,
            cacheStatus,
          }),
        })
      : null;

  const engineVersion = endpointEngineVersion(
    engineData?.data?.spec.versions,
    record,
  );
  const playground = resolvePlayground(engineVersion, record.spec.model?.task);

  return (
    <EndpointSaveAsCatalogProvider>
      <ShowPage
        record={record}
        showCurrentBreadcrumb={false}
        extraActions={() => (
          <>
            <EndpointPauseAction endpoint={record} />
            <EndpointSaveAsCatalogAction endpoint={record} />
          </>
        )}
      >
        <Tabs
          value={tab}
          onValueChange={setTab}
          className="flex h-full flex-col"
        >
          <ShowPage.ObjectHeader
            title={record.metadata.name}
            descriptionClassName="max-w-none"
            description={
              <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-0.5">
                <DetailFields
                  inline
                  fields={endpointIdentityFields(record)}
                  record={record}
                />
                {url && (
                  <EndpointAccessSummary
                    serviceUrl={url}
                    className="shrink-0"
                  />
                )}
                <DetailFields
                  inline
                  fields={endpointRuntimeFields(record)}
                  record={record}
                />
                <MetadataTimestampMeta metadata={record.metadata} />
              </span>
            }
            // No phase, no badge: the identity line reads as "name, dash"
            // otherwise, and the dash carries no information there.
            status={
              record.status?.phase ? (
                <PhaseStatus status={record.status} phases={endpointPhases} />
              ) : undefined
            }
          />
          <TabsList className={detailTabsListClassName}>
            <TabsTrigger value="basic" className={detailTabTriggerClassName}>
              {t("common.tabs.basic")}
            </TabsTrigger>
            {shouldShowRayDashboard && (
              <TabsTrigger value="ray" className={detailTabTriggerClassName}>
                {t("common.tabs.rayDashboard")}
              </TabsTrigger>
            )}
            {showMonitorTab && (
              <TabsTrigger
                value="monitor"
                className={detailTabTriggerClassName}
              >
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
            <EndpointPerformanceCard
              workspace={record.metadata.workspace}
              name={record.metadata.name}
              paused={inactive}
              showKvCache={cacheConfigured}
            />
            {!inactive && (
              <EndpointRuntimeResourcesCard
                {...runtimeCardIdentity(record)}
                gpuAllocations={clusterGpuAllocations}
                samples={gpuSamples}
                deviceSamples={deviceSamples}
                observationStatus={observations.status}
                deviceObservationStatus={deviceObservations.status}
                onObservationRetry={observations.refetch}
                onDeviceObservationRetry={deviceObservations.refetch}
                onGpuDetailsOpenChange={setGpuDetailsOpen}
                tflopsOverrides={parseTflops(
                  clusterData?.data?.[0]?.metadata?.annotations?.[
                    TFLOPS_ANNOTATION
                  ],
                )}
                resources={record.status?.resources}
                requestedResources={record.spec.resources}
                clusterResourceInfo={
                  clusterData?.data?.[0]?.status?.resource_info
                }
              />
            )}
            {cacheConfigured && (
              <EndpointKVCacheSummary
                endpoint={record}
                cluster={clusterData?.data?.[0]}
              />
            )}
            <EndpointAdvancedParameters
              engineParameters={shownEngineParameters(record)}
              environmentVariables={record.spec.env}
            />
          </TabsContent>
          {shouldShowRayDashboard && (
            <TabsContent value="ray" className="mt-0 flex-1">
              <RayDashboardTab record={record} cluster={cluster} />
            </TabsContent>
          )}
          <TabsContent
            value="monitor"
            className="mt-0 flex-1 overflow-hidden pt-4"
          >
            {grafanaUrl ? (
              <div className="flex flex-col gap-4 h-full">
                <div className="flex items-center justify-between gap-4 pb-2">
                  {showSelector && (
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
                  )}
                  {monitorDashboardProps && (
                    <div className="ml-auto shrink-0">
                      <GrafanaDashboardLink {...monitorDashboardProps} />
                    </div>
                  )}
                </div>

                {monitorDashboardProps ? (
                  <GrafanaDashboard
                    {...monitorDashboardProps}
                    className="flex-1"
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
            className="mt-0 flex-1 overflow-hidden pt-4"
          >
            <Suspense fallback={<TabLoader />}>
              <EndpointLogTabs endpoint={record} clusterType={clusterType} />
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
    </EndpointSaveAsCatalogProvider>
  );
};
