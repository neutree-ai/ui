/** Endpoint-scoped allocation map. GPU facts are grouped by physical device. */
import { Copy, Server } from "lucide-react";
import { type CSSProperties, type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  type EndpointGpuResourceAllocation,
  type EndpointGpuResourceGroup,
  type EndpointReplicaResourceGroup,
  getEndpointGpuResourceGroups,
  getEndpointReplicaResourceGroups,
  getEndpointResourceSummaryRows,
} from "@/domains/endpoint/lib/resource-status";
import { getVgpuVirtualization } from "@/domains/endpoint/lib/vgpu";
import { EmptyValue } from "@/foundation/components/EmptyValue";
import { GpuDetailsSheet } from "@/foundation/components/GpuDetailsSheet";
import { MetricBar } from "@/foundation/components/MetricBar";
import { ObservationStatus } from "@/foundation/components/ObservationStatus";
import { Section } from "@/foundation/components/Section";
import { useCopyToClipboard } from "@/foundation/hooks/use-copy-to-clipboard";
import {
  type AcceleratorSample,
  allocationFallbackReadings,
  formatL1CacheUsage,
  type GpuAllocation,
  type NodeL1CacheUsage,
  reading,
} from "@/foundation/lib/accelerator-observations";
import { productPeakTflops } from "@/foundation/lib/accelerator-tflops";
import {
  CHART_CATEGORY_COUNT,
  CHART_SERIES_SEPARATOR,
  chartCategoryMark,
  chartMarkStyle,
  chartMoreMark,
} from "@/foundation/lib/chart-palette";
import {
  formatMiBAsGiB,
  formatMiBAsGiBValue,
  formatToDecimal,
} from "@/foundation/lib/unit";
import { cn } from "@/foundation/lib/utils";
import type {
  ClusterResourceInfo,
  EndpointResourceStatus,
} from "@/foundation/types/resource-types";
import type { ResourceSpec } from "@/foundation/types/serving-types";

type Props = {
  resources: EndpointResourceStatus | null | undefined;
  requestedResources?: ResourceSpec | null;
  clusterResourceInfo?: ClusterResourceInfo | null;
  className?: string;
  l1CacheByNode?: Record<string, NodeL1CacheUsage>;
  samples?: AcceleratorSample[];
  deviceSamples?: AcceleratorSample[];
  observationStatus?: string;
  deviceObservationStatus?: string;
  onObservationRetry?: () => void;
  onDeviceObservationRetry?: () => void;
  tflopsOverrides?: Record<string, number>;
  endpointName?: string;
  workspace?: string;
  modelName?: string;
  gpuAllocations?: GpuAllocation[];
};

type Identity = { endpointName: string; workspace: string; modelName: string };

type NodeGroup = {
  nodeId: string;
  devices: EndpointGpuResourceGroup[];
};

const OTHER_ENDPOINT_BACKGROUND =
  "color-mix(in srgb, var(--nt-chart-more) 36%, var(--nt-fill-neutral-white))";
const OWNER_WEIGHTS_TONE = 72;
const OWNER_SECONDARY_TONE = 24;
const ownerTone = (color: string, amount: number) =>
  `color-mix(in srgb, ${color} ${amount}%, var(--nt-fill-neutral-white))`;
const l0Pattern = (color: string) =>
  `repeating-linear-gradient(135deg, ${color} 0 2px, transparent 2px 5px)`;

const gib = (mib: number | null | undefined) =>
  mib == null ? <EmptyValue /> : `${(mib / 1024).toFixed(1)} GiB`;

const gibValue = (mib: number | null | undefined) =>
  mib == null ? <EmptyValue /> : (mib / 1024).toFixed(1);

const replicaCode = (index: number) => `R${index}`;

const formatMemoryGiB = (mib: number | null | undefined): ReactNode =>
  formatMiBAsGiB(mib) ?? <EmptyValue />;

const formatCount = (
  count: number,
  singular: string,
  plural: string,
  t: (key: string, options?: Record<string, unknown>) => string,
) => `${count} ${t(count === 1 ? singular : plural)}`;

const toAllocation = (
  row: EndpointGpuResourceAllocation,
  identity: Identity,
): GpuAllocation => ({
  endpoint: identity.endpointName,
  workspace: identity.workspace,
  model: identity.modelName,
  node: row.nodeId,
  uuid: row.uuid,
  replica: row.replicaId,
  instance: row.instanceId,
  vdevice: row.vdeviceIndex ?? undefined,
  memoryMiB: row.memoryMiB,
  coreUnits: row.coreUnits,
  modelWeightsMiB: row.modelWeightsMiB,
  kvCacheCapacityMiB: row.kvCacheCapacityMiB,
});

const nodeGroups = (devices: EndpointGpuResourceGroup[]): NodeGroup[] => {
  const groups = new Map<string, NodeGroup>();
  for (const device of devices) {
    const existing = groups.get(device.nodeId);
    if (existing) {
      existing.devices.push(device);
    } else {
      groups.set(device.nodeId, {
        nodeId: device.nodeId,
        devices: [device],
      });
    }
  }
  return Array.from(groups.values());
};

const latestSampleAge = (samples: AcceleratorSample[]): string | null => {
  const latest = samples.reduce(
    (value, sample) => Math.max(value, sample.observed_at),
    0,
  );
  if (latest <= 0) return null;
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - latest);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
};

function formatObservedUtilization(
  devices: EndpointGpuResourceGroup[],
  samples: AcceleratorSample[],
  identity: Identity,
): string {
  const values = devices.map((device) =>
    endpointUtilization(device, samples, identity),
  );
  if (!values.every((value) => value != null)) return "—";
  const percentages = values.map((value) => Number(value) * 100);
  const average =
    percentages.reduce((sum, value) => sum + value, 0) / percentages.length;
  const peak = Math.max(...percentages);
  return `${average.toFixed(0)}% · ${peak.toFixed(0)}% peak`;
}

function measuredEndpointMemory(
  devices: EndpointGpuResourceGroup[],
  samples: AcceleratorSample[],
  identity: Identity,
): number | null {
  const values = devices.map((device) =>
    endpointMemoryUsage(device, samples, identity),
  );
  return values.every((value) => value != null)
    ? values.reduce<number>((sum, value) => sum + Number(value), 0)
    : null;
}

function endpointMemoryUsage(
  device: EndpointGpuResourceGroup,
  samples: AcceleratorSample[],
  identity: Identity,
): number | null {
  return allocationFallbackReadings(
    samples,
    device.allocations.map((allocation) => toAllocation(allocation, identity)),
  ).memoryUsedMiB;
}

function endpointUtilization(
  device: EndpointGpuResourceGroup,
  samples: AcceleratorSample[],
  identity: Identity,
): number | null {
  return (
    allocationFallbackReadings(
      samples,
      device.allocations.map((allocation) =>
        toAllocation(allocation, identity),
      ),
    ).utilization?.value ?? null
  );
}

function AggregateStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 border-b border-r border-[var(--nt-stroke-neutral-trans-2)] px-5 py-2.5 last:border-r-0 sm:border-b-0">
      <span className="block text-[11px] text-muted-foreground">{label}</span>
      <strong className="mt-0.5 block truncate text-sm font-semibold tabular-nums">
        {value}
      </strong>
    </div>
  );
}

export function EndpointRuntimeResourcesSummary({
  resources,
  className,
}: {
  resources: EndpointResourceStatus | null | undefined;
  className?: string;
}) {
  const { t } = useTranslation();
  const replicaGroups = getEndpointReplicaResourceGroups(resources);
  const allocatedDeviceCount = getEndpointGpuResourceGroups(resources).length;

  if (allocatedDeviceCount === 0) return null;

  return (
    <span className={cn("text-xs text-muted-foreground", className)}>
      {t("endpoints.fields.replicaCount", {
        count: replicaGroups.length,
      })}{" "}
      /{" "}
      {t("endpoints.fields.allocatedCardCount", {
        count: allocatedDeviceCount,
      })}
    </span>
  );
}

function CopyUuidButton({ uuid, index }: { uuid: string; index: number }) {
  const { t } = useTranslation();
  const { copy } = useCopyToClipboard();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title={t("clusters.actions.copyUuid")}
          aria-label={`${t("clusters.fields.gpuNumber")} ${index} ${t("clusters.actions.copyUuid")}`}
          className="h-6 w-6 shrink-0 text-[var(--nt-text-neutral-quaternary)] hover:text-[var(--nt-text-neutral-secondary)]"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            copy(uuid, {
              successMessage: t("clusters.messages.copyUuidSuccess"),
              errorMessage: t("clusters.messages.copyUuidFailed"),
            });
          }}
        >
          <Copy className="h-3 w-3" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t("clusters.actions.copyUuid")}</TooltipContent>
    </Tooltip>
  );
}

function ReplicaSegmentComposition({
  allocation,
  mark,
}: {
  allocation: EndpointGpuResourceAllocation;
  mark: ReturnType<typeof chartCategoryMark>;
}) {
  const weights = allocation.modelWeightsMiB;
  const cache = allocation.kvCacheCapacityMiB;
  if (weights == null) return null;
  const other = Math.max(0, allocation.memoryMiB - weights - (cache ?? 0));

  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 flex overflow-hidden"
      data-testid="replica-composition"
    >
      <span
        className="h-full"
        data-testid="replica-composition-weights"
        style={{
          backgroundColor: ownerTone(mark.color, OWNER_WEIGHTS_TONE),
          width: `${(weights / allocation.memoryMiB) * 100}%`,
        }}
      />
      {cache != null && cache > 0 && (
        <span
          className="h-full"
          data-testid="replica-composition-cache"
          style={{
            backgroundColor: "var(--nt-fill-neutral-white)",
            backgroundImage: l0Pattern(mark.color),
            width: `${(cache / allocation.memoryMiB) * 100}%`,
          }}
        />
      )}
      <span
        className="h-full"
        data-testid="replica-composition-other"
        style={{
          backgroundColor: ownerTone(mark.color, OWNER_SECONDARY_TONE),
          width: `${(other / allocation.memoryMiB) * 100}%`,
        }}
      />
    </span>
  );
}

function AllocationTooltip({
  allocation,
  actualMiB,
  mark,
  deviceLabel,
}: {
  allocation: EndpointGpuResourceAllocation;
  actualMiB: number | null;
  mark: ReturnType<typeof chartCategoryMark>;
  deviceLabel: string;
}) {
  const { t } = useTranslation();
  const weights = allocation.modelWeightsMiB;
  const cache = allocation.kvCacheCapacityMiB;
  const other =
    weights == null
      ? null
      : Math.max(0, allocation.memoryMiB - weights - (cache ?? 0));
  const actualPercent =
    actualMiB == null || allocation.memoryMiB <= 0
      ? null
      : Math.round((actualMiB / allocation.memoryMiB) * 100);
  const actualExceedsReserved =
    actualMiB != null && actualMiB > allocation.memoryMiB;
  const overageMiB =
    actualExceedsReserved && actualMiB != null
      ? actualMiB - allocation.memoryMiB
      : null;

  return (
    <div className="w-64">
      <div className="flex min-w-0 items-center gap-1.5 text-xs font-semibold">
        <span
          className="size-2 shrink-0 rounded-sm"
          style={chartMarkStyle(mark)}
        />
        <span className="truncate">
          {t("observations.replicaLabel")}{" "}
          {replicaCode(allocation.replicaIndex)} · {deviceLabel}
        </span>
      </div>
      <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
        {allocation.nodeId}
        {allocation.vdeviceIndex != null
          ? ` · ${t("observations.vgpuLabel")} ${allocation.vdeviceIndex}`
          : ""}
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-3 text-[11px]">
        <span className="text-muted-foreground">
          {t("observations.reservedVram")}
        </span>
        <span className="font-semibold tabular-nums">
          {gib(allocation.memoryMiB)}
        </span>
      </div>
      {weights != null && (
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 border-t pt-2">
          <TooltipLegendItem
            label={t("observations.modelWeights")}
            style={{
              backgroundColor: ownerTone(mark.color, OWNER_WEIGHTS_TONE),
            }}
            value={gib(weights)}
          />
          {cache != null && (
            <TooltipLegendItem
              label={t("observations.l0KvCacheCapacity")}
              style={{
                backgroundColor: "var(--nt-fill-neutral-white)",
                backgroundImage: l0Pattern(mark.color),
              }}
              value={gib(cache)}
            />
          )}
          <TooltipLegendItem
            label={t("observations.otherReservation")}
            style={{
              backgroundColor: ownerTone(mark.color, OWNER_SECONDARY_TONE),
            }}
            value={gib(other)}
          />
        </div>
      )}
      <div className="mt-2 border-t pt-2">
        <div className="flex items-start justify-between gap-3 text-[11px]">
          <span className="flex items-center gap-1.5 whitespace-nowrap text-muted-foreground">
            <span
              className="h-3 w-0.5 rounded-full"
              style={{
                backgroundColor:
                  actualMiB != null && actualMiB > allocation.memoryMiB
                    ? "var(--nt-fill-serious-base)"
                    : "var(--nt-text-neutral-super)",
              }}
            />
            {t("observations.actualVramUsage")}
          </span>
          <span
            className="shrink-0 text-right font-semibold tabular-nums"
            data-testid="actual-vram-value"
          >
            <span className="block whitespace-nowrap">{gib(actualMiB)}</span>
            {actualPercent != null && (
              <span className="block text-[10px] font-normal text-muted-foreground">
                <span className="block whitespace-nowrap">
                  {actualExceedsReserved
                    ? t("observations.usedAndExceedsReserved", {
                        percent: actualPercent,
                        memory: gib(overageMiB),
                      })
                    : t("observations.actualOfReserved", {
                        percent: actualPercent,
                      })}
                </span>
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

function TooltipLegendItem({
  label,
  value,
  style,
}: {
  label: string;
  value: ReactNode;
  style: CSSProperties;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[8px_minmax(0,1fr)] gap-x-1">
      <span className="mt-1 size-2 rounded-[2px]" style={style} />
      <span className="truncate text-[10px] text-muted-foreground">
        {label}
      </span>
      <span className="col-start-2 text-[11px] font-semibold tabular-nums">
        {value}
      </span>
    </div>
  );
}

function EndpointOwnershipMark({
  allocations,
  actualMiB,
  mark,
  showComposition,
}: {
  allocations: EndpointGpuResourceAllocation[];
  actualMiB: number | null;
  mark: ReturnType<typeof chartCategoryMark>;
  showComposition: boolean;
}) {
  if (allocations.length > 1) {
    return (
      <span
        aria-hidden="true"
        className="flex h-2 w-3 shrink-0 overflow-hidden rounded-sm"
        data-testid="ownership-endpoint-replicas"
      >
        {allocations.map((allocation, index) => {
          const allocationMark = chartCategoryMark(allocation.replicaIndex);
          return (
            <span
              className="h-full min-w-0"
              key={allocation.replicaKey}
              style={{
                ...chartMarkStyle(allocationMark),
                flexGrow: allocation.memoryMiB,
                boxShadow:
                  index === 0
                    ? undefined
                    : `inset 1px 0 0 ${CHART_SERIES_SEPARATOR}`,
              }}
            />
          );
        })}
      </span>
    );
  }

  const allocation = allocations[0];
  if (!showComposition) {
    return (
      <span
        aria-hidden="true"
        className="size-2 shrink-0 rounded-sm"
        data-testid="ownership-endpoint-mark"
        style={{ backgroundColor: mark.color }}
      />
    );
  }
  const weights = allocation?.modelWeightsMiB;
  const cache = allocation?.kvCacheCapacityMiB;
  const reserved = allocation?.memoryMiB ?? 0;
  const other =
    weights == null ? 0 : Math.max(0, reserved - weights - (cache ?? 0));
  const actual =
    actualMiB == null ? null : Math.min(Math.max(0, actualMiB), reserved);
  const unused = actual == null ? reserved : Math.max(0, reserved - actual);
  return (
    <span
      aria-hidden="true"
      className="flex h-2 w-3 shrink-0 overflow-hidden rounded-sm bg-[var(--nt-fill-neutral-trans-3)]"
      data-testid="ownership-endpoint-mark"
    >
      {weights != null ? (
        <>
          {weights > 0 && (
            <span
              className="h-full min-w-0"
              data-testid="ownership-endpoint-weights"
              style={{
                backgroundColor: ownerTone(mark.color, OWNER_WEIGHTS_TONE),
                flexGrow: weights,
              }}
            />
          )}
          {cache != null && cache > 0 && (
            <span
              className="h-full min-w-0"
              data-testid="ownership-endpoint-cache"
              style={{
                backgroundColor: "var(--nt-fill-neutral-white)",
                backgroundImage: l0Pattern(mark.color),
                flexGrow: cache,
              }}
            />
          )}
          {other > 0 && (
            <span
              className="h-full min-w-0"
              data-testid="ownership-endpoint-other"
              style={{
                backgroundColor: ownerTone(mark.color, OWNER_SECONDARY_TONE),
                flexGrow: other,
              }}
            />
          )}
        </>
      ) : (
        <>
          {actual != null && actual > 0 && (
            <span
              className="h-full min-w-0"
              data-testid="ownership-endpoint-actual"
              style={{
                backgroundColor: mark.color,
                flexGrow: actual,
              }}
            />
          )}
          {unused > 0 && (
            <span
              className="h-full min-w-0"
              data-testid="ownership-endpoint-unused"
              style={{
                backgroundColor: ownerTone(mark.color, OWNER_SECONDARY_TONE),
                flexGrow: unused,
              }}
            />
          )}
        </>
      )}
    </span>
  );
}

function AllocationOwnershipLegend({
  allocations,
  actualMiB,
  endpointMiB,
  otherMiB,
  unallocatedMiB,
  mark,
  showEndpointComposition = false,
}: {
  allocations: EndpointGpuResourceAllocation[];
  actualMiB: number | null;
  endpointMiB: number;
  otherMiB: number;
  unallocatedMiB: number;
  mark: ReturnType<typeof chartCategoryMark>;
  showEndpointComposition?: boolean;
}) {
  const { t } = useTranslation();
  if (otherMiB <= 0 && unallocatedMiB <= 0) return null;

  return (
    <div
      className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] leading-4 text-muted-foreground"
      data-testid="allocation-ownership-legend"
    >
      <span className="inline-flex items-center gap-1.5">
        <EndpointOwnershipMark
          actualMiB={actualMiB}
          allocations={allocations}
          mark={mark}
          showComposition={showEndpointComposition}
        />
        {t("observations.thisEndpoint")}
        <strong className="font-semibold tabular-nums text-foreground">
          {gibValue(endpointMiB)} GiB {t("observations.reservedLower")}
        </strong>
      </span>
      {otherMiB > 0 && (
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2 rounded-sm"
            style={{
              ...chartMarkStyle(chartMoreMark()),
              backgroundColor: OTHER_ENDPOINT_BACKGROUND,
            }}
          />
          {t("observations.otherEndpoints")}
          <strong className="font-semibold tabular-nums text-foreground">
            {gibValue(otherMiB)} GiB {t("observations.reservedLower")}
          </strong>
        </span>
      )}
      {unallocatedMiB > 0 && (
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2 rounded-sm border border-[var(--nt-stroke-neutral-trans-3)] bg-[var(--nt-fill-neutral-opaque-2)]"
          />
          {t("observations.unallocated")}
          <strong className="font-semibold tabular-nums text-foreground">
            {gibValue(unallocatedMiB)} GiB
          </strong>
        </span>
      )}
    </div>
  );
}

function AllocationBar({
  device,
  identity,
  samples,
  otherReservedMiB,
  activeReplicaKey,
  selectedReplicaKey,
  onHoverReplica,
  onSelectReplica,
}: {
  device: EndpointGpuResourceGroup;
  identity: Identity;
  samples: AcceleratorSample[];
  otherReservedMiB: number;
  activeReplicaKey: string | null;
  selectedReplicaKey: string | null;
  onHoverReplica: (key: string | null) => void;
  onSelectReplica: (key: string | null) => void;
}) {
  const { t } = useTranslation();
  const visible = device.allocations.slice(0, CHART_CATEGORY_COUNT);
  const hidden = device.allocations.slice(CHART_CATEGORY_COUNT);
  const hiddenMemory = hidden.reduce(
    (sum, allocation) => sum + allocation.memoryMiB,
    0,
  );
  const physical = device.physicalMemoryMiB;
  if (physical == null || physical <= 0) {
    return (
      <div className="space-y-1">
        <div
          role="img"
          aria-label={t("observations.physicalVramUnavailable")}
          className="h-4 rounded-full border border-dashed border-[var(--nt-stroke-neutral-trans-3)] bg-transparent"
          data-testid="endpoint-physical-vram-unavailable"
        />
        <span className="text-[11px] text-muted-foreground">
          {t("observations.physicalVramUnavailable")}
        </span>
      </div>
    );
  }
  const otherWidth = physical > 0 ? (otherReservedMiB / physical) * 100 : 0;
  const endpointReservedMiB = device.allocations.reduce(
    (sum, allocation) => sum + allocation.memoryMiB,
    0,
  );
  const unallocatedMiB = Math.max(
    0,
    physical - endpointReservedMiB - otherReservedMiB,
  );
  const singleAllocation =
    visible.length === 1 && hidden.length === 0 && otherReservedMiB <= 0
      ? visible[0]
      : null;

  if (singleAllocation) {
    const mark = chartCategoryMark(singleAllocation.replicaIndex);
    const actual = reading(
      samples,
      "neutree_endpoint_replica_accelerator_memory_used_bytes",
      singleAllocation.nodeId,
      singleAllocation.uuid,
      toAllocation(singleAllocation, identity),
    );
    const actualMiB = actual ? actual.value / 1024 ** 2 : null;
    const hasComposition = singleAllocation.modelWeightsMiB != null;
    const markerLimit = physical / singleAllocation.memoryMiB;
    const actualFillPercent =
      actualMiB == null
        ? 0
        : Math.min(100, (actualMiB / singleAllocation.memoryMiB) * 100);
    const actualExceedsReserved =
      actualMiB != null && actualMiB > singleAllocation.memoryMiB;

    const segment = (
      <>
        {hasComposition ? (
          <ReplicaSegmentComposition
            allocation={singleAllocation}
            mark={mark}
          />
        ) : (
          <>
            <span
              aria-hidden="true"
              className="absolute inset-0"
              style={{
                backgroundColor: ownerTone(mark.color, OWNER_SECONDARY_TONE),
              }}
            />
            {actualMiB != null && (
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0"
                data-testid="endpoint-actual-fill"
                style={{
                  width: `${actualFillPercent}%`,
                  backgroundColor: mark.color,
                }}
              />
            )}
          </>
        )}
        {actualMiB != null && (
          <span
            aria-hidden="true"
            className="absolute -bottom-0.5 -top-0.5 z-10 w-0.5 shadow-[0_0_0_1px_var(--nt-fill-neutral-white)]"
            data-testid="single-actual-marker"
            style={{
              left: `${Math.min(
                markerLimit * 100,
                (actualMiB / singleAllocation.memoryMiB) * 100,
              )}%`,
              backgroundColor: actualExceedsReserved
                ? "var(--nt-fill-serious-base)"
                : "var(--nt-text-neutral-super)",
            }}
          />
        )}
      </>
    );
    const segmentStyle = {
      width: `${(singleAllocation.memoryMiB / physical) * 100}%`,
    };

    return (
      <div className="relative">
        <div
          aria-label={t("observations.vramAllocation")}
          className="flex h-4 overflow-hidden rounded-full bg-[var(--nt-fill-neutral-opaque-2)] shadow-[inset_0_0_0_1px_var(--nt-stroke-neutral-trans-3)]"
          role="group"
        >
          <span
            className="relative min-w-0 shrink-0"
            data-testid="single-replica-composition"
            style={segmentStyle}
          >
            {segment}
          </span>
          {otherReservedMiB > 0 && (
            <span
              aria-label={`${t("observations.otherEndpoints")}, ${formatMiBAsGiB(otherReservedMiB)} ${t("observations.reservedLower")}`}
              className="flex shrink-0 items-center justify-center text-[10px] font-semibold text-foreground"
              data-testid="other-endpoints-segment"
              role="img"
              style={{
                ...chartMarkStyle(chartMoreMark()),
                backgroundColor: OTHER_ENDPOINT_BACKGROUND,
                width: `${otherWidth}%`,
                boxShadow: `inset 1px 0 0 ${CHART_SERIES_SEPARATOR}`,
              }}
            >
              {t("observations.otherMemory")}
            </span>
          )}
          {unallocatedMiB > 0 && (
            <span
              aria-label={`${t("observations.unallocated")}, ${formatMiBAsGiB(unallocatedMiB)}`}
              className="min-w-0 flex-1"
              data-testid="unallocated-vram-segment"
              role="img"
            />
          )}
        </div>
        <AllocationOwnershipLegend
          actualMiB={actualMiB}
          allocations={[singleAllocation]}
          endpointMiB={endpointReservedMiB}
          mark={mark}
          otherMiB={otherReservedMiB}
          showEndpointComposition
          unallocatedMiB={unallocatedMiB}
        />
        <AllocationCompositionLegend
          allocation={singleAllocation}
          actualMiB={actualMiB}
          mark={mark}
        />
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        aria-label={t("observations.vramAllocation")}
        className="flex h-4 overflow-hidden rounded-full bg-[var(--nt-fill-neutral-opaque-2)] shadow-[inset_0_0_0_1px_var(--nt-stroke-neutral-trans-3)]"
        role="group"
      >
        {visible.map((allocation, allocationIndex) => {
          const mark = chartCategoryMark(allocation.replicaIndex);
          const active =
            activeReplicaKey == null ||
            activeReplicaKey === allocation.replicaKey;
          const actual = reading(
            samples,
            "neutree_endpoint_replica_accelerator_memory_used_bytes",
            allocation.nodeId,
            allocation.uuid,
            toAllocation(allocation, identity),
          );
          const actualMiB = actual ? actual.value / 1024 ** 2 : null;
          const hasComposition = allocation.modelWeightsMiB != null;
          const actualFillPercent =
            actualMiB == null
              ? 0
              : Math.min(100, (actualMiB / allocation.memoryMiB) * 100);
          const actualExceedsReserved =
            actualMiB != null && actualMiB > allocation.memoryMiB;
          const usesLightSeries =
            allocation.replicaIndex === 1 ||
            allocation.replicaIndex === 2 ||
            allocation.replicaIndex === 6;
          const useDarkReplicaLabel = usesLightSeries;
          return (
            <Tooltip
              key={allocation.replicaKey}
              onOpenChange={(open) => {
                onHoverReplica(open ? allocation.replicaKey : null);
              }}
            >
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={`${t("observations.replicaLabel")} ${replicaCode(allocation.replicaIndex)}, ${gib(allocation.memoryMiB)} ${t("observations.reservedVram")}`}
                  aria-pressed={selectedReplicaKey === allocation.replicaKey}
                  className={cn(
                    "group/slice relative flex min-w-0 shrink-0 items-center justify-center overflow-hidden text-[9px] font-semibold tabular-nums transition-opacity focus-visible:z-10 focus-visible:[outline:2px_solid_var(--nt-stroke-outstanding-base)] focus-visible:[outline-offset:2px]",
                    !active && "opacity-30",
                    useDarkReplicaLabel
                      ? usesLightSeries
                        ? "text-[var(--nt-text-neutral-primary)] dark:text-[#132033]"
                        : "text-[var(--nt-text-neutral-primary)]"
                      : "text-white",
                  )}
                  style={{
                    ...chartMarkStyle(mark),
                    width: `${(allocation.memoryMiB / physical) * 100}%`,
                    boxShadow:
                      allocationIndex === 0
                        ? undefined
                        : `inset 1px 0 0 ${CHART_SERIES_SEPARATOR}`,
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectReplica(
                      selectedReplicaKey === allocation.replicaKey
                        ? null
                        : allocation.replicaKey,
                    );
                  }}
                >
                  <span
                    className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover/slice:opacity-100 group-focus-visible/slice:opacity-100 group-data-[state=delayed-open]/slice:opacity-100 group-data-[state=instant-open]/slice:opacity-100"
                    data-testid="replica-detail-layer"
                  >
                    {hasComposition ? (
                      <ReplicaSegmentComposition
                        allocation={allocation}
                        mark={mark}
                      />
                    ) : (
                      <>
                        <span
                          aria-hidden="true"
                          className="absolute inset-0"
                          style={{
                            backgroundColor: ownerTone(
                              mark.color,
                              OWNER_SECONDARY_TONE,
                            ),
                          }}
                        />
                        {actualMiB != null && (
                          <span
                            aria-hidden="true"
                            className="absolute inset-y-0 left-0"
                            data-testid="replica-actual-fill"
                            style={{
                              width: `${actualFillPercent}%`,
                              backgroundColor: mark.color,
                            }}
                          />
                        )}
                      </>
                    )}
                    {actualMiB != null && (
                      <span
                        aria-hidden="true"
                        className="absolute -bottom-0.5 -top-0.5 z-10 w-0.5 shadow-[0_0_0_1px_var(--nt-fill-neutral-white)]"
                        data-testid="replica-actual-marker"
                        style={{
                          left: `${Math.min(100, (actualMiB / allocation.memoryMiB) * 100)}%`,
                          backgroundColor: actualExceedsReserved
                            ? "var(--nt-fill-serious-base)"
                            : "var(--nt-text-neutral-super)",
                        }}
                      />
                    )}
                  </span>
                  <span className="relative z-10 truncate px-1">
                    {replicaCode(allocation.replicaIndex)}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent
                className="max-w-none p-3"
                side="top"
                sideOffset={8}
              >
                <AllocationTooltip
                  allocation={allocation}
                  actualMiB={actualMiB}
                  deviceLabel={`${t("clusters.fields.gpuNumber")} ${device.order ?? "-"}`}
                  mark={mark}
                />
              </TooltipContent>
            </Tooltip>
          );
        })}
        {hidden.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={t("observations.moreReplicasLabel", {
                  count: hidden.length,
                  memory: gib(hiddenMemory),
                })}
                className="flex min-w-0 shrink-0 items-center justify-center overflow-hidden border-0 p-0 text-[10px] font-semibold text-[var(--nt-chart-more-foreground)]"
                onPointerDown={(event) => event.stopPropagation()}
                style={{
                  ...chartMarkStyle(chartMoreMark()),
                  width: `${(hiddenMemory / physical) * 100}%`,
                  boxShadow: `inset 1px 0 0 ${CHART_SERIES_SEPARATOR}`,
                }}
              >
                <span className="truncate px-1">+{hidden.length}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs p-3" side="top" sideOffset={8}>
              <p className="text-xs font-semibold">
                {t("observations.moreReplicas")}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t("observations.moreReplicasLabel", {
                  count: hidden.length,
                  memory: gib(hiddenMemory),
                })}
              </p>
            </TooltipContent>
          </Tooltip>
        )}
        {otherReservedMiB > 0 && (
          <span
            aria-label={`${t("observations.otherEndpoints")}, ${formatMiBAsGiB(otherReservedMiB)} ${t("observations.reservedLower")}`}
            className="flex min-w-0 shrink-0 items-center justify-center truncate px-1 text-[10px] font-semibold text-[var(--nt-text-neutral-primary)]"
            data-testid="other-endpoints-segment"
            role="img"
            style={{
              ...chartMarkStyle(chartMoreMark()),
              backgroundColor: OTHER_ENDPOINT_BACKGROUND,
              width: `${otherWidth}%`,
              boxShadow: `inset 1px 0 0 ${CHART_SERIES_SEPARATOR}`,
            }}
          >
            {t("observations.otherMemory")}
          </span>
        )}
        {unallocatedMiB > 0 && (
          <span
            aria-label={`${t("observations.unallocated")}, ${formatMiBAsGiB(unallocatedMiB)}`}
            className="min-w-0 flex-1"
            data-testid="unallocated-vram-segment"
            role="img"
          />
        )}
      </div>
      <AllocationOwnershipLegend
        actualMiB={null}
        allocations={device.allocations}
        endpointMiB={endpointReservedMiB}
        mark={chartCategoryMark(0)}
        otherMiB={otherReservedMiB}
        showEndpointComposition={false}
        unallocatedMiB={unallocatedMiB}
      />
    </div>
  );
}

function AllocationCompositionLegend({
  allocation,
  actualMiB,
  mark,
}: {
  allocation: EndpointGpuResourceAllocation;
  actualMiB: number | null;
  mark: ReturnType<typeof chartCategoryMark>;
}) {
  const { t } = useTranslation();
  const weights = allocation.modelWeightsMiB;
  const cache = allocation.kvCacheCapacityMiB;
  const other =
    weights == null
      ? null
      : Math.max(0, allocation.memoryMiB - weights - (cache ?? 0));

  if (weights == null) {
    if (actualMiB == null) return null;
    const unused = Math.max(0, allocation.memoryMiB - actualMiB);
    const exceedsReserved = actualMiB > allocation.memoryMiB;

    return (
      <div
        className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] leading-4 text-muted-foreground"
        data-testid="single-allocation-legend"
      >
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-3 w-0.5 shrink-0 rounded-full shadow-[0_0_0_1px_var(--nt-fill-neutral-white)]"
            style={{
              backgroundColor: exceedsReserved
                ? "var(--nt-fill-serious-base)"
                : "var(--nt-text-neutral-super)",
            }}
          />
          <span>{t("observations.actualVramUsage")}</span>
          <strong className="whitespace-nowrap font-semibold tabular-nums text-foreground">
            {gibValue(actualMiB)} GiB
          </strong>
        </span>
        {unused > 0 && (
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-sm"
              style={{
                backgroundColor: ownerTone(mark.color, OWNER_SECONDARY_TONE),
              }}
            />
            <span>{t("observations.allocatedUnused")}</span>
            <strong className="whitespace-nowrap font-semibold tabular-nums text-foreground">
              {gibValue(unused)} GiB
            </strong>
          </span>
        )}
        {exceedsReserved && (
          <span className="inline-flex min-w-0 items-center gap-1.5 text-[var(--nt-text-colorful-serious)]">
            {t("observations.exceedsReservedBy", {
              memory: gib(actualMiB - allocation.memoryMiB),
            })}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] leading-4 text-muted-foreground"
      data-testid="single-allocation-legend"
    >
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <span
          aria-hidden="true"
          className={cn(
            "size-2 shrink-0 rounded-sm",
            weights == null && "bg-[var(--nt-fill-neutral-trans-3)]",
          )}
          style={
            weights == null
              ? undefined
              : {
                  backgroundColor: ownerTone(mark.color, OWNER_WEIGHTS_TONE),
                }
          }
        />
        <span>{t("observations.modelWeights")}</span>
        <strong className="whitespace-nowrap font-semibold tabular-nums text-foreground">
          {weights == null ? <EmptyValue /> : `${gibValue(weights)} GiB`}
        </strong>
      </span>
      {cache != null && (
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-sm"
            style={{
              backgroundColor: "var(--nt-fill-neutral-white)",
              backgroundImage: l0Pattern(mark.color),
            }}
          />
          <span>{t("observations.l0KvCacheCapacity")}</span>
          <strong className="whitespace-nowrap font-semibold tabular-nums text-foreground">
            {gibValue(cache)} GiB
          </strong>
        </span>
      )}
      {other != null && other > 0 && (
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-sm"
            style={{
              backgroundColor: ownerTone(mark.color, OWNER_SECONDARY_TONE),
            }}
          />
          <span>{t("observations.otherReservation")}</span>
          <strong className="whitespace-nowrap font-semibold tabular-nums text-foreground">
            {gibValue(other)} GiB
          </strong>
        </span>
      )}
      {actualMiB != null && (
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-3 w-0.5 shrink-0 rounded-full shadow-[0_0_0_1px_var(--nt-fill-neutral-white)]"
            style={{
              backgroundColor:
                actualMiB > allocation.memoryMiB
                  ? "var(--nt-fill-serious-base)"
                  : "var(--nt-text-neutral-super)",
            }}
          />
          <span>{t("observations.actualVramUsage")}</span>
          <strong className="whitespace-nowrap font-semibold tabular-nums text-foreground">
            {gibValue(actualMiB)} GiB
          </strong>
        </span>
      )}
      {actualMiB != null && actualMiB > allocation.memoryMiB && (
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[var(--nt-text-colorful-serious)]">
          {t("observations.exceedsReservedBy", {
            memory: gib(actualMiB - allocation.memoryMiB),
          })}
        </span>
      )}
    </div>
  );
}

function GpuResourceCard({
  device,
  index,
  healthy,
  showProduct,
  clusterResourceInfo,
  identity,
  samples,
  requestedCorePerCard,
  tflopsOverrides,
  observationStatus,
  onRetry,
  activeReplicaKey,
  selectedReplicaKey,
  onHoverReplica,
  onSelectReplica,
  gpuAllocations,
  deviceSamples,
  deviceObservationStatus,
  onDeviceObservationRetry,
}: {
  device: EndpointGpuResourceGroup;
  index: number;
  healthy: boolean | undefined;
  showProduct: boolean;
  clusterResourceInfo?: ClusterResourceInfo | null;
  identity: Identity;
  samples: AcceleratorSample[];
  requestedCorePerCard?: number;
  tflopsOverrides: Record<string, number>;
  observationStatus?: string;
  onRetry?: () => void;
  activeReplicaKey: string | null;
  selectedReplicaKey: string | null;
  onHoverReplica: (key: string | null) => void;
  onSelectReplica: (key: string | null) => void;
  gpuAllocations: GpuAllocation[];
  deviceSamples?: AcceleratorSample[];
  deviceObservationStatus?: string;
  onDeviceObservationRetry?: () => void;
}) {
  const { t } = useTranslation();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const physicalMiB = device.physicalMemoryMiB;
  const endpointUtilizationValue = endpointUtilization(
    device,
    samples,
    identity,
  );
  const reservedMiB = device.allocations.reduce(
    (sum, allocation) => sum + allocation.memoryMiB,
    0,
  );
  const endpointAllocations = device.allocations.map((allocation) =>
    toAllocation(allocation, identity),
  );
  const allocations = gpuAllocations.filter(
    (allocation) =>
      allocation.node === device.nodeId && allocation.uuid === device.uuid,
  );
  const otherAllocations = allocations.filter(
    (allocation) =>
      allocation.workspace !== identity.workspace ||
      allocation.endpoint !== identity.endpointName,
  );
  const otherReservedMiB = otherAllocations.reduce(
    (sum, allocation) => sum + allocation.memoryMiB,
    0,
  );
  const cardAllocations =
    allocations.length > 0 ? allocations : endpointAllocations;
  const allocatedMiB = cardAllocations.reduce(
    (sum, allocation) => sum + allocation.memoryMiB,
    0,
  );
  const allocatedCoreUnits = cardAllocations.reduce(
    (sum, allocation) => sum + (allocation.coreUnits ?? 0),
    0,
  );
  const endpointCoreUnits = endpointAllocations.reduce(
    (sum, allocation) => sum + (allocation.coreUnits ?? 0),
    0,
  );
  const computeCoreUnits = endpointAllocations.some(
    (allocation) => (allocation.coreUnits ?? 0) > 0,
  )
    ? endpointCoreUnits
    : (requestedCorePerCard ??
      (endpointAllocations.length > 0 ? endpointCoreUnits : null));
  const observedGpu = {
    node: device.nodeId,
    uuid: device.uuid,
    index,
    product: device.product,
    totalMiB: physicalMiB,
    allocatedMiB,
    coreUnits: allocatedCoreUnits || requestedCorePerCard,
    healthy,
    peakFP16TFLOPS: productPeakTflops(clusterResourceInfo, device.product),
  };
  const detailsSamples = deviceSamples?.length
    ? [...samples, ...deviceSamples]
    : samples;
  const detailsStatus = deviceSamples?.length
    ? deviceObservationStatus
    : observationStatus;
  return (
    <section
      data-testid="runtime-gpu-card"
      className="relative min-w-0 cursor-pointer rounded-md border border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-white)] p-3 transition-colors hover:border-[var(--nt-stroke-outstanding-light)] hover:bg-[var(--nt-fill-outstanding-thin)]"
      onPointerDown={(event) => {
        if (
          event.button !== 0 ||
          !(event.target instanceof Node) ||
          !event.currentTarget.contains(event.target)
        ) {
          return;
        }
        setDetailsOpen(true);
      }}
    >
      <button
        type="button"
        aria-label={t("observations.detailsForGpu", { index })}
        className="pointer-events-none absolute inset-0 rounded-[inherit] outline-none focus-visible:[box-shadow:inset_0_0_0_2px_var(--nt-stroke-outstanding-base)]"
        onClick={() => setDetailsOpen(true)}
      />
      <div className="flex min-w-0 items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold leading-5">
              {t("clusters.fields.gpuNumber")} {index}
            </span>
            {healthy != null && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-xs",
                  healthy
                    ? "text-[var(--nt-text-colorful-positive)]"
                    : "text-[var(--nt-text-colorful-serious)]",
                )}
              >
                <span className="size-1.5 rounded-full border border-current" />
                {t(
                  healthy
                    ? "clusters.options.healthy"
                    : "clusters.options.unhealthy",
                )}
              </span>
            )}
            <CopyUuidButton index={index} uuid={device.uuid} />
          </div>
          {showProduct && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {device.product}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-baseline justify-between gap-3 text-[11px] leading-4">
          <span className="text-muted-foreground">
            {t("observations.vramAllocation")}
          </span>
          <span className="shrink-0 whitespace-nowrap font-semibold tabular-nums">
            {t("observations.reservedOfPhysical", {
              reserved: formatMiBAsGiBValue(reservedMiB) ?? "—",
              total: formatMiBAsGiBValue(physicalMiB) ?? "—",
            })}
          </span>
        </div>
        <div className="mt-1">
          <AllocationBar
            activeReplicaKey={activeReplicaKey}
            device={device}
            identity={identity}
            onHoverReplica={onHoverReplica}
            onSelectReplica={onSelectReplica}
            otherReservedMiB={otherReservedMiB}
            samples={samples}
            selectedReplicaKey={selectedReplicaKey}
          />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 border-t border-[var(--nt-stroke-neutral-trans-2)] pt-2.5 text-[11px] leading-4 sm:grid-cols-2">
        {computeCoreUnits != null && (
          <div className="flex min-w-0 items-center justify-between gap-3">
            <span className="shrink-0 text-muted-foreground">
              {t("observations.computeAllocation")}
            </span>
            <strong className="truncate whitespace-nowrap font-semibold tabular-nums">
              {computeCoreUnits === 0
                ? t("observations.sharedNoLimit")
                : t("observations.coreAllocation", {
                    count: computeCoreUnits,
                  })}
            </strong>
          </div>
        )}
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-muted-foreground">
            {t("observations.utilization")}
          </span>
          <MetricBar
            aria-label={t("observations.utilization")}
            className="min-w-10 flex-1"
            series="teal"
            size="sm"
            track={
              endpointUtilizationValue != null ? "outlined" : "unavailable"
            }
            value={
              endpointUtilizationValue != null
                ? endpointUtilizationValue * 100
                : null
            }
          />
          <strong className="min-w-8 text-right font-semibold tabular-nums">
            {endpointUtilizationValue != null ? (
              `${(endpointUtilizationValue * 100).toFixed(0)}%`
            ) : (
              <EmptyValue />
            )}
          </strong>
        </div>
      </div>

      <GpuDetailsSheet
        assigned={cardAllocations}
        device={observedGpu}
        observationStatus={detailsStatus}
        onOpenChange={setDetailsOpen}
        onRetry={onDeviceObservationRetry ?? onRetry}
        open={detailsOpen}
        samples={detailsSamples}
        tflopsOverrides={tflopsOverrides}
      />
    </section>
  );
}

function ReplicaIndex({
  group,
  groupIndex,
  active,
  selected,
  onHover,
  onSelect,
}: {
  group: EndpointReplicaResourceGroup;
  groupIndex: number;
  active: boolean;
  selected: boolean;
  onHover: (key: string | null) => void;
  onSelect: (key: string | null) => void;
}) {
  const { t } = useTranslation();
  const key = `${group.instanceId}\u0000${group.replicaId || groupIndex}`;
  const mark = chartCategoryMark(groupIndex);
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 rounded px-2 py-1.5 text-left transition-colors",
        active && "bg-[var(--nt-fill-outstanding-light)]",
      )}
      onClick={() => onSelect(selected ? null : key)}
      onBlur={() => onHover(null)}
      onFocus={() => onHover(key)}
      onMouseEnter={() => onHover(key)}
      onMouseLeave={() => onHover(null)}
    >
      <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold">
        <span
          className="size-2 shrink-0 rounded-[2px]"
          style={chartMarkStyle(mark)}
        />
        {t("observations.replicaLabel")} {replicaCode(groupIndex)}
      </span>
      <span className="whitespace-nowrap text-[11px] tabular-nums text-muted-foreground">
        {gibValue(group.memoryMiB)} GiB
      </span>
      <span className="col-span-2 truncate text-[11px] text-muted-foreground">
        {formatCount(
          group.deviceCount,
          "endpoints.fields.card",
          "endpoints.fields.cards",
          t,
        )}{" "}
        ·{" "}
        {formatCount(
          group.nodeCount,
          "endpoints.fields.node",
          "endpoints.fields.nodes",
          t,
        )}
      </span>
    </button>
  );
}

function fallbackSummary(
  resources: EndpointResourceStatus | null | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  return getEndpointResourceSummaryRows(resources).map((row) => (
    <div
      className="grid gap-4 border-b border-[var(--nt-stroke-neutral-trans-2)] px-4 py-2 text-sm last:border-b-0 md:grid-cols-3"
      key={row.product}
    >
      <span className="truncate font-semibold">{row.product}</span>
      <span>{formatMemoryGiB(row.memoryMiB)}</span>
      <span>
        {row.coreUnits > 0
          ? t("observations.coreAllocation", { count: row.coreUnits })
          : t("observations.sharedNoLimit")}
      </span>
    </div>
  ));
}

export default function EndpointRuntimeResourcesCard({
  resources,
  requestedResources,
  clusterResourceInfo,
  className,
  l1CacheByNode,
  samples = [],
  deviceSamples = [],
  observationStatus = "",
  deviceObservationStatus = "",
  onObservationRetry,
  onDeviceObservationRetry,
  tflopsOverrides = {},
  endpointName = "",
  workspace = "default",
  modelName = "",
  gpuAllocations = [],
}: Props) {
  const { t } = useTranslation();
  const [selectedReplicaKey, setSelectedReplicaKey] = useState<string | null>(
    null,
  );
  const [hoveredReplicaKey, setHoveredReplicaKey] = useState<string | null>(
    null,
  );
  const activeReplicaKey = hoveredReplicaKey ?? selectedReplicaKey;
  const acceleratorType = requestedResources?.accelerator?.type;
  const requestedCorePerCard =
    getVgpuVirtualization(requestedResources?.accelerator)?.core_percent ??
    undefined;
  const replicaGroups = getEndpointReplicaResourceGroups(resources, {
    clusterResourceInfo,
    acceleratorType,
  });
  const devices = getEndpointGpuResourceGroups(resources, {
    clusterResourceInfo,
    acceleratorType,
  });
  const nodes = nodeGroups(devices);
  const identity = { endpointName, workspace, modelName };
  const requestedCpu = formatToDecimal(requestedResources?.cpu) ?? (
    <EmptyValue />
  );
  const requestedMemory = formatToDecimal(requestedResources?.memory) ?? (
    <EmptyValue />
  );
  const summaryRows = getEndpointResourceSummaryRows(resources);
  const allocatedDeviceCount = devices.length;
  const showAggregate = allocatedDeviceCount > 1;
  const showReplicaIndex = replicaGroups.some(
    (group) => group.deviceCount > 1 || group.nodeCount > 1,
  );
  const observedAge = latestSampleAge(samples);

  if (summaryRows.length === 0 && replicaGroups.length === 0) return null;

  return (
    <TooltipProvider delayDuration={120} skipDelayDuration={200}>
      <Section
        className={className}
        contentClassName="p-0"
        data-testid="runtime-resources-card"
        title={t("endpoints.sections.runtimeAllocation")}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
            {observationStatus === "ok" && observedAge && (
              <span className="text-[11px] text-muted-foreground">
                {t("observations.updatedAgo", { age: observedAge })}
              </span>
            )}
            <EndpointRuntimeResourcesSummary resources={resources} />
          </div>
        }
      >
        <ObservationStatus status={observationStatus} />
        {replicaGroups.length === 0 ? (
          <div data-testid="runtime-resource-summary">
            {fallbackSummary(resources, t)}
          </div>
        ) : (
          <>
            {showAggregate && (
              <div
                className="mt-3 grid border-y border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-trans-1)] sm:grid-cols-2 xl:grid-cols-4"
                data-testid="runtime-summary"
              >
                <AggregateStat
                  label={t("observations.reservedVram")}
                  value={formatMemoryGiB(
                    replicaGroups.reduce(
                      (sum, group) => sum + group.memoryMiB,
                      0,
                    ),
                  )}
                />
                <AggregateStat
                  label={t("observations.vramInUse")}
                  value={gib(
                    measuredEndpointMemory(devices, samples, identity),
                  )}
                />
                <AggregateStat
                  label={t("observations.utilization")}
                  value={formatObservedUtilization(devices, samples, identity)}
                />
                {replicaGroups.some(
                  (group) => group.kvCacheCapacityMiB != null,
                ) && (
                  <AggregateStat
                    label={t("observations.l0KvCache")}
                    value={formatMemoryGiB(
                      replicaGroups.reduce(
                        (sum, group) =>
                          sum +
                          (group.kvCacheCapacityMiB == null
                            ? 0
                            : group.kvCacheCapacityMiB * group.deviceCount),
                        0,
                      ),
                    )}
                  />
                )}
              </div>
            )}
            <div
              className={cn(
                "grid",
                nodes.length > 1 && "gap-2 p-2 md:grid-cols-2",
              )}
            >
              {nodes.map((node) => (
                <section
                  className={cn(
                    "min-w-0",
                    nodes.length > 1
                      ? "rounded-md border border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-trans-1)] p-2 pl-[11px]"
                      : "px-5 py-4",
                  )}
                  data-testid="runtime-node"
                  key={node.nodeId}
                >
                  <div className="mb-2 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold">
                      <Server className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate" title={node.nodeId}>
                        {node.nodeId || <EmptyValue />}
                      </span>
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {node.devices[0]?.product}
                    </span>
                  </div>
                  <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span>
                      {t("common.fields.cpu")} {requestedCpu} ·{" "}
                      {t("common.fields.memory")} {requestedMemory} GiB
                    </span>
                    {l1CacheByNode?.[node.nodeId] && (
                      <span>
                        {t("observations.l1KvCache")}{" "}
                        {formatL1CacheUsage(l1CacheByNode[node.nodeId])}
                      </span>
                    )}
                  </div>
                  <div
                    className="grid gap-2"
                    style={{
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(min(420px, 100%), 1fr))",
                    }}
                  >
                    {node.devices.map((device, deviceIndex) => {
                      const clusterDevice =
                        clusterResourceInfo?.node_resources?.[
                          node.nodeId
                        ]?.devices?.find(
                          (candidate) => candidate.uuid === device.uuid,
                        );
                      return (
                        <GpuResourceCard
                          activeReplicaKey={activeReplicaKey}
                          clusterResourceInfo={clusterResourceInfo}
                          device={device}
                          healthy={clusterDevice?.health}
                          identity={identity}
                          index={device.order ?? deviceIndex + 1}
                          key={device.key}
                          observationStatus={observationStatus}
                          onHoverReplica={setHoveredReplicaKey}
                          onRetry={onObservationRetry}
                          onSelectReplica={setSelectedReplicaKey}
                          gpuAllocations={gpuAllocations}
                          deviceSamples={deviceSamples}
                          deviceObservationStatus={deviceObservationStatus}
                          onDeviceObservationRetry={onDeviceObservationRetry}
                          requestedCorePerCard={requestedCorePerCard}
                          samples={samples}
                          selectedReplicaKey={selectedReplicaKey}
                          showProduct={
                            new Set(
                              node.devices.map(
                                (candidate) => candidate.product,
                              ),
                            ).size > 1
                          }
                          tflopsOverrides={tflopsOverrides}
                        />
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
            {showReplicaIndex && (
              <div className="grid grid-cols-2 border-t border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-trans-1)] p-2 md:grid-cols-3 xl:grid-cols-4">
                {replicaGroups.map((group, groupIndex) => {
                  const key = `${group.instanceId}\u0000${group.replicaId || groupIndex}`;
                  return (
                    <ReplicaIndex
                      active={activeReplicaKey === key}
                      group={group}
                      groupIndex={groupIndex}
                      key={key}
                      onHover={setHoveredReplicaKey}
                      onSelect={setSelectedReplicaKey}
                      selected={selectedReplicaKey === key}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}
      </Section>
    </TooltipProvider>
  );
}
