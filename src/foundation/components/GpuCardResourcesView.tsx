import { Cpu, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import {
  buildGpuCardResourceRows,
  GPU_DEVICE_FILTER_ALL,
  type GpuCardResourceRow,
} from "@/foundation/lib/gpu-device-resources";
import { formatToDecimal } from "@/foundation/lib/unit";
import { cn } from "@/foundation/lib/utils";
import type { ClusterResourceInfo } from "@/foundation/types/resource-types";

type GpuCardResourcesViewLabels = {
  title: string;
  productCount: string;
  physicalGpu: string;
  singleCardMemory: string;
  memoryUsage: string;
  coreUsage: string;
  allProducts: string;
  searchPlaceholder: string;
  acceleratorType: string;
  product: string;
  selected: string;
  remaining: string;
  usedSlashTotal: string;
  empty: string;
};

type SelectedAccelerator = {
  type?: string | null;
  product?: string | null;
};

type GpuCardResourcesViewProps = {
  resourceInfo: ClusterResourceInfo | null | undefined;
  labels: GpuCardResourcesViewLabels;
  selectedAccelerator?: SelectedAccelerator | null;
  className?: string;
  virtualizationEnabled?: boolean;
  formatAcceleratorType?: (type: string) => string;
  variant?: "table" | "cards";
  showHeader?: boolean;
  showFilters?: boolean;
  showSummary?: boolean;
};

const formatNumber = (value: number | null | undefined) =>
  value == null ? "-" : (formatToDecimal(value, 0) ?? "-");

const formatUsage = (
  pool: Pick<GpuCardResourceRow["memory"], "used" | "total">,
  unit = "",
) => {
  if (pool.used == null || pool.total == null) {
    return "-";
  }

  const value = `${formatNumber(pool.used)} / ${formatNumber(pool.total)}`;
  return unit ? `${value} ${unit}` : value;
};

const formatAvailable = (
  pool: Pick<GpuCardResourceRow["memory"], "available">,
  unit = "",
) => {
  if (pool.available == null) {
    return "-";
  }

  const value = formatNumber(pool.available);
  return unit ? `${value} ${unit}` : value;
};

const summarizePool = (
  rows: GpuCardResourceRow[],
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

const ResourceUsageCell = ({
  label,
  remainingLabel,
  pool,
  unit,
}: {
  label: string;
  remainingLabel: string;
  pool: GpuCardResourceRow["memory"];
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

const CompactMetric = ({
  label,
  value,
  detail,
  className,
}: {
  label: string;
  value: string;
  detail?: string;
  className?: string;
}) => (
  <div className={cn("min-w-0 rounded-sm bg-muted/30 px-1.5 py-1", className)}>
    <div className="flex min-w-0 items-center justify-between gap-2">
      <span className="truncate text-[10px] text-muted-foreground">
        {label}
      </span>
      <span className="shrink-0 text-[11px] font-medium tabular-nums">
        {value}
      </span>
    </div>
    {detail && (
      <div className="mt-0.5 truncate text-[10px] tabular-nums text-muted-foreground">
        {detail}
      </div>
    )}
  </div>
);

const CompactPoolMetric = ({
  label,
  remainingLabel,
  pool,
  unit,
}: {
  label: string;
  remainingLabel: string;
  pool: GpuCardResourceRow["memory"];
  unit?: string;
}) => (
  <CompactMetric
    label={label}
    value={`${formatAvailable(pool, unit)} / ${
      pool.total == null
        ? "-"
        : unit
          ? `${formatNumber(pool.total)} ${unit}`
          : formatNumber(pool.total)
    }`}
    detail={`${remainingLabel} · ${formatUsage(pool, unit)}`}
  />
);

export function GpuCardResourcesView({
  resourceInfo,
  labels,
  selectedAccelerator,
  className,
  virtualizationEnabled = true,
  formatAcceleratorType = (type) => type,
  variant = "table",
  showHeader = true,
  showFilters = true,
  showSummary = true,
}: GpuCardResourcesViewProps) {
  const [productFilter, setProductFilter] = useState(GPU_DEVICE_FILTER_ALL);
  const [search, setSearch] = useState("");

  const rows = useMemo(
    () => buildGpuCardResourceRows(resourceInfo, selectedAccelerator),
    [resourceInfo, selectedAccelerator],
  );
  const products = useMemo(
    () => Array.from(new Set(rows.map((row) => row.product))).sort(),
    [rows],
  );
  const visibleRows = useMemo(() => {
    const normalizedProduct =
      productFilter === GPU_DEVICE_FILTER_ALL ? null : productFilter;
    const normalizedSearch = search.trim().toLowerCase();

    return rows.filter((row) => {
      if (normalizedProduct && row.product !== normalizedProduct) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [
        row.acceleratorType,
        formatAcceleratorType(row.acceleratorType),
        row.product,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [formatAcceleratorType, productFilter, rows, search]);

  const quantitySummary = useMemo(
    () => summarizePool(visibleRows, "quantity"),
    [visibleRows],
  );
  const memorySummary = useMemo(
    () => summarizePool(visibleRows, "memory"),
    [visibleRows],
  );
  const coreSummary = useMemo(
    () => summarizePool(visibleRows, "core"),
    [visibleRows],
  );
  const summaryGridClass = virtualizationEnabled
    ? "md:grid-cols-4"
    : "md:grid-cols-2";

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
        <div className={cn("grid gap-2", summaryGridClass)}>
          <div className="rounded-md bg-muted/40 px-3 py-2">
            <div className="text-xs text-muted-foreground">
              {labels.productCount}
            </div>
            <div className="text-sm font-medium tabular-nums">
              {visibleRows.length}
            </div>
          </div>
          <div className="rounded-md bg-muted/40 px-3 py-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{labels.physicalGpu}</span>
              <span className="tabular-nums">{quantitySummary.percent}%</span>
            </div>
            <Progress value={quantitySummary.percent} className="mt-2 h-2" />
            <div className="mt-1 flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">{labels.remaining}</span>
              <span className="tabular-nums">
                {formatNumber(quantitySummary.available)}
              </span>
            </div>
          </div>
          {virtualizationEnabled && (
            <>
              <div className="rounded-md bg-muted/40 px-3 py-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{labels.coreUsage}</span>
                  <span className="tabular-nums">{coreSummary.percent}%</span>
                </div>
                <Progress value={coreSummary.percent} className="mt-2 h-2" />
                <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">
                    {labels.remaining}
                  </span>
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
                  <span className="text-muted-foreground">
                    {labels.remaining}
                  </span>
                  <span className="tabular-nums">
                    {formatNumber(memorySummary.available)} MiB
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {showFilters && (
        <div className="grid gap-2 md:grid-cols-[minmax(140px,220px)_minmax(180px,1fr)]">
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={GPU_DEVICE_FILTER_ALL}>
                {labels.allProducts}
              </SelectItem>
              {products.map((product) => (
                <SelectItem key={product} value={product}>
                  {product}
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

      {variant === "cards" ? (
        <div className="grid gap-2">
          {visibleRows.map((row) => (
            <div
              key={`${row.acceleratorType}:${row.product}`}
              className={cn(
                "rounded-md border bg-background px-2 py-1.5",
                row.matchesSelectedAccelerator &&
                  "border-primary/40 bg-primary/5",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-xs font-medium">
                    {row.product || "-"}
                  </span>
                  <span className="truncate text-[10px] text-muted-foreground">
                    {formatAcceleratorType(row.acceleratorType)}
                  </span>
                </div>
                {row.matchesSelectedAccelerator && (
                  <Badge
                    variant="secondary"
                    className="h-5 shrink-0 px-1.5 text-[10px] font-normal"
                  >
                    {labels.selected}
                  </Badge>
                )}
              </div>

              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                <CompactPoolMetric
                  label={labels.physicalGpu}
                  remainingLabel={labels.remaining}
                  pool={row.quantity}
                />
                <CompactMetric
                  label={labels.singleCardMemory}
                  value={row.memoryTotalMiB ? `${row.memoryTotalMiB} MiB` : "-"}
                />
              </div>
              {virtualizationEnabled && (
                <div
                  data-testid="gpu-card-resource-usage-row"
                  className="mt-1.5 grid grid-cols-2 gap-1.5"
                >
                  <CompactPoolMetric
                    label={labels.coreUsage}
                    remainingLabel={labels.remaining}
                    pool={row.core}
                  />
                  <CompactPoolMetric
                    label={labels.memoryUsage}
                    remainingLabel={labels.remaining}
                    pool={row.memory}
                    unit="MiB"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <UITable>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[140px]">
                  {labels.acceleratorType}
                </TableHead>
                <TableHead className="min-w-[150px]">
                  {labels.product}
                </TableHead>
                <TableHead className="min-w-[170px]">
                  {labels.physicalGpu}
                </TableHead>
                <TableHead className="min-w-[150px]">
                  {labels.singleCardMemory}
                </TableHead>
                {virtualizationEnabled && (
                  <>
                    <TableHead className="min-w-[170px]">
                      {labels.coreUsage}
                    </TableHead>
                    <TableHead className="min-w-[170px]">
                      {labels.memoryUsage}
                    </TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row) => (
                <TableRow
                  key={`${row.acceleratorType}:${row.product}`}
                  className={cn(
                    row.matchesSelectedAccelerator && "bg-primary/5",
                  )}
                >
                  <TableCell>
                    {formatAcceleratorType(row.acceleratorType)}
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
                      pool={row.quantity}
                    />
                  </TableCell>
                  <TableCell>
                    {row.memoryTotalMiB ? `${row.memoryTotalMiB} MiB` : "-"}
                  </TableCell>
                  {virtualizationEnabled && (
                    <>
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
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </UITable>
        </div>
      )}
    </div>
  );
}
