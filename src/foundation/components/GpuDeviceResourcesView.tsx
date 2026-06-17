import { CircleAlert, CircleCheck, Copy, Cpu, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
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
import { useCopyToClipboard } from "@/foundation/hooks/use-copy-to-clipboard";
import {
  buildGpuDeviceResourceRows,
  filterGpuDeviceResourceRows,
  GPU_DEVICE_FILTER_ALL,
  type GpuDeviceResourceRow,
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
  variant?: "table" | "cards";
  showHeader?: boolean;
  showFilters?: boolean;
  showSummary?: boolean;
  showResourceControls?: boolean;
  resourceControlsTestId?: string;
  request?: GpuDeviceRequestFitContext;
};

type GpuDeviceRequestFitContext = {
  allocationMode: "full" | "vgpu";
  memoryMiBPerSlice?: number | null;
  coreUnitsPerSlice?: number | null;
};

type ResourceScope = "all" | "free" | "usable";

const formatNumber = (value: number | null | undefined) =>
  value == null ? "-" : (formatToDecimal(value, 0) ?? "-");

const formatUsage = (
  pool: Pick<GpuDeviceResourceRow["memory"], "used" | "total">,
  unit = "",
) => {
  if (pool.used == null || pool.total == null) {
    return "-";
  }

  const value = `${formatNumber(pool.used)} / ${formatNumber(pool.total)}`;
  return unit ? `${value} ${unit}` : value;
};

const formatAvailable = (
  pool: Pick<GpuDeviceResourceRow["memory"], "available">,
  unit = "",
) => {
  if (pool.available == null) {
    return "-";
  }

  const value = formatNumber(pool.available);
  return unit ? `${value} ${unit}` : value;
};

const summarizePool = (
  rows: GpuDeviceResourceRow[],
  field: "memory" | "core",
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

const ResourceUsageCell = ({
  label,
  remainingLabel,
  pool,
  unit,
}: {
  label: string;
  remainingLabel: string;
  pool: GpuDeviceResourceRow["memory"];
  unit?: string;
}) => (
  <div className="min-w-[150px] space-y-1">
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{pool.percent}%</span>
    </div>
    <Progress value={pool.percent} className="h-2" />
    <div className="text-xs tabular-nums text-muted-foreground">
      {formatUsage(pool, unit)}
    </div>
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{remainingLabel}</span>
      <span className="tabular-nums">{formatAvailable(pool, unit)}</span>
    </div>
  </div>
);

const ResourceUsageCard = ({
  label,
  remainingLabel,
  pool,
  unit,
}: {
  label: string;
  remainingLabel: string;
  pool: GpuDeviceResourceRow["memory"];
  unit?: string;
}) => (
  <div className="space-y-1 rounded-md bg-muted/30 px-2 py-1.5">
    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>{label}</span>
      <span className="tabular-nums">{pool.percent}%</span>
    </div>
    <Progress value={pool.percent} className="h-1.5" />
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{remainingLabel}</span>
      <span className="tabular-nums">{formatAvailable(pool, unit)}</span>
    </div>
    <div className="text-xs tabular-nums text-muted-foreground">
      {formatUsage(pool, unit)}
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

  const memoryMiBPerSlice = Number(request.memoryMiBPerSlice || 0);
  const coreUnitsPerSlice = Number(request.coreUnitsPerSlice || 0);
  const availableMemory = Number(row.memory.available || 0);
  const availableCore = Number(row.core.available || 0);

  if (memoryMiBPerSlice > 0 && availableMemory < memoryMiBPerSlice) {
    return false;
  }

  if (coreUnitsPerSlice > 0 && availableCore < coreUnitsPerSlice) {
    return false;
  }

  return availableMemory > 0 || row.fullFree;
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

  if (rows.length === 0) {
    return (
      <div className={cn("rounded-md border p-4 text-sm", className)}>
        {showHeader && <div className="font-medium">{labels.title}</div>}
        <div className="mt-2 text-muted-foreground">{labels.empty}</div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3 rounded-md border p-3", className)}>
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
              <span>{labels.coreUsage}</span>
              <span className="tabular-nums">{coreSummary.percent}%</span>
            </div>
            <Progress value={coreSummary.percent} className="mt-2 h-2" />
            <div className="mt-1 flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">{labels.remaining}</span>
              <span className="tabular-nums">
                {formatNumber(coreSummary.available)}
              </span>
            </div>
          </div>
          <div className="rounded-md bg-muted/40 px-3 py-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{labels.memoryUsage}</span>
              <span className="tabular-nums">{memorySummary.percent}%</span>
            </div>
            <Progress value={memorySummary.percent} className="mt-2 h-2" />
            <div className="mt-1 flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">{labels.remaining}</span>
              <span className="tabular-nums">
                {formatNumber(memorySummary.available)} MiB
              </span>
            </div>
          </div>
        </div>
      )}

      {showFilters && (
        <div className="grid gap-2 md:grid-cols-[minmax(140px,220px)_minmax(140px,220px)_minmax(180px,1fr)]">
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger>
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
            <SelectTrigger>
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

      {variant === "cards" ? (
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
                  title={row.uuid}
                  aria-label={`${labels.gpuNumber} ${row.gpuNumber}, ${labels.uuid} ${row.uuid}`}
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
                  <span
                    className="flex items-center justify-center"
                    role="img"
                    aria-label={row.healthy ? labels.healthy : labels.unhealthy}
                    title={row.healthy ? labels.healthy : labels.unhealthy}
                  >
                    {row.healthy ? (
                      <CircleCheck className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <CircleAlert className="h-4 w-4 text-destructive" />
                    )}
                  </span>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div className="min-w-0">
                  <div className="text-muted-foreground">{labels.node}</div>
                  <div className="truncate font-medium">{row.nodeName}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-muted-foreground">{labels.product}</div>
                  <div className="truncate font-medium">
                    {row.product || "-"}
                  </div>
                </div>
              </div>

              <div
                data-testid="gpu-device-resource-usage-row"
                className="mt-2.5 grid grid-cols-2 gap-2"
              >
                <ResourceUsageCard
                  label={labels.coreUsage}
                  remainingLabel={labels.remaining}
                  pool={row.core}
                />
                <ResourceUsageCard
                  label={labels.memoryUsage}
                  remainingLabel={labels.remaining}
                  pool={row.memory}
                  unit="MiB"
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
                <TableHead>{labels.status}</TableHead>
                <TableHead className="min-w-[140px]">{labels.node}</TableHead>
                <TableHead className="min-w-[150px]">
                  {labels.product}
                </TableHead>
                <TableHead className="min-w-[170px]">
                  {labels.coreUsage}
                </TableHead>
                <TableHead className="min-w-[170px]">
                  {labels.memoryUsage}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row) => (
                <TableRow
                  key={`${row.nodeName}:${row.uuid}`}
                  className={cn(
                    row.matchesSelectedAccelerator && "bg-primary/5",
                  )}
                >
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      title={row.uuid}
                      aria-label={`${labels.gpuNumber} ${row.gpuNumber}, ${labels.uuid} ${row.uuid}`}
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
                  <TableCell>
                    <span
                      className="flex items-center justify-center"
                      role="img"
                      aria-label={
                        row.healthy ? labels.healthy : labels.unhealthy
                      }
                      title={row.healthy ? labels.healthy : labels.unhealthy}
                    >
                      {row.healthy ? (
                        <CircleCheck className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <CircleAlert className="h-4 w-4 text-destructive" />
                      )}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="break-all text-sm">{row.nodeName}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{row.product || "-"}</span>
                      {row.matchesSelectedAccelerator && (
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
                      pool={row.core}
                    />
                  </TableCell>
                  <TableCell>
                    <ResourceUsageCell
                      label={labels.usedSlashTotal}
                      remainingLabel={labels.remaining}
                      pool={row.memory}
                      unit="MiB"
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
