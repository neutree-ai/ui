import { CircleAlert, CircleCheck, Copy, Cpu } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useCopyToClipboard } from "@/foundation/hooks/use-copy-to-clipboard";
import {
  buildGpuCardResourceRows,
  buildGpuDeviceResourceRows,
  buildNodePhysicalGpuResourceRows,
  type GpuDeviceResourceRow,
} from "@/foundation/lib/gpu-device-resources";
import { cn } from "@/foundation/lib/utils";
import type {
  ClusterResourceInfo,
  NodeResourceStatus,
} from "@/foundation/types/resource-types";

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

type EndpointResourceRequestContext = {
  allocationMode: "full" | "vgpu";
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

const formatCount = (value: number | null | undefined) => {
  if (value == null) return "-";
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toFixed(1) : "-";
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
) => {
  if (used == null || total == null) {
    return "-";
  }

  return `${formatCount(scaleMetricValue(used, valueScale))} / ${formatCount(scaleMetricValue(total, valueScale))}${unit}`;
};

const formatPoolValue = (
  value: number | null | undefined,
  unit = "",
  valueScale = 1,
) =>
  value == null
    ? "-"
    : `${formatCount(scaleMetricValue(value, valueScale))}${unit}`;

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

const getAcceleratorUsageClasses = (percent: number) =>
  percent >= ACCELERATOR_USAGE_WARNING_PERCENT
    ? {
        progress: "bg-amber-100 [&>div]:bg-amber-500",
        text: "text-amber-600",
      }
    : {
        progress: "bg-emerald-100 [&>div]:bg-emerald-500",
        text: "text-emerald-600",
      };

const getGpuCardStateClasses = (usable: boolean, healthy: boolean) => {
  if (!healthy) {
    return "border-destructive/40 bg-destructive/5";
  }

  return usable ? "border-emerald-300 bg-emerald-50/60" : "border-amber-300";
};

const getSystemUsageClasses = () => ({
  progress: "bg-primary/15 [&>div]:bg-primary",
  text: "text-primary",
});

type ResourceSummaryMetric = {
  label: string;
  used: number | null | undefined;
  total: number | null | undefined;
  available: number | null | undefined;
  unit?: string;
  valueScale?: number;
  variant?: "accelerator" | "system";
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

function ResourceSummaryCard({
  metric,
  t,
}: {
  metric: ResourceSummaryMetric;
  t: (key: string, options?: { defaultValue?: string }) => string;
}) {
  const percent = toPercentValue(metric.used, metric.total);
  const acceleratorUsageClasses = getAcceleratorUsageClasses(percent);
  const usageText = formatUsage(
    metric.used,
    metric.total,
    "",
    metric.valueScale,
  );
  const freeText = formatPoolValue(metric.available, "", metric.valueScale);
  const isAccelerator = metric.variant === "accelerator";
  const usageClasses = isAccelerator
    ? acceleratorUsageClasses
    : getSystemUsageClasses();

  return (
    <div
      data-testid="endpoint-resource-summary-card"
      className="grid min-w-0 gap-2 rounded-lg border bg-background px-2.5 py-2"
    >
      <div className="flex min-w-0 items-baseline justify-between gap-2">
        <ResourceMetricLabel
          label={metric.label}
          unit={metric.unit}
          className="text-xs font-semibold"
        />
        <span
          data-testid="endpoint-resource-summary-percent"
          className="shrink-0 text-xs font-normal tabular-nums text-muted-foreground"
        >
          {formatPercent(percent)}{" "}
          {t("clusters.options.used", { defaultValue: "used" }).toLowerCase()}
        </span>
      </div>
      <Progress
        data-testid="endpoint-resource-summary-progress"
        value={percent}
        className={cn("h-1.5", usageClasses.progress)}
      />
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2 text-xs text-muted-foreground">
        <span className="min-w-0 truncate" title={usageText}>
          {t("clusters.options.used")} {usageText}
        </span>
        <strong
          data-testid="endpoint-resource-summary-free-value"
          className="shrink-0 font-semibold tabular-nums text-card-foreground"
          title={`${t("clusters.options.free")} ${freeText}`}
        >
          {t("clusters.options.free")} {freeText}
        </strong>
      </div>
    </div>
  );
}

function ResourceSummaryCardGrid({
  items,
  testId,
  t,
}: {
  items: ResourceSummaryMetric[];
  testId: string;
  t: (key: string, options?: { defaultValue?: string }) => string;
}) {
  return (
    <div
      data-testid={testId}
      className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-2"
    >
      {items.map((metric) => (
        <ResourceSummaryCard
          key={`${metric.label}:${metric.unit ?? ""}`}
          metric={metric}
          t={t}
        />
      ))}
    </div>
  );
}

function NodeResourcePill({
  metric,
  t,
}: {
  metric: ResourceSummaryMetric;
  t: (key: string, options?: { defaultValue?: string }) => string;
}) {
  const totalText = formatPoolValue(metric.total, "", metric.valueScale);
  const usedText = formatPoolValue(metric.used, "", metric.valueScale);
  const freeText = formatPoolValue(metric.available, "", metric.valueScale);
  const isAccelerator = metric.variant === "accelerator";

  return (
    <div
      data-testid="endpoint-node-resource-pill"
      className={cn(
        "min-w-0 rounded-lg border px-2 py-1.5",
        isAccelerator
          ? "border-primary/30 bg-primary/5"
          : "border-border bg-muted/20",
      )}
    >
      <ResourceMetricLabel
        label={metric.label}
        unit={metric.unit}
        className="text-xs font-semibold"
      />
      <div className="mt-1 grid grid-cols-3 gap-1 text-[11px] leading-tight text-muted-foreground">
        <span>{t("clusters.options.total")}</span>
        <span>{t("clusters.options.used")}</span>
        <span>{t("clusters.options.free")}</span>
        <strong
          data-testid="endpoint-node-resource-pill-value"
          className="truncate font-semibold tabular-nums text-card-foreground"
          title={totalText}
        >
          {totalText}
        </strong>
        <strong
          data-testid="endpoint-node-resource-pill-value"
          className="truncate font-semibold tabular-nums text-card-foreground"
          title={usedText}
        >
          {usedText}
        </strong>
        <strong
          data-testid="endpoint-node-resource-pill-value"
          className="truncate font-semibold tabular-nums text-card-foreground"
          title={freeText}
        >
          {freeText}
        </strong>
      </div>
    </div>
  );
}

function NodeResourcePillGrid({
  items,
  t,
}: {
  items: ResourceSummaryMetric[];
  t: (key: string, options?: { defaultValue?: string }) => string;
}) {
  return (
    <div
      data-testid="endpoint-node-resource-metrics"
      className="grid min-w-0 grid-cols-[repeat(auto-fill,minmax(160px,200px))] justify-start gap-2"
    >
      {items.map((metric) => (
        <NodeResourcePill
          key={`${metric.label}:${metric.unit ?? ""}`}
          metric={metric}
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
  unit,
  valueScale = 1,
  t,
}: {
  label: string;
  used: number | null | undefined;
  total: number | null | undefined;
  available: number | null | undefined;
  unit?: string;
  valueScale?: number;
  t: (key: string, options?: { defaultValue?: string }) => string;
}) {
  const percent = toPercentValue(used, total);
  const acceleratorUsageClasses = getAcceleratorUsageClasses(percent);
  const usageText = formatUsage(used, total, unit, valueScale);
  const freeText = `${t("clusters.options.free")} ${formatPoolValue(
    available,
    unit,
    valueScale,
  )}`;

  return (
    <div className="grid gap-1.5 rounded-md bg-muted/20 px-2 py-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <strong
          className={cn(
            "shrink-0 text-xs font-semibold tabular-nums",
            acceleratorUsageClasses.text,
          )}
          title={formatPercent(percent)}
        >
          {formatPercent(percent)}
        </strong>
      </div>
      <Progress
        data-testid="endpoint-gpu-resource-progress"
        value={percent}
        className={cn("h-1.5", acceleratorUsageClasses.progress)}
      />
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-xs">
        <span
          className="min-w-0 break-words tabular-nums text-muted-foreground"
          title={usageText}
        >
          {usageText}
        </span>
        <strong
          className={cn(
            "shrink-0 font-semibold tabular-nums",
            acceleratorUsageClasses.text,
          )}
          title={freeText}
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
  const statusText = row.healthy
    ? usable
      ? t("clusters.options.usable")
      : t("clusters.options.allocated")
    : t("clusters.options.unhealthy");
  const statusClassName = row.healthy
    ? usable
      ? "text-emerald-600"
      : "text-amber-600"
    : "text-destructive";

  return (
    <div
      data-testid="endpoint-gpu-device-card"
      className={cn(
        "grid gap-2 rounded-lg border bg-background p-2",
        getGpuCardStateClasses(usable, row.healthy),
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            title={row.uuid}
            aria-label={`${t("clusters.fields.gpuNumber")} ${row.gpuNumber}, ${t("clusters.fields.deviceUuid")} ${row.uuid}`}
            className="-ml-2 h-7 min-w-0 justify-start px-2 text-xs"
            onClick={() => copyUuid(row.uuid)}
          >
            <span className="truncate font-medium tabular-nums">
              {t("clusters.fields.gpuNumber")} {row.gpuNumber}
            </span>
            <Copy className="h-3 w-3 shrink-0 text-muted-foreground" />
          </Button>
          <Badge
            variant="outline"
            className="max-w-full min-w-0 truncate text-xs"
          >
            {row.product || "-"}
          </Badge>
        </div>
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center",
            statusClassName,
          )}
          role="img"
          aria-label={statusText}
          title={statusText}
        >
          {row.healthy && usable ? (
            <CircleCheck className="h-3.5 w-3.5 text-current" />
          ) : (
            <CircleAlert className="h-3.5 w-3.5 text-current" />
          )}
        </span>
      </div>
      <div className="grid gap-2">
        <GpuMeterRow
          label={t("clusters.fields.memoryUsage")}
          used={row.memory.used}
          total={row.memory.total}
          available={row.memory.available}
          unit=" GiB"
          valueScale={VRAM_VALUE_SCALE}
          t={t}
        />
        <GpuMeterRow
          label={t("clusters.fields.coreUsage")}
          used={row.core.used}
          total={row.core.total}
          available={row.core.available}
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
  t,
}: {
  resourceInfo: ClusterResourceInfo;
  summaryRows: ReturnType<typeof buildGpuCardResourceRows>;
  hasGpuResources: boolean;
  virtualizationEnabled: boolean;
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
  const gpuSummary = summarizeRows(summaryRows, "quantity");
  const acceleratorMemorySummary = summarizeRows(summaryRows, "memory");
  const acceleratorCoreSummary = summarizeRows(summaryRows, "core");
  const items: ResourceSummaryMetric[] = [];

  if (hasGpuResources) {
    items.push({
      label: t("endpoints.fields.physicalGpu"),
      used: gpuSummary.used,
      total: gpuSummary.total,
      available: gpuSummary.available,
      variant: "accelerator",
    });
  }

  if (hasGpuResources && virtualizationEnabled) {
    items.push(
      {
        label: t("clusters.fields.memoryUsage"),
        used: acceleratorMemorySummary.used,
        total: acceleratorMemorySummary.total,
        available: acceleratorMemorySummary.available,
        unit: " GiB",
        valueScale: VRAM_VALUE_SCALE,
        variant: "accelerator",
      },
      {
        label: t("clusters.fields.coreUsage"),
        used: acceleratorCoreSummary.used,
        total: acceleratorCoreSummary.total,
        available: acceleratorCoreSummary.available,
        variant: "accelerator",
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
    },
    {
      label: t("common.fields.memory"),
      used: memorySummary.used,
      total: memorySummary.total,
      available: memorySummary.available,
      unit: " GiB",
    },
  );

  return (
    <div
      data-testid="endpoint-cluster-resource-summary"
      className="rounded-lg border bg-muted/10 p-2.5"
    >
      <ResourceSummaryCardGrid
        items={items}
        testId="endpoint-cluster-resource-metrics"
        t={t}
      />
    </div>
  );
}

const isDeviceUsableForRequest = (
  row: GpuDeviceResourceRow,
  request: EndpointResourceRequestContext | undefined,
) => {
  if (!request) {
    return row.healthy && row.matchesSelectedAccelerator && row.fullFree;
  }

  if (!row.healthy || !row.matchesSelectedAccelerator) {
    return false;
  }

  if (request.allocationMode === "full") {
    return row.fullFree;
  }

  const memoryMiBPerCard = Number(request.memoryMiBPerCard || 0);
  const coreUnitsPerCard = Number(request.coreUnitsPerCard || 0);
  const availableMemory = Number(row.memory.available || 0);
  const availableCore = Number(row.core.available || 0);

  if (memoryMiBPerCard > 0 && availableMemory < memoryMiBPerCard) {
    return false;
  }

  if (coreUnitsPerCard > 0 && availableCore < coreUnitsPerCard) {
    return false;
  }

  return availableMemory > 0 && availableCore > 0;
};

const groupNodesWithGpuRows = (
  rows: GpuDeviceResourceRow[],
  nodeResources: Record<string, NodeResourceStatus> | null | undefined,
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
      isDeviceUsableForRequest(row, request),
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
  selectedAccelerator,
  hasGpuResources,
  virtualizationEnabled,
  request,
  t,
}: {
  nodeResources: ClusterResourceInfo["node_resources"];
  selectedAccelerator?: SelectedAccelerator | null;
  hasGpuResources: boolean;
  virtualizationEnabled: boolean;
  request?: EndpointResourceRequestContext;
  t: (key: string, options?: { defaultValue?: string }) => string;
}) {
  if (!virtualizationEnabled || !hasGpuResources) {
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
    <div data-testid="endpoint-compact-node-resources" className="space-y-2">
      {nodeGroups.map((group) => {
        const items: ResourceSummaryMetric[] = [];

        if (showGpuResources) {
          items.push({
            label: t("endpoints.fields.physicalGpu"),
            used: group.quantity.used,
            total: group.quantity.total,
            available: group.quantity.available,
            variant: "accelerator",
          });
        }

        items.push(
          {
            label: t("common.fields.cpu"),
            used: group.cpu.used,
            total: group.cpu.total,
            available: group.cpu.available,
            unit: " cores",
          },
          {
            label: t("common.fields.memory"),
            used: group.memory.used,
            total: group.memory.total,
            available: group.memory.available,
            unit: " GiB",
          },
        );

        return (
          <div
            data-testid="endpoint-compact-node-card"
            key={group.nodeName}
            className="overflow-hidden rounded-lg border bg-background"
          >
            <div className="grid gap-x-3 gap-y-2 bg-muted/20 p-2.5 lg:grid-cols-[minmax(160px,220px)_minmax(0,1fr)] lg:items-start">
              <div className="flex min-w-0 items-center gap-2">
                <div
                  data-testid="endpoint-node-resource-name"
                  className="min-w-0 whitespace-normal break-words text-sm font-medium"
                  title={group.nodeName}
                >
                  {group.nodeName}
                </div>
              </div>
              <NodeResourcePillGrid items={items} t={t} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EndpointVirtualizedNodeGpuResources({
  nodeResources,
  selectedAccelerator,
  request,
  t,
}: {
  nodeResources: ClusterResourceInfo["node_resources"];
  selectedAccelerator?: SelectedAccelerator | null;
  request?: EndpointResourceRequestContext;
  t: (key: string, options?: { defaultValue?: string }) => string;
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
    () => groupNodesWithGpuRows(rows, nodeResources, request),
    [nodeResources, request, rows],
  );

  if (nodeGroups.length === 0) {
    return (
      <div className="rounded-md border bg-background p-3 text-sm text-muted-foreground">
        {t("clusters.messages.noGpuDevices")}
      </div>
    );
  }

  return (
    <div data-testid="endpoint-compact-node-resources" className="space-y-2">
      {nodeGroups.map((group) => {
        const items: ResourceSummaryMetric[] = [];

        if (group.rows.length > 0) {
          items.push(
            {
              label: t("clusters.fields.memoryUsage"),
              used: group.usedMemory,
              total: group.totalMemory,
              available: group.availableMemory,
              unit: " GiB",
              valueScale: VRAM_VALUE_SCALE,
              variant: "accelerator",
            },
            {
              label: t("clusters.fields.coreUsage"),
              used: group.usedCore,
              total: group.totalCore,
              available: group.availableCore,
              variant: "accelerator",
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
          },
          {
            label: t("common.fields.memory"),
            used: group.memorySummary.used,
            total: group.memorySummary.total,
            available: group.memorySummary.available,
            unit: " GiB",
          },
        );

        return (
          <div
            data-testid="endpoint-compact-node-card"
            key={group.nodeName}
            className="overflow-hidden rounded-lg border bg-background"
          >
            <div
              className={cn(
                "grid gap-x-3 gap-y-2 bg-muted/20 p-2.5 lg:grid-cols-[minmax(160px,220px)_minmax(0,1fr)] lg:items-start",
                group.rows.length > 0 && "border-b",
              )}
            >
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <div
                  data-testid="endpoint-node-resource-name"
                  className="min-w-0 whitespace-normal break-words text-sm font-medium"
                  title={group.nodeName}
                >
                  {group.nodeName}
                </div>
                {group.rows.length > 0 && (
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="font-normal">
                      {group.rows.length} {t("clusters.fields.gpuNumber")}
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
                      {t("clusters.options.usable")} {group.usableCount}
                    </Badge>
                  </div>
                )}
              </div>
              <NodeResourcePillGrid items={items} t={t} />
            </div>

            {group.rows.length > 0 && (
              <div
                data-testid="endpoint-node-gpu-card-grid"
                className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),220px))] justify-start gap-2 p-2.5"
              >
                {group.rows.map((row) => {
                  const usable = isDeviceUsableForRequest(row, request);

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
            )}
          </div>
        );
      })}
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
  const title = t("endpoints.sections.clusterDeviceResources");
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
  const hasGpuResources = hasGpuResourceRows(rows);
  const selectedProduct = selectedAccelerator?.product;
  const gpuTypeProducts = useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .map((row) => row.product)
            .filter((product): product is string => Boolean(product)),
        ),
      ).sort((first, second) => first.localeCompare(second)),
    [rows],
  );
  const gpuTypeLabel =
    selectedProduct ||
    (gpuTypeProducts.length > 0
      ? gpuTypeProducts.join(", ")
      : t("clusters.options.allGpuProducts"));
  if (!resourceInfo) {
    return (
      <div className="grid min-h-[220px] grid-rows-[auto_1fr] overflow-hidden">
        <ClusterResourcesToolbar
          title={title}
          currentCluster={currentCluster}
          showGpuResources={false}
          gpuTypeLabel={gpuTypeLabel}
          t={t}
        />
        <div className="flex min-h-0 items-center px-3 pb-3 text-sm text-muted-foreground">
          <div className="rounded-md border bg-muted/20 p-3">
            {currentCluster
              ? t("endpoints.messages.clusterResourcesUnavailable")
              : t("endpoints.placeholders.selectCluster")}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-0 grid-rows-[auto_1fr] overflow-hidden">
      <ClusterResourcesToolbar
        title={title}
        currentCluster={currentCluster}
        showGpuResources={hasGpuResources}
        gpuTypeLabel={gpuTypeLabel}
        t={t}
      />
      <EndpointClusterGpuResourcesInlineContent
        resourceInfo={resourceInfo}
        selectedAccelerator={selectedAccelerator}
        hasGpuResources={hasGpuResources}
        virtualizationEnabled={virtualizationEnabled}
        summaryRows={summaryRows}
        request={request}
        t={t}
      />
    </div>
  );
}

function ClusterResourcesToolbar({
  title,
  currentCluster,
  showGpuResources,
  gpuTypeLabel,
  t,
}: {
  title: string;
  currentCluster?: string | null;
  showGpuResources: boolean;
  gpuTypeLabel: string;
  t: (key: string, options?: { defaultValue?: string }) => string;
}) {
  return (
    <div
      data-testid="endpoint-cluster-resource-toolbar"
      className="flex flex-wrap items-start gap-3 px-3.5 pb-2 pt-3"
    >
      <Cpu className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="grid min-w-0 gap-2">
        <h3 className="m-0 text-base font-semibold leading-6 text-foreground">
          {title}
        </h3>
        <div
          data-testid="endpoint-cluster-resource-target-notes"
          className="flex min-w-0 flex-wrap items-center gap-2"
        >
          {currentCluster && (
            <Badge
              variant="outline"
              className="max-w-[220px] gap-1.5 bg-muted/30 px-2.5 py-1 font-normal"
              title={currentCluster}
            >
              <span className="shrink-0 text-muted-foreground">
                {t("common.fields.cluster")}
              </span>
              <span className="min-w-0 truncate font-semibold text-foreground">
                {currentCluster}
              </span>
            </Badge>
          )}
          {showGpuResources && (
            <Badge
              variant="outline"
              className="max-w-[260px] gap-1.5 bg-muted/30 px-2.5 py-1 font-normal"
              title={gpuTypeLabel}
            >
              <span className="shrink-0 text-muted-foreground">
                {t("clusters.fields.gpuType")}
              </span>
              <span className="min-w-0 truncate font-semibold text-foreground">
                {gpuTypeLabel}
              </span>
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function EndpointClusterGpuResourcesInlineContent({
  resourceInfo,
  selectedAccelerator,
  hasGpuResources,
  virtualizationEnabled,
  summaryRows,
  request,
  t,
}: {
  resourceInfo: ClusterResourceInfo;
  selectedAccelerator?: SelectedAccelerator | null;
  hasGpuResources: boolean;
  virtualizationEnabled: boolean;
  summaryRows: ReturnType<typeof buildGpuCardResourceRows>;
  request?: EndpointResourceRequestContext;
  t: (key: string, options?: { defaultValue?: string }) => string;
}) {
  return (
    <div className="min-h-0 overflow-auto px-3 pb-3 pt-1 [scrollbar-gutter:stable_both-edges] xl:max-h-[calc(100vh-180px)]">
      <div
        data-testid="endpoint-cluster-resource-board"
        className="grid min-w-[1120px] gap-2.5"
      >
        <EndpointClusterResourceSummary
          resourceInfo={resourceInfo}
          summaryRows={summaryRows}
          hasGpuResources={hasGpuResources}
          virtualizationEnabled={virtualizationEnabled}
          t={t}
        />
        <EndpointNodeResources
          nodeResources={resourceInfo.node_resources}
          selectedAccelerator={selectedAccelerator}
          hasGpuResources={hasGpuResources}
          virtualizationEnabled={virtualizationEnabled}
          request={request}
          t={t}
        />
      </div>
    </div>
  );
}
