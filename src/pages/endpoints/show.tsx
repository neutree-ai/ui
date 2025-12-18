import ChatPlayground from "@/components/business/ChatPlayground";
import EmbeddingPlayground from "@/components/business/EmbeddingPlayground";
import EndpointEngine from "@/components/business/EndpointEngine";
import EndpointModel from "@/components/business/EndpointModel";
import { EndpointPauseAction } from "@/components/business/EndpointPauseAction";
import EndpointStatus from "@/components/business/EndpointStatus";
import GrafanaPanels from "@/components/business/GrafanaPanels";
import JSONSchemaValueVisualizer from "@/components/business/JsonSchemaValueVisualizer";
import MetadataCard from "@/components/business/MetadataCard";
import ModelTask from "@/components/business/ModelTask";
import RerankPlayground from "@/components/business/RerankPlayground";
import { ShowButton, ShowPage } from "@/components/theme";
import Loader from "@/components/theme/components/loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSystemApi } from "@/hooks/use-system-api";
import { getRayDashboardProxy } from "@/lib/api";
import {
  getEndpointGrafanaProps,
  getVllmGrafanaProps,
} from "@/lib/grafana-configs";
import { formatToDecimal } from "@/lib/unit";
import type { Endpoint, Engine } from "@/types";
import {
  type IResourceComponentsProps,
  useList,
  useOne,
  useShow,
} from "@refinedev/core";
import { Suspense, lazy, useCallback, useRef, useState } from "react";
import React from "react";
import { useTranslation } from "react-i18next";

// Lazy load EndpointLogTabs
const EndpointLogTabs = lazy(() =>
  import("@/components/business/EndpointLogTabs").then((module) => ({
    default: module.EndpointLogTabs,
  })),
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
      title={t("endpoints.tabs.rayDashboard")}
    />
  );
};

export const EndpointsShow: React.FC<IResourceComponentsProps> = () => {
  const { t } = useTranslation();
  const { grafanaUrl } = useSystemApi();
  const [monitorView, setMonitorView] = useState<"endpoint" | "vllm">(
    "endpoint",
  );
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

  // Calculate resource display logic
  const resourceDisplay = React.useMemo(() => {
    if (!record?.spec.resources) {
      return {
        hasGpu: false,
        hasNpu: false,
        gpuValue: "-",
        npuValue: "-",
        hasAccelerator: false,
      };
    }

    const accelerator = record.spec.resources.accelerator;
    const gpuField = record.spec.resources.gpu;

    // Check for GPU resources
    const hasGpu = Boolean(gpuField && gpuField > 0);
    const gpuValue = gpuField || "-";

    // Check for NPU resources (NPU count would be in a separate field if supported)
    const hasNpu = false;
    const npuValue = "-";

    const hasAccelerator = Boolean(accelerator?.type && accelerator?.product);

    return { hasGpu, hasNpu, gpuValue, npuValue, hasAccelerator };
  }, [record?.spec.resources]);

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

  const clusterType = clusterData?.data?.[0]?.spec?.type;
  const isSSHCluster = clusterType === "ssh";
  const isVllmEngine = record.spec.engine.engine === "vllm";
  const shouldShowRayDashboard = isSSHCluster;
  const shouldShowMonitorSelector = isSSHCluster && isVllmEngine;
  const shouldShowVllmMetrics =
    shouldShowMonitorSelector && monitorView === "vllm";

  return (
    <ShowPage
      record={record}
      extraActions={() => <EndpointPauseAction endpoint={record} />}
    >
      <Tabs defaultValue="basic" className="h-full">
        <TabsList>
          <TabsTrigger value="basic">{t("endpoints.tabs.basic")}</TabsTrigger>
          {shouldShowRayDashboard && (
            <TabsTrigger value="ray">
              {t("endpoints.tabs.rayDashboard")}
            </TabsTrigger>
          )}
          <TabsTrigger value="monitor">
            {t("endpoints.tabs.monitor")}
          </TabsTrigger>
          <TabsTrigger value="logs">{t("endpoints.tabs.logs")}</TabsTrigger>
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
                  <EndpointStatus {...record.status} />
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
                {resourceDisplay.hasGpu && (
                  <ShowPage.Row title={t("endpoints.fields.gpu")}>
                    {formatToDecimal(resourceDisplay.gpuValue) ?? "-"}
                  </ShowPage.Row>
                )}

                {resourceDisplay.hasNpu && (
                  <ShowPage.Row title={t("endpoints.fields.npu")}>
                    {formatToDecimal(resourceDisplay.npuValue) ?? "-"}
                  </ShowPage.Row>
                )}

                <ShowPage.Row title={t("endpoints.fields.cpu")}>
                  {formatToDecimal(record.spec.resources?.cpu) ?? "-"}
                </ShowPage.Row>
                <ShowPage.Row title={t("endpoints.fields.memory")}>
                  {formatToDecimal(record.spec.resources?.memory) ?? "-"}
                </ShowPage.Row>
              </div>

              {resourceDisplay.hasAccelerator &&
                record.spec.resources?.accelerator && (
                  <div className="mt-4">
                    <ShowPage.Row title={t("endpoints.fields.acceleratorType")}>
                      {t(
                        `clusters.acceleratorTypes.${record.spec.resources.accelerator.type}`,
                        {
                          defaultValue: record.spec.resources.accelerator.type,
                        },
                      )}
                    </ShowPage.Row>
                    <ShowPage.Row
                      title={t("endpoints.fields.acceleratorProduct")}
                    >
                      {record.spec.resources.accelerator.product}
                    </ShowPage.Row>
                  </div>
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
                  {t(
                    `models.scheduler.${record.spec.deployment_options?.scheduler.type === "consistent_hash" ? "consistentHashing" : "powerOfTwo"}`,
                  )}
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
          className="h-[calc(100%-theme('spacing.9'))] overflow-auto"
        >
          {grafanaUrl ? (
            <div className="space-y-4">
              {shouldShowMonitorSelector && (
                <Card className="p-4">
                  <div className="flex items-center justify-start">
                    <Select
                      value={monitorView}
                      onValueChange={(value: "endpoint" | "vllm") =>
                        setMonitorView(value)
                      }
                    >
                      <SelectTrigger className="w-[220px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="endpoint">
                          {t("endpoints.monitor.endpointMetrics")}
                        </SelectItem>
                        <SelectItem value="vllm">
                          {t("endpoints.monitor.vllmMetrics")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground ml-4">
                      {monitorView === "endpoint"
                        ? t("endpoints.monitor.endpointDescription")
                        : t("endpoints.monitor.vllmDescription")}
                    </p>
                  </div>
                </Card>
              )}

              {shouldShowVllmMetrics ? (
                <GrafanaPanels
                  {...getVllmGrafanaProps(
                    grafanaUrl,
                    record.metadata.name,
                    record.spec.cluster,
                  )}
                />
              ) : (
                <GrafanaPanels
                  {...getEndpointGrafanaProps(
                    grafanaUrl,
                    record.metadata.name,
                    record.spec.cluster,
                  )}
                />
              )}
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
