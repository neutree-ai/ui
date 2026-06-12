import { CircleAlert, CircleCheck, Copy, Cpu } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useCopyToClipboard } from "@/foundation/hooks/use-copy-to-clipboard";
import {
  buildGpuCardResourceRows,
  buildGpuDeviceResourceRows,
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

const formatCount = (value: number | null | undefined) => {
  if (value == null) return "-";
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toFixed(1) : "-";
};

const formatUsage = (
  used: number | null | undefined,
  total: number | null | undefined,
  unit = "",
) => {
  if (used == null || total == null) {
    return "-";
  }

  return `${formatCount(used)} / ${formatCount(total)}${unit}`;
};

const formatRemaining = (value: number | null | undefined, unit = "") =>
  value == null ? "-" : `${formatCount(value)}${unit}`;

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
  const normalizedTotal = total ?? 0;
  const normalizedAvailable = available ?? 0;
  const used = Math.max(0, normalizedTotal - normalizedAvailable);

  return {
    available: normalizedAvailable,
    total: normalizedTotal,
    used,
    percent: toPercentValue(used, normalizedTotal),
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
    percent: toPercentValue(totals.used, totals.total),
  };
};

function ClusterResourceRow({
  label,
  used,
  total,
  remaining,
  unit,
}: {
  label: string;
  used: number | null | undefined;
  total: number | null | undefined;
  remaining: number | null | undefined;
  unit?: string;
}) {
  const percent = toPercentValue(used, total);

  return (
    <div className="space-y-1 rounded-md bg-muted/30 px-2.5 py-2">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {formatPercent(percent)}
        </span>
      </div>
      <Progress value={percent} className="h-1.5" />
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="tabular-nums text-muted-foreground">
          {formatUsage(used, total, unit)}
        </span>
        <span className="font-medium tabular-nums">
          {formatRemaining(remaining, unit)}
        </span>
      </div>
    </div>
  );
}

function EndpointClusterResourceSummary({
  resourceInfo,
  summaryRows,
  virtualizationEnabled,
  t,
}: {
  resourceInfo: ClusterResourceInfo;
  summaryRows: ReturnType<typeof buildGpuCardResourceRows>;
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

  return (
    <div
      data-testid="endpoint-cluster-resource-summary"
      className="rounded-md border bg-background p-3"
    >
      <div className="mb-2 text-sm font-medium">
        {t("clusters.sections.clusterResources")}
      </div>
      <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-5">
        <ClusterResourceRow
          label={t("endpoints.fields.physicalGpu")}
          used={gpuSummary.used}
          total={gpuSummary.total}
          remaining={gpuSummary.available}
        />
        {virtualizationEnabled && (
          <>
            <ClusterResourceRow
              label={t("clusters.fields.memoryUsage")}
              used={acceleratorMemorySummary.used}
              total={acceleratorMemorySummary.total}
              remaining={acceleratorMemorySummary.available}
              unit=" MiB"
            />
            <ClusterResourceRow
              label={t("clusters.fields.coreUsage")}
              used={acceleratorCoreSummary.used}
              total={acceleratorCoreSummary.total}
              remaining={acceleratorCoreSummary.available}
            />
          </>
        )}
        <ClusterResourceRow
          label={t("common.fields.cpu")}
          used={cpuSummary.used}
          total={cpuSummary.total}
          remaining={cpuSummary.available}
          unit=" cores"
        />
        <ClusterResourceRow
          label={t("common.fields.memory")}
          used={memorySummary.used}
          total={memorySummary.total}
          remaining={memorySummary.available}
          unit=" GiB"
        />
      </div>
    </div>
  );
}

const isDeviceUsableForRequest = (
  row: GpuDeviceResourceRow,
  request: EndpointResourceRequestContext | undefined,
) => {
  if (!request) {
    return row.matchesSelectedAccelerator || row.fullFree;
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

const groupRowsByNode = (
  rows: GpuDeviceResourceRow[],
  nodeResources: Record<string, NodeResourceStatus> | null | undefined,
  request: EndpointResourceRequestContext | undefined,
): Array<{
  availableCore: number;
  availableMemory: number;
  cpuSummary: ReturnType<typeof summarizeResourcePool>;
  memorySummary: ReturnType<typeof summarizeResourcePool>;
  nodeName: string;
  rows: GpuDeviceResourceRow[];
  usableCount: number;
}> => {
  const groups = new Map<string, GpuDeviceResourceRow[]>();
  for (const row of rows) {
    groups.set(row.nodeName, [...(groups.get(row.nodeName) ?? []), row]);
  }

  return Array.from(groups.entries()).map(([nodeName, nodeRows]) => {
    const nodeStatus = nodeResources?.[nodeName];
    const cpuSummary = summarizeResourcePool(
      nodeStatus?.allocatable?.cpu,
      nodeStatus?.available?.cpu,
    );
    const memorySummary = summarizeResourcePool(
      nodeStatus?.allocatable?.memory,
      nodeStatus?.available?.memory,
    );
    const availableMemory = nodeRows.reduce(
      (sum, row) => sum + (row.memory.available ?? 0),
      0,
    );
    const availableCore = nodeRows.reduce(
      (sum, row) => sum + (row.core.available ?? 0),
      0,
    );
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
      usableCount,
    };
  });
};

function EndpointNodeGpuResources({
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
  const rows = useMemo(
    () => buildGpuDeviceResourceRows(nodeResources, selectedAccelerator),
    [nodeResources, selectedAccelerator],
  );
  const nodeGroups = useMemo(
    () => groupRowsByNode(rows, nodeResources, request),
    [nodeResources, request, rows],
  );

  if (rows.length === 0) {
    return (
      <div className="rounded-md border bg-background p-3 text-sm text-muted-foreground">
        {t("clusters.messages.noGpuDevices")}
      </div>
    );
  }

  return (
    <div data-testid="endpoint-compact-node-resources" className="space-y-2">
      {nodeGroups.map((group) => (
        <div
          data-testid="endpoint-compact-node-card"
          key={group.nodeName}
          className="rounded-md border bg-background p-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
                {group.nodeName}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {t("common.fields.cpu")}{" "}
                {formatPercent(group.cpuSummary.percent)} (
                {formatRemaining(group.cpuSummary.available, " cores")}) ·{" "}
                {t("common.fields.memory")}{" "}
                {formatPercent(group.memorySummary.percent)} (
                {formatRemaining(group.memorySummary.available, " GiB")})
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-normal">
                  {group.rows.length} {t("clusters.fields.gpuNumber")}
                </Badge>
                <Badge
                  variant={group.usableCount > 0 ? "secondary" : "outline"}
                  className="font-normal"
                >
                  {t("clusters.options.usable")} {group.usableCount}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {t("clusters.fields.memoryUsage")}{" "}
                  {formatRemaining(group.availableMemory, " MiB")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("clusters.fields.coreUsage")}{" "}
                  {formatRemaining(group.availableCore)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
            {group.rows.map((row) => {
              const usable = isDeviceUsableForRequest(row, request);

              return (
                <div
                  key={`${row.nodeName}:${row.uuid}`}
                  className={cn(
                    "rounded-md border bg-muted/20 p-2",
                    usable && "border-primary/40 bg-primary/5",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      title={row.uuid}
                      aria-label={`${t("clusters.fields.gpuNumber")} ${row.gpuNumber}, ${t("clusters.fields.deviceUuid")} ${row.uuid}`}
                      className="-ml-2 h-7 min-w-0 justify-start px-2 text-xs"
                      onClick={() =>
                        copy(row.uuid, {
                          successMessage: t(
                            "clusters.messages.copyUuidSuccess",
                          ),
                          errorMessage: t("clusters.messages.copyUuidFailed"),
                        })
                      }
                    >
                      <span className="truncate font-medium tabular-nums">
                        {t("clusters.fields.gpuNumber")} {row.gpuNumber}
                      </span>
                      <Copy className="h-3 w-3 shrink-0 text-muted-foreground" />
                    </Button>
                    <span
                      className="flex items-center justify-center"
                      role="img"
                      aria-label={
                        row.healthy
                          ? t("clusters.options.healthy")
                          : t("clusters.options.unhealthy")
                      }
                      title={
                        row.healthy
                          ? t("clusters.options.healthy")
                          : t("clusters.options.unhealthy")
                      }
                    >
                      {row.healthy ? (
                        <CircleCheck className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <CircleAlert className="h-4 w-4 text-destructive" />
                      )}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    {row.product || "-"}
                  </div>
                  <div className="mt-2 grid gap-1 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">
                        {t("clusters.fields.memoryUsage")}
                      </span>
                      <span className="font-medium tabular-nums">
                        {formatRemaining(row.memory.available, " MiB")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">
                        {t("clusters.fields.coreUsage")}
                      </span>
                      <span className="font-medium tabular-nums">
                        {formatRemaining(row.core.available)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
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
    <div className="space-y-3">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Cpu className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="truncate text-sm font-medium">{title}</div>
        </div>
        {selectedProduct && (
          <Badge
            variant="secondary"
            className="max-w-[160px] truncate font-normal"
          >
            {selectedProduct}
          </Badge>
        )}
      </div>

      <EndpointClusterGpuResourcesInlineContent
        resourceInfo={resourceInfo}
        selectedAccelerator={selectedAccelerator}
        virtualizationEnabled={virtualizationEnabled}
        summaryRows={summaryRows}
        request={request}
        t={t}
      />
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
    <div className="space-y-3 pr-1 xl:max-h-[calc(100vh-180px)] xl:overflow-y-auto">
      <EndpointClusterResourceSummary
        resourceInfo={resourceInfo}
        summaryRows={summaryRows}
        virtualizationEnabled={virtualizationEnabled}
        t={t}
      />
      <EndpointNodeGpuResources
        nodeResources={resourceInfo.node_resources}
        selectedAccelerator={selectedAccelerator}
        request={request}
        t={t}
      />
    </div>
  );
}
