import {
  type IResourceComponentsProps,
  useList,
  useOne,
  useShow,
} from "@refinedev/core";
import { Check, Copy } from "lucide-react";
import { lazy, Suspense, useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getRayDashboardProxy } from "@/domains/cluster/lib/get-ray-dashboard-proxy";
import { type Cluster, zcacheStatus } from "@/domains/cluster/types";
import { EndpointAccessSummary } from "@/domains/endpoint/components/EndpointAccessSummary";
import { EndpointAdvancedParameters } from "@/domains/endpoint/components/EndpointAdvancedParameters";
import { EndpointCatalogOriginLink } from "@/domains/endpoint/components/EndpointCatalogOrigin";
import EndpointEngine from "@/domains/endpoint/components/EndpointEngine";
import { EndpointKVCacheSummary } from "@/domains/endpoint/components/EndpointKVCacheSummary";
import EndpointModel from "@/domains/endpoint/components/EndpointModel";
import { EndpointPauseAction } from "@/domains/endpoint/components/EndpointPauseAction";
import { EndpointPerformanceCard } from "@/domains/endpoint/components/EndpointPerformanceCard";
import EndpointRuntimeResourcesCard, {
  EndpointRuntimeResourcesSummary,
} from "@/domains/endpoint/components/EndpointRuntimeResourcesCard";
import {
  EndpointSaveAsCatalogAction,
  EndpointSaveAsCatalogProvider,
} from "@/domains/endpoint/components/EndpointSaveAsCatalogAction";
import ModelTask from "@/domains/endpoint/components/ModelTask";
import { useEndpointMonitorPanels } from "@/domains/endpoint/hooks/use-endpoint-monitor-panels";
import { readCatalogOrigin } from "@/domains/endpoint/lib/catalog-origin";
import { schedulerLabel } from "@/domains/endpoint/lib/scheduler";
import { endpointCacheDashboard } from "@/domains/endpoint/lib/zcache";
import type { Endpoint } from "@/domains/endpoint/types";
import { resolvePlayground } from "@/domains/engine/lib/resolve-capabilities";
import type { Engine } from "@/domains/engine/types";
import {
  detailTabsListClassName,
  detailTabTriggerClassName,
} from "@/foundation/components/detail-tabs";
import EndpointStatus from "@/foundation/components/EndpointStatus";
import GrafanaDashboard from "@/foundation/components/GrafanaDashboard";
import { GrafanaDashboardLink } from "@/foundation/components/GrafanaDashboardLink";
import { Loader } from "@/foundation/components/Loader";
import { ModelSourceBadge } from "@/foundation/components/ModelSourceBadge";
import { ObservationStatus } from "@/foundation/components/ObservationStatus";
import { SegmentedControl } from "@/foundation/components/SegmentedControl";
import { ShowButton } from "@/foundation/components/ShowButton";
import { ShowPage } from "@/foundation/components/ShowPage";
import Timestamp from "@/foundation/components/Timestamp";
import { useAcceleratorObservations } from "@/foundation/hooks/use-accelerator-observations";
import { useCopyToClipboard } from "@/foundation/hooks/use-copy-to-clipboard";
import { useSystemApi } from "@/foundation/hooks/use-system-api";
import { nodeL1CacheByNode } from "@/foundation/lib/accelerator-observations";
import {
  parseTflops,
  TFLOPS_ANNOTATION,
} from "@/foundation/lib/accelerator-tflops";
import { getEndpointSplitDashboardProps } from "@/foundation/lib/grafana-dashboard-configs";
import { SELF_HOSTED_MODEL_SOURCE } from "@/foundation/lib/model-source";

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

export const EndpointsShow: React.FC<IResourceComponentsProps> = () => {
  const { t } = useTranslation();
  const { copy, copied } = useCopyToClipboard();
  const { grafanaUrl, systemInfo } = useSystemApi();
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
  const inactive =
    record?.status?.phase === "Paused" || record?.status?.phase === "Deleted";
  const observations = useAcceleratorObservations(
    "endpoints",
    record?.metadata.workspace,
    record?.metadata.name,
    !inactive && onBasicTab,
  );
  const gpuSamples = inactive ? [] : observations.samples;

  const { data: engineData } = useOne<Engine>({
    resource: "engines",
    id: record?.spec.engine.engine,
    queryOptions: {
      enabled: Boolean(record?.spec.engine.engine),
    },
  });

  const { data: clusterData } = useList<Cluster>({
    resource: "clusters",
    meta: {
      workspace: record?.metadata.workspace,
      workspaced: true,
    },
    filters: [
      {
        field: "metadata->name",
        operator: "eq",
        value: JSON.stringify(record?.spec.cluster),
      },
    ],
    queryOptions: {
      enabled: Boolean(record?.spec.cluster),
      refetchInterval: onBasicTab ? 30_000 : false,
    },
  });

  const cluster = clusterData?.data?.[0];
  const cacheStatus = zcacheStatus(cluster);
  const clusterType = cluster?.spec?.type;
  const isSSHCluster = clusterType === "ssh";
  const shouldShowRayDashboard = isSSHCluster;
  const showCacheSummary =
    record?.spec.kv_cache != null ||
    (systemInfo?.capabilities?.cluster_cache_providers?.includes("zcache") ===
      true &&
      cluster?.spec.cache?.provider === "zcache");

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

  const replicaCount = record.spec.replicas?.num ?? 1;
  const shouldShowScheduler = replicaCount > 1;
  const schedulerText =
    schedulerLabel(record.spec.deployment_options?.scheduler?.type, t) ??
    t("models.scheduler.unavailable");
  const engineVersion = engineData?.data?.spec.versions.find(
    (v) => v.version === record.spec.engine.version,
  );
  const playground = resolvePlayground(engineVersion, record.spec.model?.task);
  // Read off the endpoint, never fetched: a record that still reads correctly
  // after its catalog is gone is the point of keeping it here.
  const catalogOrigin = readCatalogOrigin(record.metadata.annotations);
  const kvTransferConfig =
    record.status?.kv_cache?.provider === "zcache"
      ? record.status.kv_cache.details?.kv_transfer_config
      : undefined;

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
            title={
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <span className="truncate">{record.metadata.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  title={t("api_keys.buttons.copy")}
                  aria-label={`${record.metadata.name} ${t("api_keys.buttons.copy")}`}
                  onClick={() =>
                    copy(record.metadata.name, {
                      successMessage: t("components.apiKey.copySuccess"),
                      errorMessage: t("components.apiKey.errors.copyFailed"),
                    })
                  }
                >
                  {copied ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </Button>
              </span>
            }
            descriptionClassName="max-w-none"
            description={
              <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-0.5">
                <ShowPage.Meta label={t("common.fields.model")}>
                  <EndpointModel
                    model={record.spec.model}
                    workspace={record.metadata.workspace}
                  />
                </ShowPage.Meta>
                <ShowPage.Meta label={t("modelSource.label")}>
                  {/* Derived, not stored: an endpoint the platform runs is
                      always self-hosted, so there is nothing to edit here. */}
                  <ModelSourceBadge source={SELF_HOSTED_MODEL_SOURCE} />
                </ShowPage.Meta>
                <ShowPage.Meta label={t("common.fields.task")}>
                  <ModelTask task={record.spec.model?.task} />
                </ShowPage.Meta>
                <ShowPage.Meta label={t("common.fields.engine")}>
                  <EndpointEngine {...record} />
                </ShowPage.Meta>
                {catalogOrigin && (
                  <ShowPage.Meta label={t("endpoints.fields.modelCatalog")}>
                    <EndpointCatalogOriginLink
                      origin={catalogOrigin}
                      workspace={record.metadata.workspace}
                    />
                  </ShowPage.Meta>
                )}
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
                  <EndpointAccessSummary
                    serviceUrl={url}
                    className="shrink-0"
                  />
                )}
                <ShowPage.Meta label={t("endpoints.fields.servedModels")}>
                  {record.status?.served_models?.length ? (
                    <span className="inline-flex flex-wrap gap-1">
                      {record.status.served_models.map((model) => (
                        <code
                          key={model}
                          className="break-all font-mono text-xs"
                        >
                          {model}
                        </code>
                      ))}
                    </span>
                  ) : (
                    "-"
                  )}
                </ShowPage.Meta>
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
            // No phase, no badge: the identity line reads as "name, dash"
            // otherwise, and the dash carries no information there.
            status={
              record.status?.phase ? (
                <EndpointStatus {...record.status} />
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
            {showCacheSummary && (
              <EndpointKVCacheSummary endpoint={record} cluster={cluster} />
            )}
            <EndpointPerformanceCard
              workspace={record.metadata.workspace}
              name={record.metadata.name}
              paused={inactive}
            />
            {!inactive && (
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
                    <ObservationStatus status={observations.status} />
                    <EndpointRuntimeResourcesCard
                      endpointName={record.metadata.name}
                      workspace={record.metadata.workspace ?? "default"}
                      modelName={record.spec.model?.name ?? ""}
                      samples={gpuSamples}
                      observationStatus={observations.status}
                      onObservationRetry={observations.refetch}
                      tflopsOverrides={parseTflops(
                        cluster?.metadata?.annotations?.[TFLOPS_ANNOTATION],
                      )}
                      l1CacheByNode={
                        record.spec.kv_cache?.provider === "zcache"
                          ? nodeL1CacheByNode(cacheStatus?.nodes, gpuSamples)
                          : undefined
                      }
                      resources={record.status?.resources}
                      requestedResources={record.spec.resources}
                      clusterResourceInfo={cluster?.status?.resource_info}
                    />
                  </div>
                </ShowPage.Section>
              </div>
            )}
            <EndpointAdvancedParameters
              engineParameters={{
                ...(record.spec.variables?.engine_args as
                  | Record<string, unknown>
                  | undefined),
                ...(kvTransferConfig
                  ? { kv_transfer_config: kvTransferConfig }
                  : {}),
              }}
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
