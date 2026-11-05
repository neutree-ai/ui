import {
  ArrowUpRight,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Copy,
} from "lucide-react";
import { useRef, useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmptyValue } from "@/foundation/components/EmptyValue";
import { MetricBar } from "@/foundation/components/MetricBar";
import { useCopyToClipboard } from "@/foundation/hooks/use-copy-to-clipboard";
import { useIsTruncated } from "@/foundation/hooks/use-is-truncated";
import { extraHardwareFields } from "@/foundation/lib/accelerator-extra-info";
import {
  type AcceleratorSample,
  allocationColor,
  assignAllocationColors,
  deviceHardwareInfo,
  type EndpointGpuAllocation,
  endpointAllocationUsedMiB,
  type GpuAllocation,
  type ObservedGpu,
  reading,
  splitGpuEndpointAllocations,
} from "@/foundation/lib/accelerator-observations";
import { peakTflops } from "@/foundation/lib/accelerator-tflops";
import { chartOutlineStyle } from "@/foundation/lib/chart-palette";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";

type GpuObservationVariant = "inventory" | "allocation";
export type GpuObservationDisplay = "table" | "cards";

type Props = {
  device: ObservedGpu;
  samples: AcceleratorSample[];
  allocations: GpuAllocation[];
  replica?: GpuAllocation;
  tflopsOverrides?: Record<string, number>;
  variant?: GpuObservationVariant;
  display?: GpuObservationDisplay;
  showProduct?: boolean;
  /** observationStatus() value for the samples this card renders. */
  observationStatus?: string;
  /** Refetch for the samples; when absent no Retry affordance is offered. */
  onRetry?: () => void;
};

const INVENTORY_GRID =
  "grid min-w-[860px] grid-cols-[minmax(180px,1.15fr)_86px_minmax(280px,1.8fr)_minmax(190px,1.3fr)_76px] items-center gap-3 px-4";
const ALLOCATION_GRID =
  "grid min-w-[820px] grid-cols-[minmax(150px,1.1fr)_130px_minmax(190px,1.2fr)_120px_90px_76px] items-center gap-3 px-4";
const GPU_BAR_TRACK_CLASS =
  "relative rounded-full border border-[var(--nt-stroke-neutral-trans-3)] bg-[var(--nt-fill-neutral-opaque-2)]";

const gib = (mib: number | null | undefined) =>
  mib == null ? "—" : `${(mib / 1024).toFixed(1)} GiB`;
const gibValue = (mib: number | null | undefined) =>
  mib == null ? "—" : (mib / 1024).toFixed(1);
const ratio = (
  value: number | null | undefined,
  total: number | null | undefined,
) =>
  value == null || !total
    ? 0
    : Math.max(0, Math.min(100, (value / total) * 100));

export function ObservationStatus({ status }: { status: string }) {
  const { t } = useTranslation();
  if (status !== "unavailable" && status !== "not_configured") return null;
  return (
    <p role="status" className="mb-3 text-xs text-muted-foreground">
      {t(`observations.status.${status}`)}
    </p>
  );
}

export function GpuObservationTableHeader({
  variant = "allocation",
}: {
  variant?: GpuObservationVariant;
}) {
  const { t } = useTranslation();
  const labels =
    variant === "inventory"
      ? [
          t("clusters.fields.gpuNumber"),
          t("clusters.fields.health"),
          t("observations.vramAllocation"),
          t("observations.utilization"),
          "",
        ]
      : [
          t("observations.deviceAndHealth"),
          t("observations.vramInUse"),
          t("observations.memoryBreakdown"),
          t("observations.utilization"),
          t("observations.computeShare"),
          "",
        ];

  return (
    <div
      className={cn(
        variant === "inventory" ? INVENTORY_GRID : ALLOCATION_GRID,
        "border-b border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-trans-2)] py-2 text-[11px] font-medium uppercase leading-4 tracking-wide text-muted-foreground",
      )}
    >
      {labels.map((label, index) => (
        <span
          // The final column is an unlabeled action column.
          key={`${label}:${index}`}
          className="min-w-0 truncate"
        >
          {label}
        </span>
      ))}
    </div>
  );
}

type Readings = {
  total: number | null;
  actual: number | null;
  utilization: AcceleratorSample | undefined;
  temperature: AcceleratorSample | undefined;
  power: AcceleratorSample | undefined;
  hardware: Record<string, string>;
};

function getReadings(
  device: ObservedGpu,
  samples: AcceleratorSample[],
  replica?: GpuAllocation,
): Readings {
  const getScoped = (name: string) =>
    reading(samples, name, device.node, device.uuid, replica);
  const getDevice = (name: string) =>
    reading(samples, name, device.node, device.uuid);
  const used = getScoped(
    replica
      ? "neutree_endpoint_replica_accelerator_memory_used_bytes"
      : "neutree_accelerator_memory_used_bytes",
  );
  const physical = getDevice("neutree_accelerator_memory_total_bytes");
  const hardware = deviceHardwareInfo(samples, device.node, device.uuid);

  return {
    total: physical ? physical.value / 1024 ** 2 : device.totalMiB,
    actual: used ? used.value / 1024 ** 2 : null,
    utilization: getScoped(
      replica
        ? "neutree_endpoint_replica_accelerator_utilization_ratio"
        : "neutree_accelerator_utilization_ratio",
    ),
    temperature: getDevice("neutree_accelerator_temperature_celsius"),
    power: getDevice("neutree_accelerator_power_usage_watts"),
    hardware,
  };
}

function DeviceProduct({ device }: { device: ObservedGpu }) {
  const productRef = useRef<HTMLSpanElement>(null);
  const truncated = useIsTruncated(productRef);
  const label = (
    <span
      ref={productRef}
      data-testid="gpu-observation-product"
      tabIndex={truncated ? 0 : undefined}
      className={cn(
        "mt-0.5 block min-w-0 truncate text-xs leading-4 text-muted-foreground",
        truncated &&
          "focus-visible:outline-none focus-visible:[box-shadow:var(--nt-outline-active-focus)]",
      )}
    >
      {device.product || <EmptyValue />}
    </span>
  );
  if (!truncated) return label;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{label}</TooltipTrigger>
      <TooltipContent className="max-w-md break-all">
        {device.product || <EmptyValue />}
      </TooltipContent>
    </Tooltip>
  );
}

function DeviceIdentity({
  device,
  showHealth = true,
  showProduct = true,
}: {
  device: ObservedGpu;
  showHealth?: boolean;
  showProduct?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-2">
        <span className="whitespace-nowrap text-sm font-semibold leading-5">
          {t("clusters.fields.gpuNumber")} {device.index}
        </span>
        {showHealth && device.healthy != null && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 text-[11px] font-medium leading-4",
              device.healthy
                ? "text-[var(--nt-text-colorful-positive)]"
                : "text-[var(--nt-text-colorful-serious)]",
            )}
          >
            {device.healthy ? (
              <CircleCheck className="h-3.5 w-3.5" />
            ) : (
              <CircleAlert className="h-3.5 w-3.5" />
            )}
            {t(
              device.healthy
                ? "clusters.options.healthy"
                : "clusters.options.unhealthy",
            )}
          </span>
        )}
      </div>
      {showProduct && <DeviceProduct device={device} />}
    </div>
  );
}

function DeviceHealth({ device }: { device: ObservedGpu }) {
  const { t } = useTranslation();
  if (device.healthy == null) return <EmptyValue />;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-medium leading-4",
        device.healthy
          ? "text-[var(--nt-text-colorful-positive)]"
          : "text-[var(--nt-text-colorful-serious)]",
      )}
    >
      {device.healthy ? (
        <CircleCheck className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <CircleAlert className="h-3.5 w-3.5 shrink-0" />
      )}
      {t(
        device.healthy
          ? "clusters.options.healthy"
          : "clusters.options.unhealthy",
      )}
    </span>
  );
}

function EndpointAllocationTooltip({
  allocation,
  color,
  actualUsedMiB,
}: {
  allocation: EndpointGpuAllocation;
  color: string;
  actualUsedMiB: number | null;
}) {
  const { t } = useTranslation();
  const remainingMiB =
    allocation.modelWeightsMiB != null && allocation.kvCacheCapacityMiB != null
      ? Math.max(
          0,
          allocation.memoryMiB -
            allocation.modelWeightsMiB -
            allocation.kvCacheCapacityMiB,
        )
      : null;
  const actualPercent =
    actualUsedMiB != null && allocation.memoryMiB > 0
      ? (actualUsedMiB / allocation.memoryMiB) * 100
      : null;
  const metric = (
    label: string,
    value: number | null,
    marker?: "solid" | "l0" | "remaining",
    wide = false,
  ) => (
    <div className={cn("min-w-0", wide && "col-span-2")}>
      <div className="flex min-w-0 items-center gap-1.5 text-[10px] leading-4 text-muted-foreground">
        {marker && (
          <i
            aria-hidden="true"
            className="inline-block h-1.5 w-3 shrink-0 rounded-sm"
            style={
              marker === "solid"
                ? { backgroundColor: color }
                : marker === "l0"
                  ? {
                      backgroundColor: color,
                      backgroundImage: KV_STRIPES,
                    }
                  : {
                      backgroundColor: color,
                      boxShadow: `inset 0 0 0 999px ${OTHER_MASK}`,
                    }
            }
          />
        )}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-0.5 whitespace-nowrap text-xs font-semibold tabular-nums text-foreground">
        {gib(value)}
      </div>
    </div>
  );

  return (
    <TooltipContent className="w-[300px] max-w-[calc(100vw-32px)] p-3">
      <div className="min-w-0">
        <p className="break-all text-sm font-semibold leading-5">
          {allocation.endpoint}
        </p>
        <p className="mt-0.5 break-all text-[11px] leading-4 text-muted-foreground">
          {allocation.model || <EmptyValue />}
        </p>
      </div>
      <div className="mt-2.5 border-t border-[var(--nt-stroke-neutral-trans-2)] pt-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[10px] leading-4 text-muted-foreground">
            {t("observations.reservedVram")}
          </span>
          <strong className="text-sm tabular-nums">
            {gib(allocation.memoryMiB)}
          </strong>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
          {metric(
            t("observations.modelWeights"),
            allocation.modelWeightsMiB,
            "solid",
          )}
          {metric(
            t("observations.l0KvCacheCapacity"),
            allocation.kvCacheCapacityMiB,
            "l0",
          )}
          {metric(
            t("observations.otherReservation"),
            remainingMiB,
            "remaining",
            true,
          )}
        </div>
      </div>
      <div className="mt-2.5 border-t border-[var(--nt-stroke-neutral-trans-2)] pt-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1.5 pt-0.5">
            <span
              data-testid="actual-marker-legend"
              aria-hidden="true"
              className="h-3 w-0.5 shrink-0 rounded-full bg-[var(--nt-text-neutral-super)] [box-shadow:0_0_0_1px_var(--nt-fill-neutral-opaque-1)]"
            />
            <span className="text-[10px] leading-4 text-muted-foreground">
              {t("observations.actualVramUsage")}
            </span>
          </div>
          <div className="flex shrink-0 flex-col items-end text-right">
            <strong className="whitespace-nowrap text-sm leading-5 tabular-nums">
              {gib(actualUsedMiB)}
            </strong>
            <span className="mt-0.5 whitespace-nowrap text-[10px] leading-4 text-muted-foreground">
              {actualPercent == null
                ? t("observations.noMeasurement")
                : t("observations.actualOfReserved", {
                    percent: Math.round(actualPercent),
                  })}
            </span>
          </div>
        </div>
      </div>
    </TooltipContent>
  );
}

function EndpointSegmentPattern({
  allocation,
  color,
  actualUsedMiB,
}: {
  allocation: EndpointGpuAllocation;
  color: string;
  actualUsedMiB: number | null;
}) {
  const hasComposition =
    allocation.modelWeightsMiB != null &&
    allocation.kvCacheCapacityMiB != null &&
    allocation.memoryMiB > 0;
  const weightsPct = hasComposition
    ? Math.min(
        100,
        Math.max(
          0,
          ((allocation.modelWeightsMiB ?? 0) / allocation.memoryMiB) * 100,
        ),
      )
    : 0;
  const kvPct = hasComposition
    ? Math.min(
        100 - weightsPct,
        Math.max(
          0,
          ((allocation.kvCacheCapacityMiB ?? 0) / allocation.memoryMiB) * 100,
        ),
      )
    : 0;
  const remainingPct = Math.max(0, 100 - weightsPct - kvPct);
  const actualPct =
    actualUsedMiB != null && allocation.memoryMiB > 0
      ? Math.min(100, Math.max(0, (actualUsedMiB / allocation.memoryMiB) * 100))
      : null;

  return (
    <>
      {hasComposition && (
        <>
          {remainingPct > 0 && (
            <span
              data-testid="endpoint-segment-remaining-pattern"
              className="pointer-events-none absolute inset-y-0 right-0"
              style={{
                width: `${remainingPct}%`,
                backgroundColor: color,
                boxShadow: `inset 0 0 0 999px ${OTHER_MASK}`,
              }}
            />
          )}
          {kvPct > 0 && (
            <span
              data-testid="endpoint-segment-kv-pattern"
              className="pointer-events-none absolute inset-y-0"
              style={{
                left: `${weightsPct}%`,
                width: `${kvPct}%`,
                backgroundColor: color,
                backgroundImage: KV_STRIPES,
              }}
            />
          )}
          {weightsPct > 0 && (
            <span
              data-testid="endpoint-segment-weights-pattern"
              className="pointer-events-none absolute inset-y-0 left-0"
              style={{ width: `${weightsPct}%`, backgroundColor: color }}
            />
          )}
          {[weightsPct, weightsPct + kvPct].map((left, index) =>
            left > 0 && left < 100 ? (
              <span
                key={index}
                className="pointer-events-none absolute inset-y-0 w-px"
                style={{
                  left: `${left}%`,
                  backgroundColor: SEGMENT_DIVIDER,
                }}
              />
            ) : null,
          )}
        </>
      )}
      {actualPct != null && (
        <span
          data-testid="endpoint-segment-actual-marker"
          className="pointer-events-none absolute inset-y-px z-10 w-0.5 -translate-x-1/2 rounded-full bg-[var(--nt-text-neutral-super)] [box-shadow:0_0_0_1px_var(--nt-fill-neutral-opaque-1)]"
          style={{ left: `${actualPct}%` }}
        />
      )}
    </>
  );
}

function InventoryAllocationBar({
  device,
  allocations,
  samples,
  cardUsedMiB,
  total,
}: {
  device: ObservedGpu;
  allocations: GpuAllocation[];
  samples: AcceleratorSample[];
  cardUsedMiB: number | null;
  total: number | null;
}) {
  const { t } = useTranslation();
  const [activeAllocation, setActiveAllocation] = useState<string | null>(null);
  const { visible, hidden, hiddenMemoryMiB } =
    splitGpuEndpointAllocations(allocations);
  const reserved =
    device.allocatedMiB ??
    visible.reduce((sum, allocation) => sum + allocation.memoryMiB, 0) +
      hiddenMemoryMiB;
  // Colours are resolved over every Endpoint on this GPU (hidden ones included)
  // so the bar, the tooltip and the details sheet always agree on a name's colour.
  const colorByEndpoint = assignAllocationColors(
    allocations.map((allocation) => allocation.endpoint),
  );

  if (device.allocatedMiB == null) {
    return (
      <div className="space-y-1">
        <div
          role="img"
          aria-label={t("observations.allocationUnknown")}
          className="h-2 rounded-full border border-dashed border-[var(--nt-stroke-neutral-trans-3)] bg-transparent"
        />
        <span className="text-[11px] text-muted-foreground">
          {t("observations.allocationUnknown")}
        </span>
      </div>
    );
  }

  if (reserved === 0) {
    return (
      <div
        role="img"
        aria-label={t("observations.noEndpointAllocation")}
        className={cn("h-2.5", GPU_BAR_TRACK_CLASS)}
      />
    );
  }

  if (visible.length === 0) {
    return (
      <div className="space-y-1">
        <div className="h-2 rounded-full border border-dashed border-[var(--nt-stroke-neutral-trans-3)] bg-transparent" />
        <span className="text-[11px] text-muted-foreground">
          {t("observations.endpointAllocationUnavailable")}
        </span>
      </div>
    );
  }

  const allocationWidth = (allocation: EndpointGpuAllocation) =>
    total && total > 0
      ? Math.min(100, Math.max(0, (allocation.memoryMiB / total) * 100))
      : 100 / (visible.length + Number(hidden.length > 0));

  return (
    <div
      role="group"
      aria-label={t("observations.allocationByEndpoint")}
      className={cn("h-2.5", GPU_BAR_TRACK_CLASS)}
    >
      <div className="absolute inset-0 flex overflow-hidden rounded-full">
        {visible.map((allocation) => {
          const allocationKey = `${allocation.workspace}:${allocation.endpoint}`;
          const color =
            colorByEndpoint[allocation.endpoint] ??
            allocationColor(allocation.endpoint);
          const actualUsedMiB = endpointAllocationUsedMiB(
            samples,
            allocation,
            allocations.length,
            cardUsedMiB,
          );
          return (
            <Tooltip key={allocationKey}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="relative h-full shrink-0 overflow-hidden border-0 p-0 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--nt-stroke-outstanding-base)] focus-visible:outline-offset-1"
                  style={{
                    width: `${allocationWidth(allocation)}%`,
                    backgroundColor: color,
                    ...chartOutlineStyle(),
                  }}
                  aria-label={`${allocation.endpoint}, ${gib(allocation.memoryMiB)} ${t("observations.reservedLower")}`}
                  onMouseEnter={() => setActiveAllocation(allocationKey)}
                  onMouseLeave={() => setActiveAllocation(null)}
                  onFocus={() => setActiveAllocation(allocationKey)}
                  onBlur={() => setActiveAllocation(null)}
                  onClick={() => setActiveAllocation(allocationKey)}
                >
                  {hidden.length > 0 && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 flex items-center justify-center text-[9px] font-semibold text-white tabular-nums"
                    >
                      {visible.findIndex(
                        (item) =>
                          `${item.workspace}:${item.endpoint}` ===
                          allocationKey,
                      ) + 1}
                    </span>
                  )}
                  {activeAllocation === allocationKey && (
                    <EndpointSegmentPattern
                      allocation={allocation}
                      color={color}
                      actualUsedMiB={actualUsedMiB}
                    />
                  )}
                </button>
              </TooltipTrigger>
              <EndpointAllocationTooltip
                allocation={allocation}
                color={color}
                actualUsedMiB={actualUsedMiB}
              />
            </Tooltip>
          );
        })}
        {hidden.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="h-full shrink-0 border-0 bg-[var(--nt-fill-neutral-trans-7)] p-0 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--nt-stroke-outstanding-base)] focus-visible:outline-offset-1"
                style={{
                  width: `${
                    total && total > 0
                      ? Math.min(100, (hiddenMemoryMiB / total) * 100)
                      : 100 / (visible.length + 1)
                  }%`,
                }}
                aria-label={t("observations.moreAllocationsLabel", {
                  count: hidden.length,
                  memory: gib(hiddenMemoryMiB),
                })}
                onMouseEnter={() => setActiveAllocation(null)}
                onFocus={() => setActiveAllocation(null)}
              >
                <span
                  aria-hidden
                  className="pointer-events-none flex h-full items-center justify-center text-[9px] font-semibold text-foreground/70 tabular-nums"
                >
                  +{hidden.length}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-md">
              <p className="font-medium">
                {t("observations.moreAllocations", { count: hidden.length })}
              </p>
              <p className="mb-2 text-muted-foreground">
                {gib(hiddenMemoryMiB)} {t("observations.reservedLower")}
              </p>
              <div className="space-y-1.5">
                {hidden.map((allocation) => (
                  <div
                    key={`${allocation.workspace}:${allocation.endpoint}`}
                    className="grid gap-0.5"
                  >
                    <Link
                      className="break-all font-medium text-primary hover:underline"
                      to={`/${encodeURIComponent(allocation.workspace)}/endpoints/show/${encodeURIComponent(allocation.endpoint)}`}
                    >
                      {allocation.endpoint}
                    </Link>
                    <span className="break-all text-[11px] text-muted-foreground">
                      {allocation.model} · {gib(allocation.memoryMiB)}
                    </span>
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

const KV_PATTERN_TINT =
  "linear-gradient(hsl(var(--background) / 0.34), hsl(var(--background) / 0.34))";
const KV_STRIPES = `${KV_PATTERN_TINT}, repeating-linear-gradient(135deg, hsl(var(--background) / 0.72) 0 2px, transparent 2px 4px)`;
const OTHER_MASK = "hsl(var(--background) / 0.62)";
const SEGMENT_DIVIDER = "hsl(var(--background) / 0.9)";

function CompositionSegments({
  measuredPct,
  weightsPct,
  kvPct,
}: {
  measuredPct: number;
  weightsPct: number;
  kvPct: number;
}) {
  const weights = Math.min(weightsPct, measuredPct);
  const kv = Math.min(kvPct, measuredPct - weights);
  const other = Math.max(0, measuredPct - weights - kv);
  return (
    <>
      {weights > 0 && (
        <div
          data-testid="gpu-bar-weights-segment"
          className="pointer-events-none absolute inset-y-0 left-0 border-r"
          style={{
            width: `${weights}%`,
            borderRightColor: SEGMENT_DIVIDER,
          }}
        />
      )}
      {kv > 0 && (
        <div
          data-testid="gpu-bar-kv-segment"
          className="pointer-events-none absolute inset-y-0 border-r"
          style={{
            left: `${weights}%`,
            width: `${kv}%`,
            backgroundImage: KV_STRIPES,
            borderRightColor: SEGMENT_DIVIDER,
          }}
        />
      )}
      {other > 0 && (
        <div
          data-testid="gpu-bar-other-segment"
          className="pointer-events-none absolute inset-y-0 border-r"
          style={{
            left: `${weights + kv}%`,
            width: `${other}%`,
            backgroundColor: OTHER_MASK,
            borderRightColor: SEGMENT_DIVIDER,
          }}
        />
      )}
    </>
  );
}

function AllocationMemory({
  device,
  replica,
  actual,
  total,
}: {
  device: ObservedGpu;
  replica?: GpuAllocation;
  actual: number | null;
  total: number | null;
}) {
  const { t } = useTranslation();
  const reserved = device.allocatedMiB;
  const hasComposition =
    replica?.modelWeightsMiB != null && replica.kvCacheCapacityMiB != null;

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="whitespace-nowrap font-semibold tabular-nums text-foreground">
          {gibValue(actual)}
          <span className="font-normal text-muted-foreground">
            {" "}
            / {gibValue(reserved)} GiB
          </span>
        </span>
        {actual == null && (
          <span className="truncate text-[11px] text-muted-foreground">
            {t("observations.noMeasurement")}
          </span>
        )}
      </div>
      <div className={cn("h-2.5", GPU_BAR_TRACK_CLASS)}>
        <div className="absolute inset-0 overflow-hidden rounded-full">
          <div
            className="absolute inset-y-0 left-0 bg-[var(--nt-chart-series-1)] opacity-30"
            style={{ width: `${ratio(reserved, total)}%` }}
          />
          {actual != null && (
            <div
              className="absolute inset-y-0 left-0 bg-[var(--nt-chart-series-1)]"
              style={{ width: `${ratio(actual, total)}%` }}
            />
          )}
          {actual != null && replica && hasComposition && (
            <CompositionSegments
              measuredPct={ratio(actual, total)}
              weightsPct={ratio(replica.modelWeightsMiB, total)}
              kvPct={ratio(replica.kvCacheCapacityMiB, total)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function AllocationBreakdown({
  replica,
  actual,
  reserved,
}: {
  replica?: GpuAllocation;
  actual: number | null;
  reserved: number | null;
}) {
  const { t } = useTranslation();
  const unused =
    actual != null && reserved != null ? Math.max(0, reserved - actual) : null;

  return (
    <div className="min-w-0 space-y-1">
      <p className="break-words text-[11px] leading-4 text-muted-foreground">
        {t("observations.modelWeights")} {gib(replica?.modelWeightsMiB)} ·{" "}
        {t("observations.l0KvCache")} {gib(replica?.kvCacheCapacityMiB)}
      </p>
      <p className="text-[11px] leading-4 text-muted-foreground">
        {t("observations.allocatedUnused")} {gib(unused)}
      </p>
      <div className={cn("h-2", GPU_BAR_TRACK_CLASS)}>
        <div className="absolute inset-0 flex overflow-hidden rounded-full">
          <span
            className="h-full bg-[var(--nt-chart-series-1)]"
            style={{
              width: `${reserved ? ratio(replica?.modelWeightsMiB, reserved) : 0}%`,
            }}
          />
          <span
            className="h-full bg-[var(--nt-chart-series-3)]"
            style={{
              width: `${reserved ? ratio(replica?.kvCacheCapacityMiB, reserved) : 0}%`,
              backgroundImage: KV_STRIPES,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function Utilization({
  reading,
  inline = false,
}: {
  reading?: AcceleratorSample;
  inline?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "min-w-0",
        inline ? "flex items-center gap-2" : "space-y-1",
      )}
    >
      <div className="shrink-0 text-xs font-semibold tabular-nums">
        {reading ? `${(reading.value * 100).toFixed(0)}%` : <EmptyValue />}
      </div>
      <MetricBar
        size="sm"
        series="cyan"
        value={reading ? reading.value * 100 : null}
        track={reading ? "outlined" : "unavailable"}
        aria-label={t("observations.utilization")}
        className={inline ? "min-w-16 flex-1" : undefined}
      />
    </div>
  );
}

function GpuDetailsSheet({
  open,
  onOpenChange,
  device,
  samples,
  allocations,
  replica,
  tflopsOverrides,
  observationStatus,
  onRetry,
}: Props & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const readings = getReadings(device, samples, replica);
  const assigned = allocations.filter(
    (allocation) =>
      allocation.node === device.node && allocation.uuid === device.uuid,
  );
  const { sorted, hidden } = splitGpuEndpointAllocations(assigned);
  const colorByEndpoint = assignAllocationColors(
    assigned.map((allocation) => allocation.endpoint),
  );
  const nominalTflops = peakTflops(
    device.product,
    tflopsOverrides,
    device.peakFP16TFLOPS,
  );
  const colorOf = (allocation: EndpointGpuAllocation) =>
    colorByEndpoint[allocation.endpoint] ??
    allocationColor(allocation.endpoint);
  const keyOf = (allocation: EndpointGpuAllocation) =>
    `${allocation.workspace}:${allocation.endpoint}`;

  // One Endpoint at a time, and only one: the bar establishes the relationship
  // between allocations, the list opens one object. A single Endpoint opens by
  // default because there is nothing to disambiguate; several start collapsed.
  // The choice is scoped to the device so opening another GPU never inherits it.
  const [selection, setSelection] = useState<{
    device: string;
    key: string | null;
  } | null>(null);
  const singleEndpointKey = sorted.length === 1 ? keyOf(sorted[0]) : null;
  const selectedKey =
    selection?.device === device.uuid ? selection.key : singleEndpointKey;
  const toggle = (key: string) =>
    setSelection({
      device: device.uuid,
      key: selectedKey === key ? null : key,
    });

  const label = (value?: string) =>
    !value || value === "unknown" || value === "-1" ? "—" : value;
  const hardwareValue = (key: string) => {
    const value = readings.hardware[key];
    if (["nvlink", "nvswitch"].includes(key)) {
      return value === "1"
        ? t("observations.present")
        : value === "0"
          ? t("observations.absent")
          : "—";
    }
    if (key === "pcie_generation") return value ? `Gen ${value}` : "—";
    if (key === "pcie_width") return value ? `x${value}` : "—";
    return label(value);
  };
  const baseHardwareFields = [
    "architecture",
    "cuda_capability",
    "cuda_driver_version",
    "nvlink",
    "nvswitch",
    "pcie_bus_id",
    "pcie_generation",
    "pcie_width",
    "numa_node",
  ];
  const hardwareFields = [
    ...baseHardwareFields,
    ...extraHardwareFields.map((field) => field.key),
  ];
  const hardwareLabel = (key: string) =>
    t(
      extraHardwareFields.find((field) => field.key === key)?.label ??
        `observations.hardwareFields.${key}`,
    );
  const reportedCount = hardwareFields.filter(
    (key) => hardwareValue(key) !== "—",
  ).length;

  const physical = readings.total;
  const reserved = device.allocatedMiB;
  const actual = readings.actual;
  const hasRuntimeMetric = Boolean(
    readings.utilization || readings.temperature || readings.power,
  );
  const isLoading = observationStatus === "loading";
  const isUnavailable =
    observationStatus === "unavailable" ||
    observationStatus === "not_configured" ||
    observationStatus === "no_data";
  const sampleTime = [
    readings.utilization,
    readings.temperature,
    readings.power,
  ]
    .filter(Boolean)
    .map((sample) => sample?.observed_at ?? 0)
    .reduce((latest, value) => Math.max(latest, value), 0);
  const ageLabel = (seconds: number) => {
    if (seconds < 60) return t("observations.ageSeconds", { count: seconds });
    if (seconds < 3600)
      return t("observations.ageMinutes", { count: Math.floor(seconds / 60) });
    return t("observations.ageHours", { count: Math.floor(seconds / 3600) });
  };
  const sampleAgeSeconds =
    sampleTime > 0
      ? Math.max(0, Math.floor(Date.now() / 1000) - sampleTime)
      : null;
  const updatedAge =
    sampleAgeSeconds != null ? ageLabel(sampleAgeSeconds) : null;
  // Beyond this the values are history, not state; the spec asks for a visible
  // marker rather than dropping the readings or passing them off as live.
  const STALE_AFTER_SECONDS = 2 * 60 * 60;
  const isStale =
    sampleAgeSeconds != null && sampleAgeSeconds > STALE_AFTER_SECONDS;
  const estimatedTflops =
    nominalTflops != null && readings.utilization
      ? nominalTflops * readings.utilization.value
      : null;
  const replicaCount = assigned.length;
  const showIndex = hidden.length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-[680px]">
        <SheetHeader className="space-y-1.5 text-left">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {t("observations.deviceEyebrow")}
          </p>
          <SheetTitle className="flex flex-wrap items-center gap-2">
            <span className="rounded border border-[var(--nt-stroke-neutral-trans-3)] bg-[var(--nt-fill-neutral-opaque-2)] px-1.5 py-0.5 text-xs font-semibold tabular-nums">
              {t("clusters.fields.gpuNumber")} {device.index}
            </span>
            <span className="break-all">
              {device.product || <EmptyValue />}
            </span>
          </SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <DeviceHealth device={device} />
            <span className="break-all">{device.node}</span>
            <span aria-hidden className="text-muted-foreground">
              ·
            </span>
            <span className="text-muted-foreground">
              {t("observations.uuid")}{" "}
              <span className="select-all font-mono text-foreground">
                {device.uuid}
              </span>
            </span>
            <CopyUuidButton device={device} />
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-4">
          <section className="rounded-md border border-[var(--nt-stroke-neutral-trans-2)]">
            <header className="flex items-center justify-between gap-2 border-b border-[var(--nt-stroke-neutral-trans-2)] px-3 py-2">
              <h3 className="text-sm font-medium">
                {t("observations.liveResourceState")}
              </h3>
              {updatedAge && (
                <span className="flex items-center gap-1.5 text-[11px] whitespace-nowrap text-muted-foreground">
                  {t("observations.updatedAgo", { age: updatedAge })}
                  {isStale && (
                    <span className="rounded-sm border border-[var(--nt-stroke-neutral-trans-3)] px-1 text-[10px] font-medium">
                      {t("observations.staleSample")}
                    </span>
                  )}
                </span>
              )}
            </header>
            <div className="space-y-3 px-3 py-3">
              {isLoading ? (
                <div className="space-y-3" aria-busy="true">
                  <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--nt-fill-neutral-trans-3)]" />
                  <div className="h-2 w-full animate-pulse rounded-full bg-[var(--nt-fill-neutral-trans-3)]" />
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[0, 1, 2, 3].map((slot) => (
                      <div key={slot} className="space-y-1.5">
                        <div className="h-2 w-2/3 animate-pulse rounded bg-[var(--nt-fill-neutral-trans-3)]" />
                        <div className="h-3 w-1/2 animate-pulse rounded bg-[var(--nt-fill-neutral-trans-3)]" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : hasRuntimeMetric ? (
                <>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-muted-foreground">
                        {t("observations.utilization")}
                      </span>
                      <span className="text-sm font-semibold tabular-nums">
                        {readings.utilization ? (
                          `${(readings.utilization.value * 100).toFixed(0)}%`
                        ) : (
                          <EmptyValue />
                        )}
                      </span>
                    </div>
                    <MetricBar
                      size="sm"
                      series="cyan"
                      value={
                        readings.utilization
                          ? readings.utilization.value * 100
                          : null
                      }
                      track={readings.utilization ? "outlined" : "unavailable"}
                      aria-label={t("observations.utilization")}
                    />
                  </div>
                  <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <div>
                      <dt className="text-[11px] text-muted-foreground">
                        {t("observations.vramActualOfTotal")}
                      </dt>
                      <dd className="tabular-nums">
                        {gibValue(actual)}{" "}
                        <span className="text-muted-foreground">
                          / {gibValue(physical)} GiB
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-muted-foreground">
                        {t("observations.acceleratorCore")}
                      </dt>
                      <dd className="tabular-nums">
                        {device.coreUnits != null
                          ? `${device.coreUnits}%`
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-muted-foreground">
                        {t("observations.deviceTemperature")}
                      </dt>
                      <dd className="tabular-nums">
                        {readings.temperature
                          ? `${readings.temperature.value.toFixed(0)} °C`
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-muted-foreground">
                        {t("observations.devicePower")}
                      </dt>
                      <dd className="tabular-nums">
                        {readings.power
                          ? `${readings.power.value.toFixed(0)} W`
                          : "—"}
                      </dd>
                    </div>
                  </dl>
                  <div>
                    <p className="text-[11px] text-muted-foreground">
                      {t("observations.fp16Estimate")}
                    </p>
                    <p className="text-sm tabular-nums">
                      {estimatedTflops != null
                        ? estimatedTflops.toFixed(1)
                        : "—"}{" "}
                      / {nominalTflops != null ? nominalTflops.toFixed(1) : "—"}{" "}
                      {t("observations.tflopsPeak")}
                    </p>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {t(
                      observationStatus === "unavailable"
                        ? "observations.status.unavailable"
                        : observationStatus === "not_configured"
                          ? "observations.status.not_configured"
                          : "observations.status.no_data",
                    )}
                  </p>
                  {onRetry && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onRetry}
                      className="h-7 px-2 text-xs"
                    >
                      {t("observations.retry")}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-md border border-[var(--nt-stroke-neutral-trans-2)]">
            <header className="flex items-center justify-between gap-2 border-b border-[var(--nt-stroke-neutral-trans-2)] px-3 py-2">
              <h3 className="text-sm font-medium">
                {t("observations.vramAllocation")}
              </h3>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {gibValue(reserved)} / {gibValue(physical)} GiB
              </span>
            </header>
            <div className="space-y-3 px-3 py-3">
              <InventoryAllocationBar
                device={device}
                allocations={assigned}
                samples={samples}
                cardUsedMiB={readings.actual}
                total={readings.total}
              />
              {sorted.length > 0 && (
                <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span
                      aria-hidden
                      className="size-1.5 rounded-full bg-[var(--nt-chart-series-1)]"
                    />
                    {t("observations.endpointCount", { count: sorted.length })}
                  </span>
                  <span>
                    {t("observations.reservedTotal", { memory: gib(reserved) })}
                  </span>
                </p>
              )}
              <ul className="space-y-1">
                {sorted.map((allocation) => {
                  const key = keyOf(allocation);
                  const isOpen = selectedKey === key;
                  const index =
                    sorted.findIndex((item) => keyOf(item) === key) + 1;
                  return (
                    <li
                      key={key}
                      className="rounded-md border border-[var(--nt-stroke-neutral-trans-2)]"
                    >
                      <div className="flex items-center gap-2 px-2 py-2">
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          aria-label={t(
                            isOpen
                              ? "observations.collapseAllocation"
                              : "observations.expandAllocation",
                            { endpoint: allocation.endpoint },
                          )}
                          onClick={() => toggle(key)}
                          className="rounded p-0.5 text-muted-foreground outline-none hover:bg-[var(--nt-fill-neutral-trans-3)] focus-visible:[box-shadow:var(--nt-outline-active-focus)]"
                        >
                          <ChevronRight
                            aria-hidden
                            className={cn(
                              "size-3.5 transition-transform",
                              isOpen && "rotate-90",
                            )}
                          />
                        </button>
                        <span
                          aria-hidden
                          className="flex size-4 shrink-0 items-center justify-center rounded-sm text-[9px] font-semibold text-white"
                          style={{ backgroundColor: colorOf(allocation) }}
                        >
                          {showIndex ? index : ""}
                        </span>
                        <div className="min-w-0 flex-1">
                          <Link
                            className="block truncate text-sm font-medium text-primary hover:underline"
                            to={`/${encodeURIComponent(allocation.workspace)}/endpoints/show/${encodeURIComponent(allocation.endpoint)}`}
                          >
                            {allocation.endpoint}
                          </Link>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {allocation.model || <EmptyValue />} ·{" "}
                            {allocation.workspace}
                          </p>
                        </div>
                        <span className="shrink-0 text-[11px] whitespace-nowrap tabular-nums text-muted-foreground">
                          {t("observations.reservedAmount", {
                            memory: gib(allocation.memoryMiB),
                          })}
                        </span>
                      </div>
                      {isOpen && (
                        <div className="space-y-2 border-t border-[var(--nt-stroke-neutral-trans-2)] px-3 py-2">
                          <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                            <div>
                              <dt className="text-[11px] text-muted-foreground">
                                {t("observations.workspaceLabel")}
                              </dt>
                              <dd className="break-all">
                                {allocation.workspace}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-[11px] text-muted-foreground">
                                {t("observations.replicaLabel")}
                              </dt>
                              <dd className="tabular-nums">
                                {allocation.allocations.length}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-[11px] text-muted-foreground">
                                {t("observations.instanceLabel")}
                              </dt>
                              <dd className="break-all">
                                {allocation.allocations[0]?.instance || "—"}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-[11px] text-muted-foreground">
                                {t("observations.vgpuLabel")}
                              </dt>
                              <dd className="break-all">
                                {allocation.allocations[0]?.vdevice ??
                                  t("observations.fullCard")}
                              </dd>
                            </div>
                          </dl>
                          {allocation.allocations.map((item) => {
                            const measurement = reading(
                              samples,
                              "neutree_endpoint_replica_accelerator_memory_used_bytes",
                              item.node,
                              item.uuid,
                              item,
                            );
                            const usedForReplica = measurement
                              ? measurement.value / 1024 ** 2
                              : null;
                            const percent =
                              usedForReplica != null && item.memoryMiB > 0
                                ? Math.min(
                                    100,
                                    (usedForReplica / item.memoryMiB) * 100,
                                  )
                                : null;
                            return (
                              <div
                                key={`${item.replica}:${item.instance}`}
                                className="space-y-1"
                              >
                                <p className="flex items-center justify-between gap-2 text-[11px]">
                                  <span className="truncate font-mono text-muted-foreground">
                                    {item.replica || item.instance || "—"}
                                  </span>
                                  <span className="whitespace-nowrap tabular-nums">
                                    {t("observations.actual")}{" "}
                                    {gib(usedForReplica)} /{" "}
                                    {gib(item.memoryMiB)}
                                    {percent != null &&
                                      ` · ${percent.toFixed(0)}%`}
                                  </span>
                                </p>
                                <AllocationBreakdown
                                  replica={item}
                                  actual={usedForReplica}
                                  reserved={item.memoryMiB}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              {sorted.length === 0 && reserved != null && reserved > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t("observations.endpointAllocationUnavailable")}
                </p>
              )}
            </div>
          </section>

          <section className="rounded-md border border-[var(--nt-stroke-neutral-trans-2)]">
            <header className="flex items-center justify-between gap-2 border-b border-[var(--nt-stroke-neutral-trans-2)] px-3 py-2">
              <h3 className="text-sm font-medium">
                {t("observations.hardware")}
              </h3>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {t("observations.hardwareReported", {
                  reported: reportedCount,
                  total: hardwareFields.length,
                })}
              </span>
            </header>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 px-3 py-3 text-sm sm:grid-cols-3">
              {hardwareFields.map((key) => (
                <div key={key} className="min-w-0">
                  <dt className="text-[11px] text-muted-foreground">
                    {hardwareLabel(key)}
                  </dt>
                  <dd className="break-all">{hardwareValue(key)}</dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span>
              {t("observations.endpointCount", { count: sorted.length })} ·{" "}
              {t("observations.replicaAllocations", { count: replicaCount })}
            </span>
            <span className="font-mono">{device.uuid}</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CopyUuidButton({ device }: { device: ObservedGpu }) {
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
          aria-label={`${t("clusters.fields.gpuNumber")} ${device.index} ${t("clusters.actions.copyUuid")}`}
          className="h-7 w-7 text-muted-foreground"
          onClick={() =>
            copy(device.uuid, {
              successMessage: t("clusters.messages.copyUuidSuccess"),
              errorMessage: t("clusters.messages.copyUuidFailed"),
            })
          }
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t("clusters.actions.copyUuid")}</TooltipContent>
    </Tooltip>
  );
}

function ObservationActions({
  device,
  onOpen,
}: {
  device: ObservedGpu;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex shrink-0 items-center justify-end gap-1">
      <CopyUuidButton device={device} />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground"
        aria-label={t("observations.detailsForGpu", {
          index: device.index,
        })}
        onClick={onOpen}
      >
        <ArrowUpRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function GpuObservationCard({
  device,
  samples,
  allocations,
  replica,
  tflopsOverrides = {},
  variant = "allocation",
  display = "table",
  showProduct = true,
  observationStatus,
  onRetry,
}: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const readings = getReadings(device, samples, replica);
  const assigned = allocations.filter(
    (allocation) =>
      allocation.node === device.node && allocation.uuid === device.uuid,
  );
  const sheet = (
    <GpuDetailsSheet
      open={open}
      onOpenChange={setOpen}
      device={device}
      samples={samples}
      allocations={allocations}
      replica={replica}
      tflopsOverrides={tflopsOverrides}
      observationStatus={observationStatus}
      onRetry={onRetry}
    />
  );

  if (variant === "inventory" && display === "cards") {
    return (
      <TooltipProvider delayDuration={120} skipDelayDuration={200}>
        <article
          role="listitem"
          data-testid="gpu-inventory-card"
          className={cn(
            "min-w-0 rounded-md border border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-opaque-1)] p-3",
            device.healthy === false &&
              "bg-[var(--nt-fill-neutral-trans-3)] text-[var(--nt-text-neutral-tertiary)]",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1">
                <button
                  type="button"
                  className="min-w-0 truncate text-left text-sm font-semibold leading-5 text-foreground hover:text-primary hover:underline focus-visible:outline-none focus-visible:[box-shadow:var(--nt-outline-active-focus)]"
                  aria-label={t("observations.detailsForGpu", {
                    index: device.index,
                  })}
                  onClick={() => setOpen(true)}
                >
                  {t("clusters.fields.gpuNumber")} {device.index}
                </button>
                <CopyUuidButton device={device} />
              </div>
              {showProduct && <DeviceProduct device={device} />}
            </div>
            <DeviceHealth device={device} />
          </div>
          <div className="mt-3 space-y-2.5">
            <div>
              <div className="mb-1 flex items-center justify-between gap-3 text-[11px] leading-4">
                <span className="text-muted-foreground">
                  {t("observations.vramAllocation")}
                </span>
                <span className="shrink-0 whitespace-nowrap font-semibold tabular-nums text-foreground">
                  {gibValue(device.allocatedMiB)}
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    / {gibValue(readings.total)} GiB
                  </span>
                </span>
              </div>
              <InventoryAllocationBar
                device={device}
                allocations={assigned}
                samples={samples}
                cardUsedMiB={readings.actual}
                total={readings.total}
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between gap-3 text-[11px] leading-4">
                <span className="text-muted-foreground">
                  {t("observations.utilization")}
                </span>
                <Utilization reading={readings.utilization} inline />
              </div>
            </div>
          </div>
        </article>
        {sheet}
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={120} skipDelayDuration={200}>
      <div
        data-testid={
          variant === "inventory" ? "gpu-inventory-row" : "gpu-allocation-row"
        }
        className={cn(
          variant === "inventory" ? INVENTORY_GRID : ALLOCATION_GRID,
          "border-b border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-opaque-1)] py-1.5 last:border-b-0",
          device.healthy === false &&
            "bg-[var(--nt-fill-neutral-trans-3)] text-[var(--nt-text-neutral-tertiary)]",
        )}
      >
        <DeviceIdentity
          device={device}
          showHealth={variant !== "inventory"}
          showProduct={variant !== "inventory" || showProduct}
        />

        {variant === "inventory" ? (
          <>
            <DeviceHealth device={device} />
            <div className="flex min-w-0 items-center gap-3">
              <div className="min-w-0 flex-1">
                <InventoryAllocationBar
                  device={device}
                  allocations={assigned}
                  samples={samples}
                  cardUsedMiB={readings.actual}
                  total={readings.total}
                />
              </div>
              <span className="shrink-0 whitespace-nowrap text-xs tabular-nums">
                <strong className="font-semibold text-foreground">
                  {gibValue(device.allocatedMiB)}
                </strong>
                <span className="text-muted-foreground">
                  {" "}
                  / {gibValue(readings.total)} GiB
                </span>
              </span>
            </div>
            <Utilization reading={readings.utilization} inline />
          </>
        ) : (
          <>
            <AllocationMemory
              device={device}
              replica={replica}
              actual={readings.actual}
              total={readings.total}
            />
            <AllocationBreakdown
              replica={replica}
              actual={readings.actual}
              reserved={device.allocatedMiB}
            />
            <Utilization reading={readings.utilization} />
            <div className="min-w-0 text-xs">
              <div className="font-semibold tabular-nums">
                {device.coreUnits != null ? (
                  `${device.coreUnits}%`
                ) : (
                  <EmptyValue />
                )}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {t("observations.computeShareLower")}
              </div>
            </div>
          </>
        )}

        <ObservationActions device={device} onOpen={() => setOpen(true)} />
      </div>
      {sheet}
    </TooltipProvider>
  );
}
