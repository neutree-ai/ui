import { CircleAlert, CircleCheck, Copy, Cpu, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Table as UITable,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmptyState } from "@/foundation/components/EmptyState";
import {
  MetricBar,
  type MetricBarSeries,
} from "@/foundation/components/MetricBar";
import { useCopyToClipboard } from "@/foundation/hooks/use-copy-to-clipboard";
import {
  buildGpuDeviceResourceRows,
  filterGpuDeviceResourceRows,
  GPU_CELL_CLASS,
  GPU_CELL_INERT_CLASS,
  GPU_DEVICE_FILTER_ALL,
  GPU_USAGE_TEXT_CLASS,
  type GpuDeviceResourceRow,
  getGpuCellGridStyle,
  getGpuDeviceResourceFilterOptions,
} from "@/foundation/lib/gpu-device-resources";
import { formatToDecimal } from "@/foundation/lib/unit";
import { cn } from "@/foundation/lib/utils";
import type { NodeResourceStatus } from "@/foundation/types/resource-types";

type GpuDeviceResourcesViewLabels = {
  title: string;
  deviceCount: string;
  healthyDevices: string;
  memoryUsage: string;
  coreUsage: string;
  allProducts: string;
  allNodes: string;
  allDevices: string;
  searchPlaceholder: string;
  gpuNumber: string;
  uuid: string;
  status: string;
  healthy: string;
  unhealthy: string;
  node: string;
  product: string;
  selected: string;
  usable: string;
  free: string;
  allocated: string;
  resourceScope: string;
  freeCards: string;
  usableForRequest: string;
  copyUuid: string;
  copyUuidSuccess: string;
  copyUuidFailed: string;
  remaining: string;
  usedSlashTotal: string;
  empty: string;
};

type SelectedAccelerator = {
  type?: string | null;
  product?: string | null;
};

type GpuDeviceResourcesViewProps = {
  nodeResources: Record<string, NodeResourceStatus> | null | undefined;
  labels: GpuDeviceResourcesViewLabels;
  selectedAccelerator?: SelectedAccelerator | null;
  className?: string;
  variant?: "table" | "cards" | "grid";
  showHeader?: boolean;
  showFilters?: boolean;
  showSummary?: boolean;
  showResourceControls?: boolean;
  resourceControlsTestId?: string;
  showNodeColumn?: boolean;
  gridColumns?: number;
  request?: GpuDeviceRequestFitContext;
};

type GpuDeviceRequestFitContext = {
  allocationMode: "full" | "vgpu";
  memoryMiBPerCard?: number | null;
  coreUnitsPerCard?: number | null;
};

type ResourceScope = "all" | "free" | "usable";

const VRAM_VALUE_SCALE = 1 / 1024;
const VRAM_VALUE_PRECISION = 1;

const scaleMetricValue = (
  value: number | null | undefined,
  valueScale: number,
) => {
  if (value == null) return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue * valueScale : null;
};

const formatNumber = (value: number | null | undefined, precision = 0) =>
  value == null ? "-" : (formatToDecimal(value, precision) ?? "-");

const formatUsage = (
  pool: Pick<GpuDeviceResourceRow["memory"], "used" | "total">,
  unit = "",
  valueScale = 1,
  precision = 0,
) => {
  if (pool.used == null || pool.total == null) {
    return "-";
  }

  const value = `${formatNumber(
    scaleMetricValue(pool.used, valueScale),
    precision,
  )} / ${formatNumber(scaleMetricValue(pool.total, valueScale), precision)}`;
  return unit ? `${value} ${unit}` : value;
};

const formatAvailable = (
  pool: Pick<GpuDeviceResourceRow["memory"], "available">,
  unit = "",
  valueScale = 1,
  precision = 0,
) => {
  if (pool.available == null) {
    return "-";
  }

  const value = formatNumber(
    scaleMetricValue(pool.available, valueScale),
    precision,
  );
  return unit ? `${value} ${unit}` : value;
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

const summarizePool = (
  rows: GpuDeviceResourceRow[],
  field: "memory" | "core",
) => {
  const totals = {
    total: sumOptionalNumbers(rows.map((row) => row[field].total)),
    used: sumOptionalNumbers(rows.map((row) => row[field].used)),
    available: sumOptionalNumbers(rows.map((row) => row[field].available)),
  };

  return {
    ...totals,
    percent:
      totals.total && totals.total > 0 && totals.used != null
        ? Math.round((totals.used / totals.total) * 100)
        : 0,
  };
};

const ResourceUsageCell = ({
  label,
  remainingLabel,
  pool,
  unit,
  valueScale,
  precision,
  series,
}: {
  label: string;
  remainingLabel: string;
  pool: GpuDeviceResourceRow["memory"];
  unit?: string;
  valueScale?: number;
  precision?: number;
  series: MetricBarSeries;
}) => (
  <div className="min-w-[150px] space-y-1">
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{pool.percent}%</span>
    </div>
    <MetricBar value={pool.percent} series={series} />
    <div className="text-xs tabular-nums text-muted-foreground">
      {formatUsage(pool, unit, valueScale, precision)}
    </div>
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{remainingLabel}</span>
      <span className="tabular-nums">
        {formatAvailable(pool, unit, valueScale, precision)}
      </span>
    </div>
  </div>
);

const ResourceUsageCard = ({
  label,
  remainingLabel,
  pool,
  unit,
  valueScale,
  precision,
  series,
}: {
  label: string;
  remainingLabel: string;
  pool: GpuDeviceResourceRow["memory"];
  unit?: string;
  valueScale?: number;
  precision?: number;
  series: MetricBarSeries;
}) => (
  <div className="space-y-1 rounded-md bg-muted/30 px-2 py-1.5">
    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>{label}</span>
      <span className="tabular-nums">{pool.percent}%</span>
    </div>
    <MetricBar value={pool.percent} size="sm" series={series} />
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{remainingLabel}</span>
      <span className="tabular-nums">
        {formatAvailable(pool, unit, valueScale, precision)}
      </span>
    </div>
    <div className="text-xs tabular-nums text-muted-foreground">
      {formatUsage(pool, unit, valueScale, precision)}
    </div>
  </div>
);

const GridResourceUsage = ({
  label,
  remainingLabel,
  pool,
  unit,
  valueScale,
  precision,
  series = "blue",
  unavailable = false,
}: {
  label: string;
  remainingLabel: string;
  pool: GpuDeviceResourceRow["memory"];
  unit?: string;
  valueScale?: number;
  precision?: number;
  series?: MetricBarSeries;
  /** The device is out of service, so its pools carry no measurement. */
  unavailable?: boolean;
}) => (
  <div
    className={cn(
      "mt-2 grid min-w-0 gap-1.5",
      GPU_USAGE_TEXT_CLASS,
      unavailable ? undefined : "text-muted-foreground",
    )}
  >
    <div className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 font-medium text-foreground">{label}</span>
      <span className="ml-auto min-w-0 truncate text-right font-medium tabular-nums text-foreground">
        {/* An unhealthy card reports zeroed pools. Printing "0 / 0" says the
            card is idle and available; the reading simply does not exist. */}
        {unavailable ? "—" : formatUsage(pool, unit, valueScale, precision)}
      </span>
      <span className="w-9 shrink-0 text-right font-semibold tabular-nums text-foreground">
        {unavailable ? "—" : `${pool.percent}%`}
      </span>
    </div>
    <MetricBar
      value={unavailable ? 0 : pool.percent}
      series={series}
      track={unavailable ? "unavailable" : "outlined"}
    />
    <div className="flex min-w-0 items-center gap-2 tabular-nums">
      <span className="shrink-0">{remainingLabel}</span>
      <span className="min-w-0 truncate">
        {unavailable ? "—" : formatAvailable(pool, unit, valueScale, precision)}
      </span>
    </div>
  </div>
);

const isDeviceUsableForRequest = (
  row: GpuDeviceResourceRow,
  request: GpuDeviceRequestFitContext | undefined,
) => {
  if (!request) {
    return false;
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

const getDeviceStatusLabel = (
  row: GpuDeviceResourceRow,
  request: GpuDeviceRequestFitContext | undefined,
  labels: GpuDeviceResourcesViewLabels,
) => {
  if (isDeviceUsableForRequest(row, request)) {
    return labels.usable;
  }

  if (row.fullFree) {
    return labels.free;
  }

  return labels.allocated;
};

const GpuDeviceHealthIndicator = ({
  healthy,
  labels,
  className,
}: {
  healthy: boolean;
  labels: Pick<GpuDeviceResourcesViewLabels, "healthy" | "unhealthy">;
  className?: string;
}) => {
  const label = healthy ? labels.healthy : labels.unhealthy;
  const indicator = (
    <span
      className={cn(
        "flex items-center justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
      role="img"
      aria-label={label}
      title={healthy ? label : undefined}
      tabIndex={healthy ? undefined : 0}
    >
      {healthy ? (
        <CircleCheck className="h-4 w-4 text-emerald-600" />
      ) : (
        <CircleAlert className="h-4 w-4 text-destructive" />
      )}
    </span>
  );

  if (healthy) {
    return indicator;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{indicator}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
};

export function GpuDeviceResourcesView({
  nodeResources,
  labels,
  selectedAccelerator,
  className,
  variant = "table",
  showHeader = true,
  showFilters = true,
  showSummary = true,
  showResourceControls = false,
  resourceControlsTestId = "gpu-device-resource-toolbar",
  showNodeColumn = true,
  gridColumns,
  request,
}: GpuDeviceResourcesViewProps) {
  const [productFilter, setProductFilter] = useState(GPU_DEVICE_FILTER_ALL);
  const [nodeFilter, setNodeFilter] = useState(GPU_DEVICE_FILTER_ALL);
  const [search, setSearch] = useState("");
  const [resourceScope, setResourceScope] = useState<ResourceScope>("all");
  const { copy } = useCopyToClipboard();

  const rows = useMemo(
    () => buildGpuDeviceResourceRows(nodeResources, selectedAccelerator),
    [nodeResources, selectedAccelerator],
  );
  const filterOptions = useMemo(
    () => getGpuDeviceResourceFilterOptions(rows),
    [rows],
  );
  const visibleRows = useMemo(() => {
    const filteredRows = filterGpuDeviceResourceRows(rows, {
      product: productFilter,
      nodeName: nodeFilter,
      search,
    });

    if (resourceScope === "free") {
      return filteredRows.filter((row) => row.fullFree);
    }

    if (resourceScope === "usable") {
      return filteredRows.filter((row) =>
        isDeviceUsableForRequest(row, request),
      );
    }

    return filteredRows;
  }, [nodeFilter, productFilter, request, resourceScope, rows, search]);
  const memorySummary = useMemo(
    () => summarizePool(visibleRows, "memory"),
    [visibleRows],
  );
  const coreSummary = useMemo(
    () => summarizePool(visibleRows, "core"),
    [visibleRows],
  );
  const healthyCount = visibleRows.filter((row) => row.healthy).length;
  const effectiveGridColumns = Math.max(
    1,
    Math.round(gridColumns ?? visibleRows.length),
  );
  const emptyGridCellCount =
    (effectiveGridColumns - (visibleRows.length % effectiveGridColumns)) %
    effectiveGridColumns;
  const hasSelectedAccelerator = Boolean(
    selectedAccelerator?.type || selectedAccelerator?.product,
  );

  if (rows.length === 0) {
    return (
      <div className={cn("rounded-md border p-4 text-sm", className)}>
        {showHeader && <div className="font-medium">{labels.title}</div>}
        <EmptyState className={showHeader ? "mt-3" : undefined}>
          {labels.empty}
        </EmptyState>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "space-y-3",
        variant !== "grid" && "rounded-md border p-3",
        className,
      )}
    >
      {showHeader && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-muted-foreground" />
            <div className="text-sm font-medium">{labels.title}</div>
          </div>
          {selectedAccelerator?.product && (
            <Badge variant="outline" className="font-normal">
              {labels.selected}: {selectedAccelerator.product}
            </Badge>
          )}
        </div>
      )}

      {showSummary && (
        <div className="grid gap-2 md:grid-cols-4">
          <div className="rounded-md bg-muted/40 px-3 py-2">
            <div className="text-xs text-muted-foreground">
              {labels.deviceCount}
            </div>
            <div className="text-sm font-medium tabular-nums">
              {visibleRows.length}
            </div>
          </div>
          <div className="rounded-md bg-muted/40 px-3 py-2">
            <div className="text-xs text-muted-foreground">
              {labels.healthyDevices}
            </div>
            <div className="text-sm font-medium tabular-nums">
              {healthyCount} / {visibleRows.length}
            </div>
          </div>
          <div className="rounded-md bg-muted/40 px-3 py-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{labels.memoryUsage}</span>
              <span className="tabular-nums">{memorySummary.percent}%</span>
            </div>
            <MetricBar
              value={memorySummary.percent}
              series="blue"
              className="mt-2"
            />
            <div className="mt-1 flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">{labels.remaining}</span>
              <span className="tabular-nums">
                {formatAvailable(
                  { available: memorySummary.available },
                  "GiB",
                  VRAM_VALUE_SCALE,
                  VRAM_VALUE_PRECISION,
                )}
              </span>
            </div>
          </div>
          <div className="rounded-md bg-muted/40 px-3 py-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{labels.coreUsage}</span>
              <span className="tabular-nums">{coreSummary.percent}%</span>
            </div>
            <MetricBar
              value={coreSummary.percent}
              series="cyan"
              className="mt-2"
            />
            <div className="mt-1 flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">{labels.remaining}</span>
              <span className="tabular-nums">
                {formatNumber(coreSummary.available)}
              </span>
            </div>
          </div>
        </div>
      )}

      {showFilters && (
        <div className="grid gap-2 md:grid-cols-[minmax(140px,220px)_minmax(140px,220px)_minmax(180px,1fr)]">
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger aria-label={labels.product}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={GPU_DEVICE_FILTER_ALL}>
                {labels.allProducts}
              </SelectItem>
              {filterOptions.products.map((product) => (
                <SelectItem key={product} value={product}>
                  {product}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={nodeFilter} onValueChange={setNodeFilter}>
            <SelectTrigger aria-label={labels.node}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={GPU_DEVICE_FILTER_ALL}>
                {labels.allNodes}
              </SelectItem>
              {filterOptions.nodeNames.map((nodeName) => (
                <SelectItem key={nodeName} value={nodeName}>
                  {nodeName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={labels.searchPlaceholder}
              className="pl-8"
            />
          </div>
        </div>
      )}

      {showResourceControls && (
        <div data-testid={resourceControlsTestId} className="grid gap-2">
          <Select
            value={resourceScope}
            onValueChange={(value) => setResourceScope(value as ResourceScope)}
          >
            <SelectTrigger aria-label={labels.resourceScope}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{labels.allDevices}</SelectItem>
              <SelectItem value="free">{labels.freeCards}</SelectItem>
              <SelectItem value="usable">{labels.usableForRequest}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {variant === "grid" ? (
        <div className="overflow-x-auto">
          <div
            data-testid="gpu-device-grid"
            className="grid divide-x divide-[var(--nt-stroke-neutral-trans-2)] overflow-hidden rounded-md border border-[var(--nt-stroke-neutral-trans-2)]"
            style={getGpuCellGridStyle(effectiveGridColumns)}
          >
            {visibleRows.map((row) => (
              <div
                key={`${row.nodeName}:${row.uuid}`}
                // An out-of-service card is dimmed by surface and text tokens
                // rather than a blanket opacity, so the Unhealthy badge below
                // keeps its full contrast.
                className={cn(
                  "relative",
                  GPU_CELL_CLASS,
                  !row.healthy && GPU_CELL_INERT_CLASS,
                )}
                title={row.product || undefined}
              >
                <span
                  className={cn(
                    "absolute right-2.5 top-2.5 flex items-center gap-1 text-xs font-medium",
                    row.healthy ? "text-emerald-600" : "text-destructive",
                  )}
                >
                  {row.healthy ? (
                    <CircleCheck className="h-3.5 w-3.5" />
                  ) : (
                    <CircleAlert className="h-3.5 w-3.5" />
                  )}
                  {row.healthy ? labels.healthy : labels.unhealthy}
                </span>
                <div className="flex min-w-0 items-center gap-1">
                  <span className="whitespace-nowrap text-sm font-semibold leading-5">
                    {labels.gpuNumber} {row.gpuNumber}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    title={labels.copyUuid}
                    aria-label={`${labels.gpuNumber} ${row.gpuNumber} ${labels.copyUuid}`}
                    className="h-6 w-6 shrink-0 text-muted-foreground"
                    onClick={() =>
                      copy(row.uuid, {
                        successMessage: labels.copyUuidSuccess,
                        errorMessage: labels.copyUuidFailed,
                      })
                    }
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span className="sr-only">{labels.copyUuid}</span>
                  </Button>
                </div>
                <GridResourceUsage
                  label={labels.memoryUsage}
                  remainingLabel={labels.remaining}
                  pool={row.memory}
                  unit="GiB"
                  valueScale={VRAM_VALUE_SCALE}
                  precision={VRAM_VALUE_PRECISION}
                  unavailable={!row.healthy}
                  series="blue"
                />
                <GridResourceUsage
                  label={labels.coreUsage}
                  remainingLabel={labels.remaining}
                  pool={row.core}
                  // Core keeps its own fill: this cell carries two bars, and the
                  // Nodes legend colour-codes which is which. The endpoint cell
                  // has one bar and needs no such pairing.
                  series="cyan"
                  unavailable={!row.healthy}
                />
              </div>
            ))}
            {Array.from({ length: emptyGridCellCount }, (_, emptyIndex) => (
              <div
                aria-hidden="true"
                className="min-h-[116px]"
                data-testid="gpu-device-grid-empty-cell"
                key={`empty-${emptyIndex}`}
              />
            ))}
          </div>
        </div>
      ) : variant === "cards" ? (
        <div className="grid gap-2">
          {visibleRows.map((row) => (
            <div
              key={`${row.nodeName}:${row.uuid}`}
              className={cn(
                "rounded-md border bg-background p-2.5",
                isDeviceUsableForRequest(row, request) &&
                  "border-primary/40 bg-primary/5",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  title={labels.copyUuid}
                  aria-label={`${labels.gpuNumber} ${row.gpuNumber} ${labels.copyUuid}`}
                  className="-ml-2 h-8 justify-start px-2"
                  onClick={() =>
                    copy(row.uuid, {
                      successMessage: labels.copyUuidSuccess,
                      errorMessage: labels.copyUuidFailed,
                    })
                  }
                >
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium tabular-nums">
                    {labels.gpuNumber} {row.gpuNumber}
                  </span>
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="sr-only">{labels.copyUuid}</span>
                </Button>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      isDeviceUsableForRequest(row, request)
                        ? "secondary"
                        : "outline"
                    }
                    className="font-normal"
                  >
                    {getDeviceStatusLabel(row, request, labels)}
                  </Badge>
                  <GpuDeviceHealthIndicator
                    healthy={row.healthy}
                    labels={labels}
                  />
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div className="min-w-0">
                  <div className="text-muted-foreground">{labels.node}</div>
                  <div className="truncate font-medium" title={row.nodeName}>
                    {row.nodeName}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-muted-foreground">{labels.product}</div>
                  <div className="break-words font-medium" title={row.product}>
                    {row.product || "-"}
                  </div>
                </div>
              </div>

              <div
                data-testid="gpu-device-resource-usage-row"
                className="mt-2.5 grid grid-cols-2 gap-2"
              >
                <ResourceUsageCard
                  label={labels.memoryUsage}
                  remainingLabel={labels.remaining}
                  pool={row.memory}
                  unit="GiB"
                  valueScale={VRAM_VALUE_SCALE}
                  precision={VRAM_VALUE_PRECISION}
                  series="blue"
                />
                <ResourceUsageCard
                  label={labels.coreUsage}
                  remainingLabel={labels.remaining}
                  pool={row.core}
                  series="cyan"
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <UITable>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[120px]">
                  {labels.gpuNumber}
                </TableHead>
                <TableHead className="w-[72px] text-center">
                  {labels.status}
                </TableHead>
                {showNodeColumn && (
                  <TableHead className="min-w-[140px]">{labels.node}</TableHead>
                )}
                <TableHead className="min-w-[150px]">
                  {labels.product}
                </TableHead>
                <TableHead className="min-w-[170px]">
                  {labels.memoryUsage}
                </TableHead>
                <TableHead className="min-w-[170px]">
                  {labels.coreUsage}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row) => (
                <TableRow
                  key={`${row.nodeName}:${row.uuid}`}
                  className={cn(
                    hasSelectedAccelerator &&
                      row.matchesSelectedAccelerator &&
                      "bg-primary/5",
                  )}
                >
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      title={labels.copyUuid}
                      aria-label={`${labels.gpuNumber} ${row.gpuNumber} ${labels.copyUuid}`}
                      className="h-8 justify-start px-2"
                      onClick={() =>
                        copy(row.uuid, {
                          successMessage: labels.copyUuidSuccess,
                          errorMessage: labels.copyUuidFailed,
                        })
                      }
                    >
                      <Cpu className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium tabular-nums">
                        {labels.gpuNumber} {row.gpuNumber}
                      </span>
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="sr-only">{labels.copyUuid}</span>
                    </Button>
                  </TableCell>
                  <TableCell className="text-center">
                    <GpuDeviceHealthIndicator
                      healthy={row.healthy}
                      labels={labels}
                      className="w-full"
                    />
                  </TableCell>
                  {showNodeColumn && (
                    <TableCell>
                      <span className="break-all text-sm">{row.nodeName}</span>
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{row.product || "-"}</span>
                      {hasSelectedAccelerator &&
                        row.matchesSelectedAccelerator && (
                          <Badge variant="secondary" className="font-normal">
                            {labels.selected}
                          </Badge>
                        )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <ResourceUsageCell
                      label={labels.usedSlashTotal}
                      remainingLabel={labels.remaining}
                      pool={row.memory}
                      unit="GiB"
                      valueScale={VRAM_VALUE_SCALE}
                      precision={VRAM_VALUE_PRECISION}
                      series="blue"
                    />
                  </TableCell>
                  <TableCell>
                    <ResourceUsageCell
                      label={labels.usedSlashTotal}
                      remainingLabel={labels.remaining}
                      pool={row.core}
                      series="cyan"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </UITable>
        </div>
      )}
    </div>
  );
}
