import {
  ChevronDown,
  CircleAlert,
  CircleCheck,
  Copy,
  Cpu,
  Server,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Disclosure } from "@/foundation/components/Disclosure";
import { EmptyState } from "@/foundation/components/EmptyState";
import { EMPTY_VALUE, EmptyValue } from "@/foundation/components/EmptyValue";
import {
  MetricBar,
  type MetricBarSeries,
} from "@/foundation/components/MetricBar";
import { useCopyToClipboard } from "@/foundation/hooks/use-copy-to-clipboard";
import { useIsTruncated } from "@/foundation/hooks/use-is-truncated";
import {
  buildGpuCardResourceRows,
  buildGpuDeviceResourceRows,
  buildNodePhysicalGpuResourceRows,
  GPU_CELL_CLASS,
  GPU_GRID_CELL_CLASS,
  GPU_GRID_CLASS,
  GPU_GRID_FRAME_CLASS,
  GPU_GRID_STYLE,
  GPU_USAGE_TEXT_CLASS,
  type GpuDeviceResourceRow,
  getFractionalGpuCoreRequirement,
} from "@/foundation/lib/gpu-device-resources";
import { cn } from "@/foundation/lib/utils";
import type {
  ClusterResourceInfo,
  DeviceResource,
  NodeResourceStatus,
} from "@/foundation/types/resource-types";

type SelectedAccelerator = {
  type?: string | null;
  product?: string | null;
};

type Translate = (key: string, options?: Record<string, unknown>) => string;

type EndpointClusterGpuResourcesPanelProps = {
  resourceInfo: ClusterResourceInfo | null | undefined;
  schedulingNodeResources?: ClusterResourceInfo["node_resources"];
  currentCluster?: string | null;
  nodeCount?: number | null;
  selectedAccelerator?: SelectedAccelerator | null;
  virtualizationEnabled: boolean;
  request?: EndpointResourceRequestContext;
  inset?: boolean;
  t: Translate;
};

type EndpointResourceRequestContext = {
  allocationMode: "full" | "fractional" | "vgpu";
  gpuPerReplica?: number | null;
  cpuPerReplica?: number | null;
  memoryPerReplica?: number | null;
  requestedFullGpuCards: number;
  fullGpuCardCapacity: number;
  fullGpuCapacityExceeded: boolean;
  requestedVirtualCards: number;
  totalVirtualCardCapacity: number;
  requestedVgpuMemoryMiB: number;
  availableVgpuMemoryMiB: number;
  requestedVgpuCoreUnits: number;
  availableVgpuCoreUnits: number;
  memoryMiBPerCard?: number | null;
  coreUnitsPerCard?: number | null;
  vgpuCapacityExceeded: boolean;
};

const VRAM_VALUE_SCALE = 1 / 1024;
const ACCELERATOR_USAGE_WARNING_PERCENT = 75;

const formatCount = (value: number | null | undefined): string => {
  if (value == null) return EMPTY_VALUE;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toFixed(1) : EMPTY_VALUE;
};

const scaleMetricValue = (
  value: number | null | undefined,
  valueScale: number,
) => {
  if (value == null) return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue * valueScale : null;
};

const formatUsage = (
  used: number | null | undefined,
  total: number | null | undefined,
  unit = "",
  valueScale = 1,
): ReactNode => {
  if (used == null || total == null) {
    return <EmptyValue />;
  }

  return `${formatCount(scaleMetricValue(used, valueScale))} / ${formatCount(scaleMetricValue(total, valueScale))}${unit}`;
};

const formatPoolValue = (
  value: number | null | undefined,
  unit = "",
  valueScale = 1,
): ReactNode =>
  value == null ? (
    <EmptyValue />
  ) : (
    `${formatCount(scaleMetricValue(value, valueScale))}${unit}`
  );

/**
 * Tooltip text for a reading built by the formatters above: the value itself,
 * or nothing when it is a placeholder (a tooltip repeating "-" says nothing).
 */
const readingTitle = (value: ReactNode) =>
  typeof value === "string" ? value : undefined;

const formatUnitLabel = (unit: string | undefined) => unit?.trim() ?? "";

const toPercentValue = (
  used: number | null | undefined,
  total: number | null | undefined,
) => {
  const numericUsed = Number(used ?? 0);
  const numericTotal = Number(total ?? 0);
  if (!Number.isFinite(numericUsed) || numericTotal <= 0) return 0;

  return Number(((numericUsed / numericTotal) * 100).toFixed(1));
};

const formatPercent = (value: number) => `${formatCount(value)}%`;

const summarizeResourcePool = (
  total: number | null | undefined,
  available: number | null | undefined,
) => {
  const normalizedTotal = total ?? null;
  const normalizedAvailable = available ?? null;
  const used =
    normalizedTotal == null || normalizedAvailable == null
      ? null
      : Math.max(0, normalizedTotal - normalizedAvailable);

  return {
    available: normalizedAvailable,
    total: normalizedTotal,
    used,
    percent: toPercentValue(used, normalizedTotal),
  };
};

const sumOptionalNumbers = (values: Array<number | null | undefined>) => {
  let hasValue = false;
  let total = 0;

  for (const value of values) {
    if (value == null) continue;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) continue;
    hasValue = true;
    total += numericValue;
  }

  return hasValue ? total : null;
};

const summarizeRows = (
  rows: ReturnType<typeof buildGpuCardResourceRows>,
  field: "quantity" | "memory" | "core",
) => {
  const totals = {
    total: sumOptionalNumbers(rows.map((row) => row[field].total)),
    used: sumOptionalNumbers(rows.map((row) => row[field].used)),
    available: sumOptionalNumbers(rows.map((row) => row[field].available)),
  };

  return {
    ...totals,
    percent: toPercentValue(totals.used, totals.total),
  };
};

const sumGpuDeviceRowPool = (
  rows: GpuDeviceResourceRow[],
  field: "memory" | "core",
  key: "available" | "total" | "used",
) => sumOptionalNumbers(rows.map((row) => row[field][key]));

const hasPositiveMetric = (value: number | null | undefined) => {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) && numericValue > 0;
};

const hasGpuResourceRows = (
  rows: ReturnType<typeof buildGpuCardResourceRows>,
) =>
  rows.some(
    (row) =>
      hasPositiveMetric(row.quantity.total) ||
      hasPositiveMetric(row.quantity.available),
  );

const hasNodeDeviceResources = (
  nodeResources: Record<string, NodeResourceStatus> | null | undefined,
) =>
  Object.values(nodeResources ?? {}).some(
    (nodeStatus) => (nodeStatus.devices?.length ?? 0) > 0,
  );

const getAcceleratorUsageClasses = (percent: number) =>
  percent >= ACCELERATOR_USAGE_WARNING_PERCENT
    ? {
        progress:
          "bg-[var(--nt-fill-notice-light)] [&>div]:bg-[var(--nt-fill-notice-base)]",
        text: "text-[var(--nt-fill-notice-base)]",
      }
    : {
        progress:
          "bg-[var(--nt-fill-positive-light)] [&>div]:bg-[var(--nt-fill-positive-base)]",
        text: "text-[var(--nt-fill-positive-base)]",
      };

type GpuAvailability = "usable" | "allocated" | "unhealthy" | "other-type";

const getGpuAvailabilityClasses = (
  availability: GpuAvailability,
  percent: number,
) => {
  if (availability === "unhealthy") {
    return {
      progress:
        "bg-[var(--nt-fill-serious-light)] [&>div]:bg-[var(--nt-fill-serious-base)]",
      text: "text-[var(--nt-text-colorful-serious)]",
    };
  }
  if (availability === "allocated") {
    return {
      progress:
        "bg-[var(--nt-fill-notice-light)] [&>div]:bg-[var(--nt-fill-notice-base)]",
      text: "text-[var(--nt-text-colorful-notice)]",
    };
  }
  if (availability === "other-type") {
    return {
      progress:
        "bg-[var(--nt-fill-neutral-trans-3)] [&>div]:bg-[var(--nt-text-neutral-quaternary)]",
      text: "text-muted-foreground",
    };
  }
  return getAcceleratorUsageClasses(percent);
};

type ResourceSummaryMetric = {
  label: string;
  used: number | null | undefined;
  total: number | null | undefined;
  available: number | null | undefined;
  unit?: string;
  valueScale?: number;
  series: MetricBarSeries;
};

function ResourceMetricLabel({
  label,
  unit,
  className,
}: {
  label: string;
  unit?: string;
  className?: string;
}) {
  const unitLabel = formatUnitLabel(unit);

  return (
    <div
      className={cn("flex min-w-0 items-baseline gap-1.5", className)}
      title={label}
    >
      <span className="min-w-0 truncate">{label}</span>
      {unitLabel && (
        <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
          {unitLabel}
        </span>
      )}
    </div>
  );
}

type ResourceMetricTestIds = {
  item: string;
  progress: string;
  usedValue: string;
  totalValue: string;
  freeValue: string;
  percent: string;
};

const CLUSTER_RESOURCE_METRIC_TEST_IDS: ResourceMetricTestIds = {
  item: "endpoint-resource-summary-card",
  progress: "endpoint-resource-summary-progress",
  usedValue: "endpoint-resource-summary-used-value",
  totalValue: "endpoint-resource-summary-total-value",
  freeValue: "endpoint-resource-summary-free-value",
  percent: "endpoint-resource-summary-percent",
};

const NODE_RESOURCE_METRIC_TEST_IDS: ResourceMetricTestIds = {
  item: "endpoint-node-resource-pill",
  progress: "endpoint-node-resource-progress",
  usedValue: "endpoint-node-resource-pill-used-value",
  totalValue: "endpoint-node-resource-pill-total-value",
  freeValue: "endpoint-node-resource-pill-free-value",
  percent: "endpoint-node-resource-pill-percent",
};

function ResourceMetricCard({
  metric,
  testIds,
  t,
}: {
  metric: ResourceSummaryMetric;
  testIds: ResourceMetricTestIds;
  t: (
    key: string,
    options?: { defaultValue?: string; count?: number },
  ) => string;
}) {
  const percent = toPercentValue(metric.used, metric.total);
  const totalText = formatPoolValue(metric.total, "", metric.valueScale);
  const usedText = formatPoolValue(metric.used, "", metric.valueScale);
  const freeText = formatPoolValue(metric.available, "", metric.valueScale);

  return (
    <div data-testid={testIds.item} className="grid min-w-0 gap-1.5">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <ResourceMetricLabel
          label={metric.label}
          unit={metric.unit}
          className="text-xs font-semibold"
        />
        <span
          data-testid={testIds.totalValue}
          className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground"
          title={readingTitle(totalText)}
        >
          {totalText} {t("clusters.options.total").toLowerCase()}
        </span>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <MetricBar
            data-testid={testIds.progress}
            value={percent}
            size="sm"
            series={metric.series}
            tabIndex={0}
            aria-label={`${metric.label}: ${formatPercent(percent)}`}
            className="focus-visible:outline-none focus-visible:[box-shadow:var(--nt-outline-active-focus)]"
          />
        </TooltipTrigger>
        <TooltipContent data-testid={testIds.percent}>
          {formatPercent(percent)}
        </TooltipContent>
      </Tooltip>
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        <span className="min-w-0 tabular-nums">
          {t("clusters.options.used")}{" "}
          <strong
            data-testid={testIds.usedValue}
            className="font-semibold text-foreground"
            title={readingTitle(usedText)}
          >
            {usedText}
          </strong>
        </span>
        <span className="shrink-0 tabular-nums" title={readingTitle(freeText)}>
          <strong
            data-testid={testIds.freeValue}
            className="font-semibold text-foreground"
          >
            {freeText}
          </strong>{" "}
          {t("clusters.options.free").toLowerCase()}
        </span>
      </div>
    </div>
  );
}

function ResourceMetricGrid({
  items,
  testId,
  testIds,
  className,
  t,
}: {
  items: ResourceSummaryMetric[];
  testId: string;
  testIds: ResourceMetricTestIds;
  className?: string;
  t: (key: string, options?: { defaultValue?: string }) => string;
}) {
  return (
    <div
      data-testid={testId}
      className={cn(
        "grid min-w-0 grid-cols-2 gap-x-6 gap-y-4 min-[1920px]:grid-cols-4",
        className,
      )}
    >
      {items.map((metric) => (
        <ResourceMetricCard
          key={`${metric.label}:${metric.unit ?? ""}`}
          metric={metric}
          testIds={testIds}
          t={t}
        />
      ))}
    </div>
  );
}

function GpuMeterRow({
  label,
  used,
  total,
  available,
  availability,
  unit,
  valueScale = 1,
  t,
}: {
  label: string;
  used: number | null | undefined;
  total: number | null | undefined;
  available: number | null | undefined;
  availability: GpuAvailability;
  unit?: string;
  valueScale?: number;
  t: (key: string, options?: { defaultValue?: string }) => string;
}) {
  const percent = toPercentValue(used, total);
  const usageClasses = getGpuAvailabilityClasses(availability, percent);
  const usageText = formatUsage(used, total, unit, valueScale);
  const freeValue = formatPoolValue(available, unit, valueScale);
  const freeText = (
    <>
      {t("clusters.options.free")} {freeValue}
    </>
  );
  const freeTitle =
    typeof freeValue === "string"
      ? `${t("clusters.options.free")} ${freeValue}`
      : undefined;

  return (
    <div
      className="grid gap-1"
      data-testid="endpoint-gpu-meter-row"
      data-availability={availability}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <strong
          className={cn(
            "shrink-0 font-semibold tabular-nums",
            GPU_USAGE_TEXT_CLASS,
            usageClasses.text,
          )}
          title={formatPercent(percent)}
        >
          {formatPercent(percent)}
        </strong>
      </div>
      <Progress
        data-testid="endpoint-gpu-resource-progress"
        value={percent}
        className={cn("h-1", usageClasses.progress)}
      />
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5",
          GPU_USAGE_TEXT_CLASS,
        )}
      >
        <span
          className="min-w-0 break-words tabular-nums text-muted-foreground"
          title={readingTitle(usageText)}
        >
          {usageText}
        </span>
        <strong
          className={cn(
            "shrink-0 font-semibold tabular-nums",
            usageClasses.text,
          )}
          title={freeTitle}
        >
          {freeText}
        </strong>
      </div>
    </div>
  );
}

function GpuDeviceCard({
  row,
  usable,
  copyUuid,
  t,
}: {
  row: GpuDeviceResourceRow;
  usable: boolean;
  copyUuid: (uuid: string) => void;
  t: (key: string, options?: { defaultValue?: string }) => string;
}) {
  const productRef = useRef<HTMLSpanElement>(null);
  const productTruncated = useIsTruncated(productRef);
  const productLabel = (
    <span
      ref={productRef}
      tabIndex={productTruncated ? 0 : undefined}
      className={cn(
        "mt-1 block min-w-0 truncate text-xs leading-4 text-muted-foreground",
        productTruncated &&
          "focus-visible:outline-none focus-visible:[box-shadow:var(--nt-outline-active-focus)]",
      )}
    >
      {row.product || <EmptyValue />}
    </span>
  );
  const otherType = !row.matchesSelectedAccelerator;
  // Allocation and usability answer different questions. An allocated card can
  // still have enough free capacity for this request: keep its "Allocated"
  // label, but use the positive usable styling so placement remains obvious.
  const showUsableLabel = row.healthy && row.fullFree && usable;
  const useUsableStyle = row.healthy && usable;
  const statusText = otherType
    ? t("clusters.options.otherType")
    : row.healthy
      ? showUsableLabel
        ? t("clusters.options.usableForRequest")
        : t("clusters.options.allocated")
      : t("clusters.options.unhealthy");
  const statusClassName = otherType
    ? "text-muted-foreground"
    : row.healthy
      ? useUsableStyle
        ? "text-[var(--nt-text-colorful-positive)]"
        : "text-[var(--nt-text-colorful-notice)]"
      : "text-[var(--nt-text-colorful-serious)]";
  const availability: GpuAvailability = otherType
    ? "other-type"
    : !row.healthy
      ? "unhealthy"
      : useUsableStyle
        ? "usable"
        : "allocated";

  return (
    <div
      data-testid="endpoint-gpu-device-card"
      data-product-match={otherType ? "other" : "selected"}
      className={cn(
        GPU_CELL_CLASS,
        GPU_GRID_CELL_CLASS,
        "grid gap-2",
        otherType && "opacity-50",
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <span className="whitespace-nowrap text-sm font-semibold leading-5">
            {t("clusters.fields.gpuNumber")} {row.gpuNumber}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title={t("clusters.actions.copyUuid")}
            aria-label={`${t("clusters.fields.gpuNumber")} ${row.gpuNumber} ${t("clusters.actions.copyUuid")}`}
            className="h-6 w-6 shrink-0 text-muted-foreground"
            onClick={() => copyUuid(row.uuid)}
          >
            <Copy className="h-3.5 w-3.5" />
            <span className="sr-only">{t("clusters.actions.copyUuid")}</span>
          </Button>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 text-[11px] font-medium",
            statusClassName,
          )}
        >
          {useUsableStyle ? (
            <CircleCheck className="size-3.5" aria-hidden="true" />
          ) : (
            <CircleAlert className="size-3.5" aria-hidden="true" />
          )}
          {statusText}
        </span>
      </div>
      {/* Match the endpoint detail card: the product is a compact line under
          the device title. A clipped name stays reachable by hover and focus,
          while a name that fits adds no extra focus target or tooltip. */}
      {productTruncated ? (
        <Tooltip>
          <TooltipTrigger asChild>{productLabel}</TooltipTrigger>
          <TooltipContent className="max-w-md break-all">
            {row.product || <EmptyValue />}
          </TooltipContent>
        </Tooltip>
      ) : (
        productLabel
      )}
      <div className="grid gap-2.5">
        <GpuMeterRow
          label={t("clusters.fields.memoryUsage")}
          used={row.memory.used}
          total={row.memory.total}
          available={row.memory.available}
          availability={availability}
          unit=" GiB"
          valueScale={VRAM_VALUE_SCALE}
          t={t}
        />
        <GpuMeterRow
          label={t("clusters.fields.coreUsage")}
          used={row.core.used}
          total={row.core.total}
          available={row.core.available}
          availability={availability}
          t={t}
        />
      </div>
    </div>
  );
}
function EndpointClusterResourceSummary({
  resourceInfo,
  summaryRows,
  hasGpuResources,
  virtualizationEnabled,
  nodeCount,
  gpuCount,
  t,
}: {
  resourceInfo: ClusterResourceInfo;
  summaryRows: ReturnType<typeof buildGpuCardResourceRows>;
  hasGpuResources: boolean;
  virtualizationEnabled: boolean;
  nodeCount?: number | null;
  gpuCount: number | null;
  t: (
    key: string,
    options?: { defaultValue?: string; count?: number },
  ) => string;
}) {
  const cpuSummary = summarizeResourcePool(
    resourceInfo.allocatable?.cpu,
    resourceInfo.available?.cpu,
  );
  const memorySummary = summarizeResourcePool(
    resourceInfo.allocatable?.memory,
    resourceInfo.available?.memory,
  );
  const acceleratorMemorySummary = summarizeRows(summaryRows, "memory");
  const acceleratorCoreSummary = summarizeRows(summaryRows, "core");
  const showDetailedGpuMetrics =
    hasGpuResources &&
    (virtualizationEnabled ||
      hasNodeDeviceResources(resourceInfo.node_resources));
  const items: ResourceSummaryMetric[] = [];

  if (showDetailedGpuMetrics) {
    items.push(
      {
        label: t("clusters.fields.memoryUsage"),
        used: acceleratorMemorySummary.used,
        total: acceleratorMemorySummary.total,
        available: acceleratorMemorySummary.available,
        unit: " GiB",
        valueScale: VRAM_VALUE_SCALE,
        series: "blue",
      },
      {
        label: t("clusters.fields.coreUsage"),
        used: acceleratorCoreSummary.used,
        total: acceleratorCoreSummary.total,
        available: acceleratorCoreSummary.available,
        series: "cyan",
      },
    );
  }

  items.push(
    {
      label: t("common.fields.cpu"),
      used: cpuSummary.used,
      total: cpuSummary.total,
      available: cpuSummary.available,
      unit: " cores",
      series: "green",
    },
    {
      label: t("common.fields.memory"),
      used: memorySummary.used,
      total: memorySummary.total,
      available: memorySummary.available,
      unit: " GiB",
      series: "purple",
    },
  );

  return (
    <div
      data-testid="endpoint-cluster-resource-summary"
      className="border-y py-3"
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-xs font-semibold text-foreground">
          {t("endpoints.sections.clusterCapacity")}
        </span>
        <span
          data-testid="endpoint-cluster-node-count"
          className="text-xs text-muted-foreground"
        >
          {nodeCount == null ? (
            <EmptyValue />
          ) : (
            t("endpoints.clusterDetails.nodeCount", { count: nodeCount })
          )}
          <span aria-hidden="true"> · </span>
          {gpuCount == null ? (
            <EmptyValue />
          ) : (
            t("clusters.gpuInventory.count", { count: gpuCount })
          )}
        </span>
      </div>
      <ResourceMetricGrid
        items={items}
        testId="endpoint-cluster-resource-metrics"
        testIds={CLUSTER_RESOURCE_METRIC_TEST_IDS}
        t={t}
      />
    </div>
  );
}

const getFiniteResourceValue = (
  value: number | null | undefined,
): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const getDeviceResourceValue = (
  device: DeviceResource | undefined,
  field: "memory_mib" | "core_units",
  fallback: number | null | undefined,
) =>
  getFiniteResourceValue(device?.available?.[field]) ??
  getFiniteResourceValue(fallback) ??
  0;

const getDeviceAllocatableResourceValue = (
  device: DeviceResource | undefined,
  field: "memory_mib" | "core_units",
  fallback: number | null | undefined,
) =>
  getFiniteResourceValue(device?.allocatable?.[field]) ??
  getFiniteResourceValue(fallback);

const isDeviceFullyAvailable = (
  device: DeviceResource | undefined,
  fallback: boolean,
) => {
  if (!device) return fallback;

  const availableMemory = getFiniteResourceValue(device.available?.memory_mib);
  const availableCore = getFiniteResourceValue(device.available?.core_units);
  const allocatableMemory = getFiniteResourceValue(
    device.allocatable?.memory_mib,
  );
  const allocatableCore = getFiniteResourceValue(
    device.allocatable?.core_units,
  );

  return Boolean(
    device.health &&
      availableMemory != null &&
      availableCore != null &&
      allocatableMemory != null &&
      allocatableCore != null &&
      availableMemory >= allocatableMemory &&
      availableCore >= allocatableCore,
  );
};

const isDeviceUsableForRequest = (
  row: GpuDeviceResourceRow,
  request: EndpointResourceRequestContext | undefined,
  schedulingNodeStatus?: NodeResourceStatus,
) => {
  if (!request) {
    return row.healthy && row.matchesSelectedAccelerator && row.fullFree;
  }

  if (!row.healthy || !row.matchesSelectedAccelerator) {
    return false;
  }

  const cpuPerReplica = Number(request.cpuPerReplica || 0);
  const memoryPerReplica = Number(request.memoryPerReplica || 0);
  const availableCpu = Number(schedulingNodeStatus?.available?.cpu);
  const nodeAvailableMemory = Number(schedulingNodeStatus?.available?.memory);
  if (
    cpuPerReplica > 0 &&
    Number.isFinite(availableCpu) &&
    availableCpu < cpuPerReplica
  ) {
    return false;
  }
  if (
    memoryPerReplica > 0 &&
    Number.isFinite(nodeAvailableMemory) &&
    nodeAvailableMemory < memoryPerReplica
  ) {
    return false;
  }

  const schedulingDevice = schedulingNodeStatus?.devices?.find(
    (device) => device.uuid === row.uuid && device.product === row.product,
  );
  const availableMemory = getDeviceResourceValue(
    schedulingDevice,
    "memory_mib",
    row.memory.available,
  );
  const availableCore = getDeviceResourceValue(
    schedulingDevice,
    "core_units",
    row.core.available,
  );

  if (request.allocationMode === "full") {
    return isDeviceFullyAvailable(schedulingDevice, row.fullFree);
  }

  if (request.allocationMode === "fractional") {
    const totalCore = getDeviceAllocatableResourceValue(
      schedulingDevice,
      "core_units",
      row.core.total,
    );
    const requiredCore = getFractionalGpuCoreRequirement(
      request.gpuPerReplica,
      totalCore,
    );

    return requiredCore != null && availableCore >= requiredCore;
  }

  const memoryMiBPerCard = Number(request.memoryMiBPerCard || 0);
  const coreUnitsPerCard = Number(request.coreUnitsPerCard || 0);

  if (memoryMiBPerCard > 0 && availableMemory < memoryMiBPerCard) {
    return false;
  }

  if (coreUnitsPerCard > 0 && availableCore < coreUnitsPerCard) {
    return false;
  }

  return availableMemory > 0 && (coreUnitsPerCard <= 0 || availableCore > 0);
};

const groupNodesWithGpuRows = (
  rows: GpuDeviceResourceRow[],
  nodeResources: Record<string, NodeResourceStatus> | null | undefined,
  schedulingNodeResources:
    | Record<string, NodeResourceStatus>
    | null
    | undefined,
  request: EndpointResourceRequestContext | undefined,
): Array<{
  availableCore: number | null;
  availableMemory: number | null;
  cpuSummary: ReturnType<typeof summarizeResourcePool>;
  memorySummary: ReturnType<typeof summarizeResourcePool>;
  nodeName: string;
  rows: GpuDeviceResourceRow[];
  totalCore: number | null;
  totalMemory: number | null;
  usableCount: number;
  usedCore: number | null;
  usedMemory: number | null;
}> => {
  const groups = new Map<string, GpuDeviceResourceRow[]>();
  for (const row of rows) {
    groups.set(row.nodeName, [...(groups.get(row.nodeName) ?? []), row]);
  }

  const nodeNames =
    nodeResources && Object.keys(nodeResources).length > 0
      ? Object.keys(nodeResources)
      : Array.from(groups.keys());

  nodeNames.sort((first, second) => {
    const firstHasGpu = (groups.get(first)?.length ?? 0) > 0;
    const secondHasGpu = (groups.get(second)?.length ?? 0) > 0;

    if (firstHasGpu !== secondHasGpu) {
      return firstHasGpu ? -1 : 1;
    }

    return first.localeCompare(second);
  });

  return nodeNames.map((nodeName) => {
    const nodeRows = groups.get(nodeName) ?? [];
    const nodeStatus = nodeResources?.[nodeName];
    const schedulingNodeStatus =
      schedulingNodeResources?.[nodeName] ?? nodeStatus;
    const cpuSummary = summarizeResourcePool(
      nodeStatus?.allocatable?.cpu,
      nodeStatus?.available?.cpu,
    );
    const memorySummary = summarizeResourcePool(
      nodeStatus?.allocatable?.memory,
      nodeStatus?.available?.memory,
    );
    const availableMemory = sumGpuDeviceRowPool(
      nodeRows,
      "memory",
      "available",
    );
    const availableCore = sumGpuDeviceRowPool(nodeRows, "core", "available");
    const totalMemory = sumGpuDeviceRowPool(nodeRows, "memory", "total");
    const totalCore = sumGpuDeviceRowPool(nodeRows, "core", "total");
    const usedMemory = sumGpuDeviceRowPool(nodeRows, "memory", "used");
    const usedCore = sumGpuDeviceRowPool(nodeRows, "core", "used");
    const usableCount = nodeRows.filter((row) =>
      isDeviceUsableForRequest(row, request, schedulingNodeStatus),
    ).length;

    return {
      availableCore,
      availableMemory,
      cpuSummary,
      memorySummary,
      nodeName,
      rows: nodeRows,
      totalCore,
      totalMemory,
      usableCount,
      usedCore,
      usedMemory,
    };
  });
};

function EndpointNodeResources({
  nodeResources,
  schedulingNodeResources,
  selectedAccelerator,
  hasGpuResources,
  request,
  t,
}: {
  nodeResources: ClusterResourceInfo["node_resources"];
  schedulingNodeResources?: ClusterResourceInfo["node_resources"];
  selectedAccelerator?: SelectedAccelerator | null;
  hasGpuResources: boolean;
  request?: EndpointResourceRequestContext;
  t: (key: string, options?: { defaultValue?: string }) => string;
}) {
  const hasNodeDevices = hasNodeDeviceResources(nodeResources);
  const showDetailedGpuDevices = hasGpuResources && hasNodeDevices;

  if (!showDetailedGpuDevices) {
    return (
      <EndpointNodeResourceSummaries
        nodeResources={nodeResources}
        selectedAccelerator={selectedAccelerator}
        showGpuResources={hasGpuResources}
        t={t}
      />
    );
  }

  return (
    <EndpointVirtualizedNodeGpuResources
      nodeResources={nodeResources}
      schedulingNodeResources={schedulingNodeResources}
      selectedAccelerator={selectedAccelerator}
      request={request}
      t={t}
    />
  );
}

function EndpointNodeResourceSummaries({
  nodeResources,
  selectedAccelerator,
  showGpuResources,
  t,
}: {
  nodeResources: ClusterResourceInfo["node_resources"];
  selectedAccelerator?: SelectedAccelerator | null;
  showGpuResources: boolean;
  t: (key: string, options?: { defaultValue?: string }) => string;
}) {
  const nodeGroups = useMemo(
    () => buildNodePhysicalGpuResourceRows(nodeResources, selectedAccelerator),
    [nodeResources, selectedAccelerator],
  );

  if (nodeGroups.length === 0) {
    return null;
  }

  return (
    <div data-testid="endpoint-compact-node-resources" className="divide-y">
      {nodeGroups.map((group) => {
        const items: ResourceSummaryMetric[] = [];

        if (showGpuResources) {
          items.push({
            label: t("endpoints.fields.physicalGpu"),
            used: group.quantity.used,
            total: group.quantity.total,
            available: group.quantity.available,
            series: "amber",
          });
        }

        items.push(
          {
            label: t("common.fields.cpu"),
            used: group.cpu.used,
            total: group.cpu.total,
            available: group.cpu.available,
            unit: " cores",
            series: "green",
          },
          {
            label: t("common.fields.memory"),
            used: group.memory.used,
            total: group.memory.total,
            available: group.memory.available,
            unit: " GiB",
            series: "purple",
          },
        );

        return (
          <div
            data-testid="endpoint-compact-node-card"
            key={group.nodeName}
            className="py-4 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted/60 text-muted-foreground">
                  <Server className="size-3.5" aria-hidden="true" />
                </span>
                <div
                  data-testid="endpoint-node-resource-name"
                  className="min-w-0 whitespace-normal break-words text-sm font-semibold"
                  title={group.nodeName}
                >
                  {group.nodeName}
                </div>
              </div>
              <ResourceMetricGrid
                items={items}
                testId="endpoint-node-resource-metrics"
                testIds={NODE_RESOURCE_METRIC_TEST_IDS}
                className="mt-3"
                t={t}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EndpointVirtualizedNodeGpuResources({
  nodeResources,
  schedulingNodeResources,
  selectedAccelerator,
  request,
  t,
}: {
  nodeResources: ClusterResourceInfo["node_resources"];
  schedulingNodeResources?: ClusterResourceInfo["node_resources"];
  selectedAccelerator?: SelectedAccelerator | null;
  request?: EndpointResourceRequestContext;
  t: Translate;
}) {
  const { copy } = useCopyToClipboard();
  const copyUuid = (uuid: string) =>
    copy(uuid, {
      successMessage: t("clusters.messages.copyUuidSuccess"),
      errorMessage: t("clusters.messages.copyUuidFailed"),
    });
  const rows = useMemo(
    () => buildGpuDeviceResourceRows(nodeResources, selectedAccelerator),
    [nodeResources, selectedAccelerator],
  );
  const nodeGroups = useMemo(
    () =>
      groupNodesWithGpuRows(
        rows,
        nodeResources,
        schedulingNodeResources,
        request,
      ),
    [nodeResources, request, rows, schedulingNodeResources],
  );

  if (nodeGroups.length === 0) {
    return <EmptyState>{t("clusters.messages.noGpuDevices")}</EmptyState>;
  }

  return (
    <div data-testid="endpoint-compact-node-resources" className="divide-y">
      {nodeGroups.map((group) => {
        const items: ResourceSummaryMetric[] = [];
        const hasRowsMatchingSelection = group.rows.some(
          (row) => row.matchesSelectedAccelerator,
        );

        if (group.rows.length > 0) {
          items.push(
            {
              label: t("clusters.fields.memoryUsage"),
              used: group.usedMemory,
              total: group.totalMemory,
              available: group.availableMemory,
              unit: " GiB",
              valueScale: VRAM_VALUE_SCALE,
              series: "blue",
            },
            {
              label: t("clusters.fields.coreUsage"),
              used: group.usedCore,
              total: group.totalCore,
              available: group.availableCore,
              series: "cyan",
            },
          );
        }

        items.push(
          {
            label: t("common.fields.cpu"),
            used: group.cpuSummary.used,
            total: group.cpuSummary.total,
            available: group.cpuSummary.available,
            unit: " cores",
            series: "green",
          },
          {
            label: t("common.fields.memory"),
            used: group.memorySummary.used,
            total: group.memorySummary.total,
            available: group.memorySummary.available,
            unit: " GiB",
            series: "purple",
          },
        );

        return (
          <div
            data-testid="endpoint-compact-node-card"
            key={group.nodeName}
            className="py-4 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted/60 text-muted-foreground">
                  <Server className="size-3.5" aria-hidden="true" />
                </span>
                <div
                  data-testid="endpoint-node-resource-name"
                  className="min-w-0 whitespace-normal break-words text-sm font-semibold"
                  title={group.nodeName}
                >
                  {group.nodeName}
                </div>
                {group.rows.length > 0 && (
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="font-normal">
                      {t("clusters.gpuInventory.count", {
                        count: group.rows.length,
                      })}
                    </Badge>
                    <Badge
                      variant={group.usableCount > 0 ? "secondary" : "outline"}
                      className={cn(
                        "font-normal",
                        group.usableCount > 0
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                          : "bg-amber-50 text-amber-700",
                      )}
                    >
                      {t("clusters.options.usableForRequest")}{" "}
                      {group.usableCount}
                    </Badge>
                  </div>
                )}
              </div>
              <ResourceMetricGrid
                items={items}
                testId="endpoint-node-resource-metrics"
                testIds={NODE_RESOURCE_METRIC_TEST_IDS}
                className="mt-3"
                t={t}
              />
            </div>

            {group.rows.length > 0 && (
              <Disclosure
                key={`gpu-details:${hasRowsMatchingSelection ? "matching" : "other"}`}
                variant="plain"
                className="mt-2"
                triggerClassName="w-fit flex-none rounded-md border bg-muted/20 px-2 py-1 text-muted-foreground hover:bg-muted/50"
                leading={<Cpu className="size-3.5" aria-hidden="true" />}
                title={
                  <span className="text-xs font-normal text-muted-foreground">
                    {t("clusters.fields.gpuDetails")} ({group.rows.length})
                  </span>
                }
                defaultOpen={hasRowsMatchingSelection}
              >
                <div className={cn("mt-2", GPU_GRID_FRAME_CLASS)}>
                  <div
                    data-testid="endpoint-node-gpu-card-grid"
                    className={GPU_GRID_CLASS}
                    style={GPU_GRID_STYLE}
                  >
                    {group.rows.map((row) => {
                      const usable = isDeviceUsableForRequest(
                        row,
                        request,
                        schedulingNodeResources?.[group.nodeName] ??
                          nodeResources?.[group.nodeName],
                      );

                      return (
                        <GpuDeviceCard
                          key={`${row.nodeName}:${row.uuid}`}
                          row={row}
                          usable={usable}
                          copyUuid={copyUuid}
                          t={t}
                        />
                      );
                    })}
                  </div>
                </div>
              </Disclosure>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function EndpointClusterGpuResourcesPanel({
  resourceInfo,
  schedulingNodeResources,
  currentCluster,
  nodeCount,
  selectedAccelerator,
  virtualizationEnabled,
  request,
  inset = true,
  t,
}: EndpointClusterGpuResourcesPanelProps) {
  const title = t("endpoints.sections.clusterDeviceResources");
  const [clusterDetailsOpen, setClusterDetailsOpen] = useState(false);
  const rows = useMemo(
    () => buildGpuCardResourceRows(resourceInfo, selectedAccelerator),
    [resourceInfo, selectedAccelerator],
  );
  const summaryRows = useMemo(() => {
    if (!selectedAccelerator?.product) {
      return rows;
    }
    const matchingRows = rows.filter((row) => row.matchesSelectedAccelerator);
    // A preset accelerator (e.g. from a recipe catalog) may not line up with
    // any cluster-reported product; the summary should still show the
    // cluster's pool instead of an all-dashes board.
    return matchingRows.length > 0 ? matchingRows : rows;
  }, [rows, selectedAccelerator?.product]);
  const filteredByAccelerator =
    Boolean(selectedAccelerator?.product) &&
    rows.some((row) => row.matchesSelectedAccelerator);
  const hasGpuResources = hasGpuResourceRows(rows);
  const gpuCount = useMemo(
    () => sumOptionalNumbers(rows.map((row) => row.quantity.total)),
    [rows],
  );
  if (!resourceInfo) {
    return (
      <div className="grid min-h-[220px] grid-rows-[auto_1fr] overflow-hidden">
        <ClusterResourcesToolbar title={title} inset={inset} />
        <div className={cn("flex min-h-0 items-start", inset && "px-3 pb-3")}>
          <EmptyState variant="inline" className="w-full text-left">
            {currentCluster
              ? t("endpoints.messages.clusterResourcesUnavailable")
              : t("endpoints.placeholders.clusterResourcesRequiresCluster")}
          </EmptyState>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-0 grid-rows-[auto_1fr]">
      <ClusterResourcesToolbar
        title={title}
        inset={inset}
        filteredByAccelerator={filteredByAccelerator}
        detailsOpen={clusterDetailsOpen}
        onToggleDetails={() => setClusterDetailsOpen((open) => !open)}
        t={t}
      />
      {clusterDetailsOpen && (
        <EndpointClusterGpuResourcesInlineContent
          resourceInfo={resourceInfo}
          nodeCount={nodeCount}
          gpuCount={gpuCount}
          hasGpuResources={hasGpuResources}
          virtualizationEnabled={virtualizationEnabled}
          summaryRows={summaryRows}
          inset={inset}
          t={t}
        />
      )}
      <div
        className={cn(
          "min-h-0",
          inset && "px-3 pb-3",
          clusterDetailsOpen && "mt-4",
        )}
      >
        <EndpointNodeResources
          nodeResources={resourceInfo.node_resources}
          schedulingNodeResources={schedulingNodeResources}
          selectedAccelerator={selectedAccelerator}
          hasGpuResources={hasGpuResources}
          request={request}
          t={t}
        />
      </div>
    </div>
  );
}

function ClusterResourcesToolbar({
  title,
  inset,
  filteredByAccelerator,
  detailsOpen,
  onToggleDetails,
  t,
}: {
  title: string;
  inset: boolean;
  filteredByAccelerator?: boolean;
  detailsOpen?: boolean;
  onToggleDetails?: () => void;
  t?: Translate;
}) {
  return (
    <div
      data-testid="endpoint-cluster-resource-toolbar"
      className={cn(
        "flex min-w-0 items-start justify-between gap-3",
        inset ? "px-3.5 pb-2 pt-3" : "pb-3",
      )}
    >
      <div className="min-w-0">
        <h3 className="m-0 text-base font-semibold leading-6 text-foreground">
          {title}
        </h3>
        {filteredByAccelerator && t && (
          <p
            className="mt-0.5 text-xs leading-4 text-muted-foreground"
            data-testid="endpoint-cluster-accelerator-scope-hint"
          >
            {t("endpoints.messages.selectedAcceleratorResources")}
          </p>
        )}
      </div>
      {t && onToggleDetails && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="group h-7 shrink-0 gap-1.5 rounded-md px-2 text-xs font-medium"
          data-testid="endpoint-cluster-details-toggle"
          aria-expanded={detailsOpen}
          aria-controls="endpoint-cluster-resource-details"
          onClick={onToggleDetails}
        >
          {detailsOpen
            ? t("endpoints.actions.hideDetails")
            : t("endpoints.actions.showDetails")}
          <ChevronDown
            className={cn(
              "size-3.5 transition-transform",
              detailsOpen && "rotate-180",
            )}
            aria-hidden="true"
          />
        </Button>
      )}
    </div>
  );
}

function EndpointClusterGpuResourcesInlineContent({
  resourceInfo,
  nodeCount,
  gpuCount,
  hasGpuResources,
  virtualizationEnabled,
  summaryRows,
  inset,
  t,
}: {
  resourceInfo: ClusterResourceInfo;
  nodeCount?: number | null;
  gpuCount: number | null;
  hasGpuResources: boolean;
  virtualizationEnabled: boolean;
  summaryRows: ReturnType<typeof buildGpuCardResourceRows>;
  inset: boolean;
  t: (key: string, options?: { defaultValue?: string }) => string;
}) {
  return (
    <div
      id="endpoint-cluster-resource-details"
      className={cn("min-h-0", inset && "px-3 pb-3")}
    >
      <div
        data-testid="endpoint-cluster-resource-board"
        className="grid min-w-0 gap-2.5"
      >
        <EndpointClusterResourceSummary
          resourceInfo={resourceInfo}
          summaryRows={summaryRows}
          hasGpuResources={hasGpuResources}
          virtualizationEnabled={virtualizationEnabled}
          nodeCount={nodeCount}
          gpuCount={gpuCount}
          t={t}
        />
      </div>
    </div>
  );
}
