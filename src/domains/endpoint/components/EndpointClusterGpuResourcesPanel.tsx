import { Cpu } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { GpuDeviceResourcesView } from "@/foundation/components/GpuDeviceResourcesView";
import { buildGpuCardResourceRows } from "@/foundation/lib/gpu-device-resources";
import type { ClusterResourceInfo } from "@/foundation/types/resource-types";

type SelectedAccelerator = {
  type?: string | null;
  product?: string | null;
};

type EndpointClusterGpuResourcesPanelProps = {
  resourceInfo: ClusterResourceInfo | null | undefined;
  currentCluster?: string | null;
  selectedAccelerator?: SelectedAccelerator | null;
  virtualizationEnabled: boolean;
  request?: EndpointResourceRequestContext;
  t: (key: string, options?: { defaultValue?: string }) => string;
};

type ResourceMetricProps = {
  label: string;
  value: string;
  remaining?: string;
  remainingLabel?: string;
  percent?: number;
};

type EndpointGpuResourceSummaryMetricsProps = {
  rows: ReturnType<typeof buildGpuCardResourceRows>;
  virtualizationEnabled: boolean;
  t: (key: string, options?: { defaultValue?: string }) => string;
  includeProductCount?: boolean;
  testId?: string;
  className?: string;
};

type EndpointResourceRequestContext = {
  allocationMode: "full" | "vgpu";
  requestedFullGpuCards: number;
  fullGpuCardCapacity: number;
  fullGpuCapacityExceeded: boolean;
  requestedVgpuSlices: number;
  totalVgpuSliceCapacity: number;
  requestedVgpuMemoryMiB: number;
  availableVgpuMemoryMiB: number;
  requestedVgpuCoreUnits: number;
  availableVgpuCoreUnits: number;
  memoryMiBPerSlice?: number | null;
  coreUnitsPerSlice?: number | null;
  vgpuCapacityExceeded: boolean;
};

const formatCount = (value: number | null | undefined) =>
  value == null ? "-" : String(value);

const summarizeResourcePool = (
  total: number | null | undefined,
  available: number | null | undefined,
) => {
  const normalizedTotal = total ?? 0;
  const normalizedAvailable = available ?? 0;
  const used = Math.max(0, normalizedTotal - normalizedAvailable);

  return {
    available: normalizedAvailable,
    total: normalizedTotal,
    used,
    percent:
      normalizedTotal > 0 ? Math.round((used / normalizedTotal) * 100) : 0,
  };
};

const summarizeRows = (
  rows: ReturnType<typeof buildGpuCardResourceRows>,
  field: "quantity" | "memory" | "core",
) => {
  const totals = rows.reduce(
    (acc, row) => {
      const pool = row[field];
      return {
        total: acc.total + (pool.total ?? 0),
        used: acc.used + (pool.used ?? 0),
        available: acc.available + (pool.available ?? 0),
      };
    },
    { total: 0, used: 0, available: 0 },
  );

  return {
    ...totals,
    percent:
      totals.total > 0 ? Math.round((totals.used / totals.total) * 100) : 0,
  };
};

const ResourceMetric = ({
  label,
  value,
  remaining,
  remainingLabel,
  percent,
}: ResourceMetricProps) => (
  <div className="rounded-md bg-muted/40 px-3 py-2">
    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>{label}</span>
      {percent !== undefined && (
        <span className="tabular-nums">{percent}%</span>
      )}
    </div>
    <div className="mt-1 text-sm font-medium tabular-nums">{value}</div>
    {percent !== undefined && <Progress value={percent} className="mt-2 h-2" />}
    {remaining && remainingLabel && (
      <div className="mt-1 flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{remainingLabel}</span>
        <span className="tabular-nums">{remaining}</span>
      </div>
    )}
  </div>
);

function EndpointGpuResourceSummaryMetrics({
  rows,
  virtualizationEnabled,
  t,
  includeProductCount = false,
  testId,
  className,
}: EndpointGpuResourceSummaryMetricsProps) {
  const quantitySummary = useMemo(
    () => summarizeRows(rows, "quantity"),
    [rows],
  );
  const memorySummary = useMemo(() => summarizeRows(rows, "memory"), [rows]);
  const coreSummary = useMemo(() => summarizeRows(rows, "core"), [rows]);
  const columnsClass = includeProductCount
    ? "sm:grid-cols-2"
    : virtualizationEnabled
      ? "sm:grid-cols-3"
      : "sm:grid-cols-1";

  return (
    <div
      data-testid={testId}
      className={["grid gap-2", columnsClass, className]
        .filter(Boolean)
        .join(" ")}
    >
      {includeProductCount && (
        <ResourceMetric
          label={t("clusters.fields.cardProducts")}
          value={formatCount(rows.length)}
        />
      )}
      <ResourceMetric
        label={t("clusters.fields.physicalGpu")}
        value={`${formatCount(quantitySummary.used)} / ${formatCount(
          quantitySummary.total,
        )}`}
        remaining={formatCount(quantitySummary.available)}
        remainingLabel={t("clusters.fields.remaining")}
        percent={quantitySummary.percent}
      />
      {virtualizationEnabled && (
        <>
          <ResourceMetric
            label={t("clusters.fields.memoryUsage")}
            value={`${formatCount(memorySummary.used)} / ${formatCount(
              memorySummary.total,
            )} MiB`}
            remaining={`${formatCount(memorySummary.available)} MiB`}
            remainingLabel={t("clusters.fields.remaining")}
            percent={memorySummary.percent}
          />
          <ResourceMetric
            label={t("clusters.fields.coreUsage")}
            value={`${formatCount(coreSummary.used)} / ${formatCount(
              coreSummary.total,
            )}`}
            remaining={formatCount(coreSummary.available)}
            remainingLabel={t("clusters.fields.remaining")}
            percent={coreSummary.percent}
          />
        </>
      )}
    </div>
  );
}

function EndpointClusterResourceSummary({
  resourceInfo,
  t,
}: {
  resourceInfo: ClusterResourceInfo;
  t: (key: string, options?: { defaultValue?: string }) => string;
}) {
  const cpuSummary = summarizeResourcePool(
    resourceInfo.allocatable?.cpu,
    resourceInfo.available?.cpu,
  );
  const memorySummary = summarizeResourcePool(
    resourceInfo.allocatable?.memory,
    resourceInfo.available?.memory,
  );

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <ResourceMetric
        label={t("common.fields.cpu")}
        value={`${formatCount(cpuSummary.used)} / ${formatCount(
          cpuSummary.total,
        )} cores`}
        remaining={`${formatCount(cpuSummary.available)} cores`}
        remainingLabel={t("clusters.fields.remaining")}
        percent={cpuSummary.percent}
      />
      <ResourceMetric
        label={t("common.fields.memory")}
        value={`${formatCount(memorySummary.used)} / ${formatCount(
          memorySummary.total,
        )} GiB`}
        remaining={`${formatCount(memorySummary.available)} GiB`}
        remainingLabel={t("clusters.fields.remaining")}
        percent={memorySummary.percent}
      />
    </div>
  );
}

export function EndpointClusterGpuResourcesPanel({
  resourceInfo,
  currentCluster,
  selectedAccelerator,
  virtualizationEnabled,
  request,
  t,
}: EndpointClusterGpuResourcesPanelProps) {
  const title = t("clusters.sections.clusterResources");
  const rows = useMemo(
    () => buildGpuCardResourceRows(resourceInfo, selectedAccelerator),
    [resourceInfo, selectedAccelerator],
  );
  const summaryRows = useMemo(
    () =>
      selectedAccelerator?.product
        ? rows.filter((row) => row.matchesSelectedAccelerator)
        : rows,
    [rows, selectedAccelerator?.product],
  );
  const selectedProduct = selectedAccelerator?.product;

  if (!resourceInfo) {
    return (
      <div className="rounded-md border p-4 text-sm">
        <div className="font-medium">{title}</div>
        <div className="mt-2 text-muted-foreground">
          {currentCluster
            ? t("endpoints.messages.clusterResourcesUnavailable")
            : t("endpoints.placeholders.selectCluster")}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Cpu className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="text-sm font-medium">{title}</div>
            <div className="truncate text-xs text-muted-foreground">
              {selectedProduct
                ? `${t("clusters.fields.selected")}: ${selectedProduct}`
                : t("endpoints.messages.noAcceleratorSelected")}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {currentCluster && (
            <Badge variant="outline" className="font-normal">
              {currentCluster}
            </Badge>
          )}
          {selectedProduct && (
            <Badge variant="secondary" className="font-normal">
              {selectedProduct}
            </Badge>
          )}
        </div>
      </div>

      <div className="max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
        <EndpointClusterGpuResourcesInlineContent
          resourceInfo={resourceInfo}
          selectedAccelerator={selectedAccelerator}
          virtualizationEnabled={virtualizationEnabled}
          summaryRows={summaryRows}
          request={request}
          t={t}
        />
      </div>
    </div>
  );
}

function EndpointClusterGpuResourcesInlineContent({
  resourceInfo,
  selectedAccelerator,
  virtualizationEnabled,
  summaryRows,
  request,
  t,
}: {
  resourceInfo: ClusterResourceInfo;
  selectedAccelerator?: SelectedAccelerator | null;
  virtualizationEnabled: boolean;
  summaryRows: ReturnType<typeof buildGpuCardResourceRows>;
  request?: EndpointResourceRequestContext;
  t: (key: string, options?: { defaultValue?: string }) => string;
}) {
  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium">
            {t("clusters.sections.clusterResources")}
          </h3>
        </div>
        <EndpointClusterResourceSummary resourceInfo={resourceInfo} t={t} />
        <EndpointGpuResourceSummaryMetrics
          rows={summaryRows}
          virtualizationEnabled={virtualizationEnabled}
          t={t}
          includeProductCount={true}
        />
      </section>
      <section className="space-y-3 border-t pt-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium">
            {t("clusters.sections.nodeResources")}
          </h3>
        </div>
        <GpuDeviceResourcesView
          nodeResources={resourceInfo.node_resources}
          selectedAccelerator={selectedAccelerator}
          labels={{
            title: t("clusters.sections.nodeResources"),
            deviceCount: t("clusters.fields.deviceCount"),
            healthyDevices: t("clusters.fields.healthyDevices"),
            memoryUsage: t("clusters.fields.memoryUsage"),
            coreUsage: t("clusters.fields.coreUsage"),
            allProducts: t("clusters.options.allGpuProducts"),
            allNodes: t("clusters.options.allNodes"),
            searchPlaceholder: t("clusters.placeholders.searchGpuDevices"),
            gpuNumber: t("clusters.fields.gpuNumber"),
            uuid: t("clusters.fields.deviceUuid"),
            status: t("common.fields.status"),
            healthy: t("clusters.options.healthy"),
            unhealthy: t("clusters.options.unhealthy"),
            node: t("clusters.fields.nodeName"),
            product: t("common.fields.acceleratorProduct"),
            selected: t("clusters.fields.selected"),
            usable: t("clusters.options.usable"),
            free: t("clusters.options.free"),
            allocated: t("clusters.options.allocated"),
            resourceScope: t("clusters.fields.resourceScope"),
            freeCards: t("clusters.options.freeCards"),
            usableForRequest: t("clusters.options.usableForRequest"),
            copyUuid: t("clusters.actions.copyUuid"),
            copyUuidSuccess: t("clusters.messages.copyUuidSuccess"),
            copyUuidFailed: t("clusters.messages.copyUuidFailed"),
            remaining: t("clusters.fields.remaining"),
            usedSlashTotal: t("clusters.fields.usedSlashTotal"),
            empty: t("clusters.messages.noGpuDevices"),
          }}
          variant="cards"
          showHeader={false}
          showFilters={false}
          showSummary={false}
          showResourceControls={true}
          resourceControlsTestId="endpoint-resource-toolbar"
          request={
            request
              ? {
                  allocationMode: request.allocationMode,
                  memoryMiBPerSlice: request.memoryMiBPerSlice,
                  coreUnitsPerSlice: request.coreUnitsPerSlice,
                }
              : undefined
          }
          className="border-0 p-0"
        />
      </section>
    </div>
  );
}
