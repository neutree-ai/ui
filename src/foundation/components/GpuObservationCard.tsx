import {
  ArrowUpRight,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Copy,
} from "lucide-react";
import { Fragment, useRef, useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
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
import { EMPTY_VALUE, EmptyValue } from "@/foundation/components/EmptyValue";
import { MetricBar } from "@/foundation/components/MetricBar";
import { useCopyToClipboard } from "@/foundation/hooks/use-copy-to-clipboard";
import { useIsTruncated } from "@/foundation/hooks/use-is-truncated";
import { extraHardwareFields } from "@/foundation/lib/accelerator-extra-info";
import {
  type AcceleratorSample,
  allocationComposition,
  allocationKey,
  coreAllocation,
  deviceHardwareInfo,
  deviceReadings,
  type EndpointGpuAllocation,
  endpointAllocationUsedMiB,
  endpointHref,
  type GpuAllocation,
  hardwareValue,
  type ObservedGpu,
  percentOf,
  reading,
  sampleAge,
  splitGpuEndpointAllocations,
  visibleHardwareFields,
} from "@/foundation/lib/accelerator-observations";
import { peakTflops } from "@/foundation/lib/accelerator-tflops";
import {
  CHART_SERIES_SEPARATOR,
  chartCategoryMark,
  chartOutlineStyle,
} from "@/foundation/lib/chart-palette";
import {
  l0Pattern,
  OWNER_SECONDARY_TONE,
  OWNER_WEIGHTS_TONE,
  ownerTone,
} from "@/foundation/lib/gpu-ownership";
import { useTranslation } from "@/foundation/lib/i18n";
import {
  formatMiBAsGiB,
  formatMiBAsGiBValue,
  formatToDecimal,
} from "@/foundation/lib/unit";
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
  "grid min-w-[940px] grid-cols-[minmax(180px,1.15fr)_86px_minmax(280px,1.8fr)_minmax(150px,1fr)_minmax(150px,1fr)] items-center gap-3 px-4";
const ALLOCATION_GRID =
  "grid min-w-[644px] grid-cols-[minmax(150px,1.1fr)_minmax(230px,1.9fr)_120px_90px] items-center gap-3 px-4";
const GPU_BAR_TRACK_CLASS =
  "relative rounded-full border border-[var(--nt-stroke-neutral-trans-3)] bg-[var(--nt-fill-neutral-opaque-2)]";

const gib = (mib: number | null | undefined) =>
  formatMiBAsGiB(mib) ?? EMPTY_VALUE;
const gibValue = (mib: number | null | undefined) =>
  formatMiBAsGiBValue(mib) ?? EMPTY_VALUE;

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
          t("observations.computeShare"),
          t("observations.utilization"),
        ]
      : [
          t("observations.deviceAndHealth"),
          t("observations.vramInUse"),
          t("observations.utilization"),
          t("observations.computeShare"),
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
        <CopyUuidButton uuid={device.uuid} index={device.index} />
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
  const remainingMiB = allocationComposition(allocation).otherMiB;
  const actualPercent =
    actualUsedMiB != null && allocation.memoryMiB > 0
      ? (actualUsedMiB / allocation.memoryMiB) * 100
      : null;
  const hasComposition = allocation.modelWeightsMiB != null;
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
                ? { backgroundColor: ownerTone(color, OWNER_WEIGHTS_TONE) }
                : marker === "l0"
                  ? {
                      backgroundColor: "var(--nt-fill-neutral-white)",
                      backgroundImage: l0Pattern(color),
                    }
                  : {
                      backgroundColor: ownerTone(color, OWNER_SECONDARY_TONE),
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
    <HoverCardContent
      side="top"
      className="w-[300px] max-w-[calc(100vw-32px)] p-3"
      data-testid="endpoint-allocation-preview"
    >
      <div className="min-w-0">
        {/* The name is the way into the object: the same link the sheet's list
            offers, so a tooltip is not a dead end. An inline anchor keeps its
            hit box on the text; a block one collapses here. */}
        <p className="break-all text-sm font-semibold leading-5">
          <Link
            to={endpointHref(allocation)}
            className="text-primary hover:underline focus-visible:outline-none focus-visible:[box-shadow:var(--nt-outline-active-focus)]"
          >
            {allocation.endpoint}
          </Link>
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
        {hasComposition && (
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
            {allocation.modelWeightsMiB != null &&
              metric(
                t("observations.modelWeights"),
                allocation.modelWeightsMiB,
                "solid",
              )}
            {allocation.modelWeightsMiB != null &&
              allocation.kvCacheCapacityMiB != null &&
              metric(
                t("observations.l0KvCacheCapacity"),
                allocation.kvCacheCapacityMiB,
                "l0",
              )}
            {remainingMiB != null &&
              metric(
                t("observations.otherReservation"),
                remainingMiB,
                "remaining",
                true,
              )}
          </div>
        )}
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
                : actualPercent > 100
                  ? t("observations.usedAndExceedsReserved", {
                      percent: Math.round(actualPercent),
                      memory: gib((actualUsedMiB ?? 0) - allocation.memoryMiB),
                    })
                  : t("observations.actualOfReserved", {
                      percent: Math.round(actualPercent),
                    })}
            </span>
          </div>
        </div>
      </div>
    </HoverCardContent>
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
  const {
    known: hasComposition,
    weightsPct,
    kvPct,
    otherPct: remainingPct,
    actualPct,
  } = allocationComposition(allocation, actualUsedMiB);
  const actualExceedsReserved =
    actualUsedMiB != null && actualUsedMiB > allocation.memoryMiB;

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
                backgroundColor: ownerTone(color, OWNER_SECONDARY_TONE),
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
                backgroundColor: "var(--nt-fill-neutral-white)",
                backgroundImage: l0Pattern(color),
              }}
            />
          )}
          {weightsPct > 0 && (
            <span
              data-testid="endpoint-segment-weights-pattern"
              className="pointer-events-none absolute inset-y-0 left-0"
              style={{
                width: `${weightsPct}%`,
                backgroundColor: ownerTone(color, OWNER_WEIGHTS_TONE),
              }}
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
      {!hasComposition && actualPct != null && (
        <>
          <span
            data-testid="endpoint-segment-unused-fill"
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundColor: ownerTone(color, OWNER_SECONDARY_TONE),
            }}
          />
          <span
            data-testid="endpoint-segment-actual-fill"
            className="pointer-events-none absolute inset-y-0 left-0"
            style={{
              width: `${actualPct}%`,
              backgroundColor: color,
            }}
          />
        </>
      )}
      {actualPct != null && (
        <span
          data-testid="endpoint-segment-actual-marker"
          className="pointer-events-none absolute inset-y-px z-10 w-0.5 -translate-x-1/2 rounded-full [box-shadow:0_0_0_1px_var(--nt-fill-neutral-opaque-1)]"
          style={{
            left: `${actualPct}%`,
            backgroundColor: actualExceedsReserved
              ? "var(--nt-fill-serious-base)"
              : "var(--nt-text-neutral-super)",
          }}
        />
      )}
    </>
  );
}

function GpuActualUsageMarker({
  usedMiB,
  allocatedMiB,
  totalMiB,
}: {
  usedMiB: number;
  allocatedMiB: number | null;
  totalMiB: number;
}) {
  const percent =
    totalMiB > 0 ? Math.min(100, Math.max(0, (usedMiB / totalMiB) * 100)) : 0;
  const exceedsAllocation =
    allocatedMiB != null && allocatedMiB >= 0 && usedMiB > allocatedMiB;

  return (
    <span
      aria-hidden="true"
      data-testid="gpu-card-actual-marker"
      className="pointer-events-none absolute inset-y-px z-20 w-0.5 -translate-x-1/2 rounded-full [box-shadow:0_0_0_1px_var(--nt-fill-neutral-opaque-1)]"
      style={{
        left: `${percent}%`,
        backgroundColor: exceedsAllocation
          ? "var(--nt-fill-serious-base)"
          : "var(--nt-text-neutral-super)",
      }}
    />
  );
}

function InventoryAllocationBar({
  device,
  allocations,
  samples,
  cardUsedMiB,
  total,
  mode = "preview",
  selectedKey = null,
  onSelect,
  showLegend = false,
  showActualLegend = false,
}: {
  device: ObservedGpu;
  allocations: GpuAllocation[];
  samples: AcceleratorSample[];
  cardUsedMiB: number | null;
  total: number | null;
  /** "preview" keeps the hover layer; "select" makes each segment a control. */
  mode?: "preview" | "select";
  selectedKey?: string | null;
  onSelect?: (key: string) => void;
  showLegend?: boolean;
  showActualLegend?: boolean;
}) {
  const { t } = useTranslation();
  const [activeAllocation, setActiveAllocation] = useState<string | null>(null);
  const { visible, hidden, hiddenMemoryMiB } =
    splitGpuEndpointAllocations(allocations);
  const reserved =
    device.allocatedMiB ??
    visible.reduce((sum, allocation) => sum + allocation.memoryMiB, 0) +
      hiddenMemoryMiB;
  const actualMarker =
    cardUsedMiB != null && total != null && total > 0 ? (
      <GpuActualUsageMarker
        allocatedMiB={reserved}
        totalMiB={total}
        usedMiB={cardUsedMiB}
      />
    ) : null;
  const actualLegend =
    cardUsedMiB != null && total != null && total > 0 ? (
      <span
        data-testid="gpu-actual-usage-legend"
        className="flex items-center gap-1.5 text-[11px] leading-4 text-muted-foreground"
      >
        <span
          aria-hidden
          className="h-3 w-0.5 shrink-0 rounded-full bg-[var(--nt-text-neutral-super)] [box-shadow:0_0_0_1px_var(--nt-fill-neutral-opaque-1)]"
        />
        {t("observations.actualVramUsage")}
        <span className="font-semibold tabular-nums text-foreground">
          {gib(cardUsedMiB)}
        </span>
      </span>
    ) : null;
  if (device.allocatedMiB == null) {
    return (
      <div className="space-y-1">
        <div
          role="img"
          aria-label={t("observations.allocationUnknown")}
          className="relative h-2 rounded-full border border-dashed border-[var(--nt-stroke-neutral-trans-3)] bg-transparent"
        >
          {actualMarker}
        </div>
        <span className="text-[11px] text-muted-foreground">
          {t("observations.allocationUnknown")}
        </span>
        {(showLegend || showActualLegend) && actualLegend}
      </div>
    );
  }

  if (total == null || total <= 0) {
    return (
      <div className="space-y-1">
        <div
          role="img"
          aria-label={t("observations.physicalVramUnavailable")}
          className="h-2.5 rounded-full border border-dashed border-[var(--nt-stroke-neutral-trans-3)] bg-transparent"
          data-testid="gpu-physical-vram-unavailable"
        />
        <span className="text-[11px] text-muted-foreground">
          {t("observations.physicalVramUnavailable")}
        </span>
      </div>
    );
  }

  if (reserved === 0) {
    return (
      <div className="space-y-1">
        <div
          role="img"
          aria-label={t("observations.noEndpointAllocation")}
          className={cn("relative", "h-2.5", GPU_BAR_TRACK_CLASS)}
        >
          {actualMarker}
        </div>
        {(showLegend || showActualLegend) && actualLegend}
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div className="space-y-1">
        <div className="relative h-2 rounded-full border border-dashed border-[var(--nt-stroke-neutral-trans-3)] bg-transparent">
          {actualMarker}
        </div>
        <span className="text-[11px] text-muted-foreground">
          {t("observations.endpointAllocationUnavailable")}
        </span>
        {(showLegend || showActualLegend) && actualLegend}
      </div>
    );
  }

  const allocationWidth = (allocation: EndpointGpuAllocation) =>
    total && total > 0
      ? Math.min(100, Math.max(0, (allocation.memoryMiB / total) * 100))
      : 100 / (visible.length + Number(hidden.length > 0));

  const bar = (
    <div
      role="group"
      aria-label={t("observations.allocationByEndpoint")}
      className={cn("h-2.5", GPU_BAR_TRACK_CLASS)}
    >
      <div className="absolute inset-0 flex overflow-hidden rounded-full">
        {visible.map((allocation, segmentIndex) => {
          const segmentKey = allocationKey(allocation);
          const mark = chartCategoryMark(segmentIndex);
          const color = mark.color;
          const actualUsedMiB = endpointAllocationUsedMiB(
            samples,
            allocation,
            allocations.length,
            cardUsedMiB,
          );
          const isSelected = selectedKey === segmentKey;
          const button = (
            <button
              type="button"
              aria-pressed={mode === "select" ? isSelected : undefined}
              className={cn(
                "relative h-full shrink-0 overflow-hidden border-0 p-0 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--nt-stroke-outstanding-base)] focus-visible:outline-offset-1",
                mode === "select" && "cursor-pointer",
              )}
              style={{
                width: `${allocationWidth(allocation)}%`,
                backgroundColor: color,
                // The gap belongs between two colours, not around the bar:
                // the first segment's left edge is the track itself.
                ...(segmentIndex > 0 ? chartOutlineStyle() : {}),
              }}
              aria-label={`${allocation.endpoint}, ${gib(allocation.memoryMiB)} ${t("observations.reservedLower")}`}
              onMouseEnter={() => setActiveAllocation(segmentKey)}
              onMouseLeave={() => setActiveAllocation(null)}
              onFocus={() => setActiveAllocation(segmentKey)}
              onBlur={() => setActiveAllocation(null)}
              onClick={() => {
                if (mode === "select") {
                  onSelect?.(segmentKey);
                  return;
                }
                setActiveAllocation(segmentKey);
              }}
            >
              {(hidden.length > 0 || visible.length > 6) && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 flex items-center justify-center text-[9px] font-semibold text-white tabular-nums"
                >
                  {segmentIndex + 1}
                </span>
              )}
              {(mode === "select"
                ? isSelected || activeAllocation === segmentKey
                : activeAllocation === segmentKey) && (
                <EndpointSegmentPattern
                  allocation={allocation}
                  color={color}
                  actualUsedMiB={actualUsedMiB}
                />
              )}
              {isSelected && mode === "select" && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-[inherit] [box-shadow:inset_0_0_0_1px_var(--nt-fill-neutral-white)]"
                />
              )}
            </button>
          );

          if (mode === "select") {
            return <Fragment key={segmentKey}>{button}</Fragment>;
          }

          return (
            <HoverCard key={segmentKey} openDelay={120} closeDelay={80}>
              <HoverCardTrigger asChild>{button}</HoverCardTrigger>
              <EndpointAllocationTooltip
                allocation={allocation}
                color={color}
                actualUsedMiB={actualUsedMiB}
              />
            </HoverCard>
          );
        })}
        {hidden.length > 0 && (
          <HoverCard openDelay={120} closeDelay={80}>
            <HoverCardTrigger asChild>
              <button
                type="button"
                className="h-full shrink-0 border-0 bg-[var(--nt-chart-more)] p-0 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--nt-stroke-outstanding-base)] focus-visible:outline-offset-1"
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
                  className="pointer-events-none flex h-full items-center justify-center text-[9px] font-semibold text-[var(--nt-chart-more-foreground)] tabular-nums"
                >
                  +{hidden.length}
                </span>
              </button>
            </HoverCardTrigger>
            <HoverCardContent
              side="top"
              className="max-w-md"
              data-testid="gpu-more-preview"
            >
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
                      to={endpointHref(allocation)}
                    >
                      {allocation.endpoint}
                    </Link>
                    <span className="break-all text-[11px] text-muted-foreground">
                      {allocation.model} · {gib(allocation.memoryMiB)}
                    </span>
                  </div>
                ))}
              </div>
            </HoverCardContent>
          </HoverCard>
        )}
        {activeAllocation == null && actualMarker}
      </div>
    </div>
  );

  if (!showLegend && !showActualLegend) return bar;

  return (
    <div className="space-y-1.5">
      {bar}
      <div
        role="list"
        aria-label={t("observations.vramAllocation")}
        data-testid="vram-allocation-legend"
        className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground"
      >
        {showLegend &&
          visible.map((allocation, index) => (
            <span
              key={`${allocation.workspace}:${allocation.endpoint}`}
              role="listitem"
              className="flex min-w-0 items-center gap-1.5"
              title={`${allocation.workspace} / ${allocation.endpoint}`}
            >
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-sm"
                style={{ backgroundColor: chartCategoryMark(index).color }}
              />
              <span className="truncate">{allocation.endpoint}</span>
            </span>
          ))}
        {showLegend && hidden.length > 0 && (
          <span role="listitem" className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2 rounded-sm bg-[var(--nt-chart-more)]"
            />
            {t("observations.moreAllocations", { count: hidden.length })}
          </span>
        )}
        {actualLegend && <span role="listitem">{actualLegend}</span>}
      </div>
    </div>
  );
}

const SEGMENT_DIVIDER = CHART_SERIES_SEPARATOR;

function CompositionSegments({
  measuredPct,
  weightsPct,
  kvPct,
  color,
}: {
  measuredPct: number;
  weightsPct: number;
  kvPct: number;
  color: string;
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
            backgroundColor: ownerTone(color, OWNER_WEIGHTS_TONE),
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
            backgroundColor: "var(--nt-fill-neutral-white)",
            backgroundImage: l0Pattern(color),
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
            backgroundColor: ownerTone(color, OWNER_SECONDARY_TONE),
            borderRightColor: SEGMENT_DIVIDER,
          }}
        />
      )}
    </>
  );
}

function AllocationVram({
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
  const hasComposition = replica?.modelWeightsMiB != null;
  const share =
    actual != null && reserved != null && reserved > 0
      ? Math.min(100, (actual / reserved) * 100)
      : null;
  const actualExceedsReserved =
    actual != null && reserved != null && actual > reserved;
  const overageMiB =
    actualExceedsReserved && actual != null && reserved != null
      ? actual - reserved
      : null;
  const unused =
    actual != null && reserved != null ? Math.max(0, reserved - actual) : null;

  return (
    <div className="min-w-0 space-y-1.5">
      {/* One bar, one set of numbers: the composition is drawn inside the same
          measured bar it belongs to, instead of a second chart beside it. */}
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="whitespace-nowrap font-semibold tabular-nums text-foreground">
          {gibValue(actual)}
          <span className="font-normal text-muted-foreground">
            {" "}
            / {gibValue(reserved)} GiB
          </span>
        </span>
        <span className="shrink-0 truncate text-[11px] text-muted-foreground">
          {share != null
            ? actualExceedsReserved
              ? t("observations.usedAndExceedsReserved", {
                  percent: Math.round(share),
                  memory: gib(overageMiB),
                })
              : t("observations.actualOfReserved", {
                  percent: Math.round(share),
                })
            : t("observations.noMeasurement")}
        </span>
      </div>
      <div className={cn("h-2.5", GPU_BAR_TRACK_CLASS)}>
        <div className="absolute inset-0 overflow-hidden rounded-full">
          <div
            className="absolute inset-y-0 left-0 bg-[var(--nt-chart-series-1)] opacity-30"
            style={{ width: `${percentOf(reserved, total)}%` }}
          />
          {actual != null && (
            <div
              className="absolute inset-y-0 left-0 bg-[var(--nt-chart-series-1)]"
              style={{ width: `${percentOf(actual, total)}%` }}
            />
          )}
          {actual != null && replica && hasComposition && (
            <CompositionSegments
              measuredPct={percentOf(actual, total)}
              weightsPct={percentOf(replica.modelWeightsMiB, total)}
              kvPct={percentOf(replica.kvCacheCapacityMiB, total)}
              color={chartCategoryMark(0).color}
            />
          )}
        </div>
      </div>
      {hasComposition && (
        <p className="break-words text-[11px] leading-4 text-muted-foreground">
          {t("observations.modelWeights")} {gib(replica.modelWeightsMiB)}
          {replica.kvCacheCapacityMiB != null && (
            <>
              {" · "}
              {t("observations.l0KvCache")} {gib(replica.kvCacheCapacityMiB)}
            </>
          )}
          {unused != null && (
            <>
              {" · "}
              {t("observations.allocatedUnused")} {gib(unused)}
            </>
          )}
        </p>
      )}
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
        series="teal"
        value={reading ? reading.value * 100 : null}
        track={reading ? "outlined" : "unavailable"}
        aria-label={t("observations.utilization")}
        className={inline ? "min-w-16 flex-1" : undefined}
      />
    </div>
  );
}

function VramAllocationReading({
  allocated,
  total,
  showLabel = true,
  className,
}: {
  allocated: number | null;
  total: number | null;
  showLabel?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <div
      data-testid="vram-allocation-reading"
      className={cn(
        "flex min-w-0 items-center justify-between gap-3 text-[11px] leading-4",
        className,
      )}
    >
      {showLabel && (
        <span className="min-w-0 text-muted-foreground">
          {t("observations.vramAllocation")}
        </span>
      )}
      <span
        className={cn(
          "shrink-0 whitespace-nowrap font-semibold tabular-nums text-foreground",
          !showLabel && "ml-auto",
        )}
      >
        {t("observations.allocated")} {gibValue(allocated)}
        {" / "}
        {gibValue(total)}
        <span className="font-normal text-muted-foreground"> GiB</span>
      </span>
    </div>
  );
}

function CompactComputeAllocation({
  device,
  showLabel = true,
  className,
}: {
  device: ObservedGpu;
  showLabel?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const allocation = coreAllocation(
    device.coreUnits,
    device.availableCoreUnits,
  );
  if (!allocation) return null;
  const coreUnits = (value: number) =>
    formatToDecimal(value, Number.isInteger(value) ? 0 : 1);

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 text-[11px] leading-4",
        className,
      )}
    >
      {showLabel && (
        <span className="shrink-0 text-muted-foreground">
          {t("observations.computeShare")}
        </span>
      )}
      <MetricBar
        aria-label={t("observations.computeAllocation")}
        className="min-w-10 flex-1"
        series="cyan"
        size="sm"
        track="outlined"
        value={allocation.percent}
      />
      <strong className="min-w-12 text-right whitespace-nowrap font-semibold tabular-nums">
        {coreUnits(allocation.allocated)} / {coreUnits(allocation.total)}
      </strong>
    </div>
  );
}

function CompactUtilization({
  reading,
  showLabel = true,
  className,
}: {
  reading?: AcceleratorSample;
  showLabel?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 text-[11px] leading-4",
        className,
      )}
    >
      {showLabel && (
        <span className="shrink-0 text-muted-foreground">
          {t("observations.utilization")}
        </span>
      )}
      <MetricBar
        aria-label={t("observations.utilization")}
        className="min-w-10 flex-1"
        series="teal"
        size="sm"
        track={reading ? "outlined" : "unavailable"}
        value={reading ? reading.value * 100 : null}
      />
      <strong className="min-w-8 text-right font-semibold tabular-nums">
        {reading ? `${(reading.value * 100).toFixed(0)}%` : <EmptyValue />}
      </strong>
    </div>
  );
}

type GpuDetailsSheetProps = Pick<
  Props,
  | "device"
  | "samples"
  | "allocations"
  | "replica"
  | "tflopsOverrides"
  | "observationStatus"
  | "onRetry"
> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Side sheet with one physical GPU's live state, per-Endpoint allocation and
 * hardware details. Shared by the cluster and Endpoint runtime views. */
export function GpuDetailsSheet({
  open,
  onOpenChange,
  device,
  samples,
  allocations,
  replica,
  tflopsOverrides = {},
  observationStatus,
  onRetry,
}: GpuDetailsSheetProps) {
  const { t } = useTranslation();
  const assigned = allocations.filter(
    (allocation) =>
      allocation.node === device.node && allocation.uuid === device.uuid,
  );
  const readings = deviceReadings(device, samples, replica, assigned);
  const hardware = deviceHardwareInfo(samples, device.node, device.uuid);
  const { sorted, hidden } = splitGpuEndpointAllocations(assigned);
  const nominalTflops = peakTflops(
    device.product,
    tflopsOverrides,
    device.peakFP16TFLOPS,
  );

  // The ownership bar always describes the physical card. A lone Endpoint can
  // stay expanded without a toggle, but it still occupies one segment of that
  // card-scale track.
  const [selection, setSelection] = useState<{
    device: string;
    key: string | null;
  } | null>(null);
  const isSingleEndpoint = sorted.length === 1;
  const selectedKey = selection?.device === device.uuid ? selection.key : null;
  const toggle = (key: string) =>
    setSelection({
      device: device.uuid,
      key: selectedKey === key ? null : key,
    });

  const hardwareLabelValue = (key: string) => {
    const value = hardwareValue(hardware, key);
    if (value === true) return t("observations.present");
    if (value === false) return t("observations.absent");
    return value ?? EMPTY_VALUE;
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
  const hardwareFields = visibleHardwareFields(
    baseHardwareFields,
    extraHardwareFields,
    device.product,
    hardware,
  );
  const hardwareLabel = (key: string) =>
    t(
      extraHardwareFields.find((field) => field.key === key)?.label ??
        `observations.hardwareFields.${key}`,
    );

  const physical = readings.total;
  const reserved = device.allocatedMiB;
  const actual = readings.actual;
  const actualExceedsPhysical =
    actual != null && physical != null && actual > physical;
  const hasComputeAllocation =
    coreAllocation(device.coreUnits, device.availableCoreUnits) != null;
  const hasRuntimeMetric = Boolean(
    readings.utilization || readings.temperature || readings.power,
  );
  const isLoading = observationStatus === "loading";
  const age = sampleAge(Date.now(), [
    readings.utilization,
    readings.temperature,
    readings.power,
  ]);
  const ageLabel = (seconds: number) => {
    if (seconds < 60) return t("observations.ageSeconds", { count: seconds });
    if (seconds < 3600)
      return t("observations.ageMinutes", { count: Math.floor(seconds / 60) });
    return t("observations.ageHours", { count: Math.floor(seconds / 3600) });
  };
  const updatedAge = age ? ageLabel(age.seconds) : null;
  // Stale values are history, not state: they stay visible with a marker.
  const isStale = age?.stale ?? false;
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
            <CopyUuidButton uuid={device.uuid} index={device.index} />
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
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-4">
          <section className="rounded-md border border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-white)]">
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
                    <VramAllocationReading
                      allocated={reserved}
                      total={physical}
                    />
                    <MetricBar
                      size="sm"
                      series={actualExceedsPhysical ? "red" : "violet"}
                      value={percentOf(actual, physical)}
                      track={
                        actual != null && physical != null
                          ? "outlined"
                          : "unavailable"
                      }
                      aria-label={t("observations.actualMemory")}
                    />
                  </div>
                  <div
                    className={cn(
                      "grid grid-cols-1 gap-x-4 gap-y-2",
                      hasComputeAllocation && "sm:grid-cols-2",
                    )}
                  >
                    <CompactComputeAllocation device={device} />
                    <CompactUtilization reading={readings.utilization} />
                  </div>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-[11px] text-muted-foreground">
                        {t("observations.deviceTemperature")}
                      </dt>
                      <dd className="tabular-nums">
                        {readings.temperature ? (
                          `${readings.temperature.value.toFixed(0)} °C`
                        ) : (
                          <EmptyValue />
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-muted-foreground">
                        {t("observations.devicePower")}
                      </dt>
                      <dd className="tabular-nums">
                        {readings.power ? (
                          `${readings.power.value.toFixed(0)} W`
                        ) : (
                          <EmptyValue />
                        )}
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

          <section className="rounded-md border border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-white)]">
            <header className="flex items-center justify-between gap-2 border-b border-[var(--nt-stroke-neutral-trans-2)] px-3 py-2">
              <h3 className="text-sm font-medium">
                {t("observations.vramAllocation")}
              </h3>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {t("observations.allocated")} {gibValue(reserved)} /{" "}
                {gibValue(physical)} GiB
              </span>
            </header>
            <div className="space-y-3 px-3 py-3">
              <InventoryAllocationBar
                device={device}
                allocations={assigned}
                samples={samples}
                cardUsedMiB={readings.actual}
                total={readings.total}
                mode="select"
                selectedKey={selectedKey}
                onSelect={(key) => toggle(key)}
                showLegend
              />
              {reserved != null && physical != null && reserved > physical && (
                <p
                  role="status"
                  className="text-[11px] text-[var(--nt-text-colorful-serious)]"
                >
                  {t("observations.allocationExceedsPhysicalBy", {
                    memory: gib(reserved - physical),
                  })}
                </p>
              )}
              {sorted.length > 0 && (
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                  <span>
                    {t("observations.endpointCount", {
                      count: sorted.length,
                    })}
                  </span>
                  <span aria-hidden>·</span>
                  <span>
                    {t("observations.replicaAllocations", {
                      count: replicaCount,
                    })}
                  </span>
                  <span>
                    {t("observations.reservedTotal", {
                      memory: gib(reserved),
                    })}
                  </span>
                </p>
              )}
              {/* Cards sit flush: a divider separates rows inside one surface
                  instead of each row floating as its own bordered block. */}
              <ul className="divide-y divide-[var(--nt-stroke-neutral-trans-2)]">
                {sorted.map((allocation, sortedIndex) => {
                  const key = allocationKey(allocation);
                  const isOpen = isSingleEndpoint || selectedKey === key;
                  const index = sortedIndex + 1;
                  const mark = chartCategoryMark(index - 1);
                  const identity = (
                    <>
                      <span
                        aria-hidden
                        className="flex shrink-0 items-center gap-1"
                      >
                        <span
                          className="size-4 rounded-sm"
                          style={{ backgroundColor: mark.color }}
                        />
                        {showIndex && (
                          <span className="text-[9px] font-semibold text-muted-foreground tabular-nums">
                            {index}
                          </span>
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {allocation.endpoint}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {allocation.model || <EmptyValue />} ·{" "}
                          {allocation.workspace}
                          {allocation.allocations.length > 1
                            ? ` · ${(() => {
                                const onCard = allocation.allocations.length;
                                const total =
                                  allocation.allocations[0]?.endpointReplicas ??
                                  onCard;
                                return total > onCard
                                  ? t("observations.replicaCountOfTotal", {
                                      onCard,
                                      total,
                                    })
                                  : t("observations.replicaCountLabel", {
                                      count: onCard,
                                    });
                              })()}`
                            : (() => {
                                const onCard = allocation.allocations.length;
                                const total =
                                  allocation.allocations[0]?.endpointReplicas ??
                                  onCard;
                                if (total > onCard) {
                                  return ` · ${t(
                                    "observations.replicaCountOfTotal",
                                    { onCard, total },
                                  )}`;
                                }
                                const vdevice =
                                  allocation.allocations[0]?.vdevice;
                                return vdevice
                                  ? ` · ${t("observations.vgpuLabel")} ${vdevice}`
                                  : "";
                              })()}
                        </p>
                      </div>
                    </>
                  );

                  return (
                    <li key={key} className="bg-[var(--nt-fill-neutral-white)]">
                      <div className="flex items-center gap-2 px-3 py-2.5">
                        {isSingleEndpoint ? (
                          <div className="-mx-1 flex min-w-0 flex-1 items-center gap-2 px-1 py-0.5 text-left">
                            {identity}
                          </div>
                        ) : (
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
                            className="-mx-1 flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-0.5 text-left outline-none transition-colors hover:bg-[var(--nt-fill-neutral-trans-1)] focus-visible:[box-shadow:var(--nt-outline-active-focus)]"
                          >
                            <ChevronRight
                              aria-hidden
                              className={cn(
                                "size-3.5 shrink-0 text-muted-foreground transition-transform",
                                isOpen && "rotate-90",
                              )}
                            />
                            {identity}
                            {!isOpen && (
                              <span className="shrink-0 text-[11px] whitespace-nowrap tabular-nums text-muted-foreground">
                                {t("observations.reservedAmount", {
                                  memory: gib(allocation.memoryMiB),
                                })}
                              </span>
                            )}
                          </button>
                        )}
                        {/* The name is not a link: a stray click on a row that
                            also expands must not navigate. The arrow is the
                            single, deliberate way out. */}
                        <Link
                          to={endpointHref(allocation)}
                          aria-label={t("observations.openEndpoint", {
                            endpoint: allocation.endpoint,
                          })}
                          className="shrink-0 rounded p-0.5 text-muted-foreground outline-none hover:text-primary focus-visible:[box-shadow:var(--nt-outline-active-focus)]"
                        >
                          <ArrowUpRight aria-hidden className="size-3.5" />
                        </Link>
                      </div>
                      {isOpen && (
                        <div
                          className={cn(
                            "border-t border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-white)] py-2 pr-3",
                            isSingleEndpoint ? "pl-9" : "pl-[44px]",
                          )}
                        >
                          <div className="grid gap-2">
                            {(() => {
                              const rows = allocation.allocations.map(
                                (item) => {
                                  const sample = reading(
                                    samples,
                                    "neutree_endpoint_replica_accelerator_memory_used_bytes",
                                    item.node,
                                    item.uuid,
                                    item,
                                  );
                                  return {
                                    item,
                                    usedMiB: sample
                                      ? sample.value / 1024 ** 2
                                      : null,
                                  };
                                },
                              );
                              const known = rows.filter(
                                (row) => row.usedMiB != null,
                              );
                              const actualTotal = known.length
                                ? known.reduce(
                                    (sum, row) => sum + (row.usedMiB ?? 0),
                                    0,
                                  )
                                : null;
                              const actualPercent =
                                actualTotal != null && allocation.memoryMiB > 0
                                  ? Math.max(
                                      0,
                                      (actualTotal / allocation.memoryMiB) *
                                        100,
                                    )
                                  : null;
                              const fillPercent =
                                actualPercent == null
                                  ? null
                                  : Math.min(100, actualPercent);
                              const exceedsReserved =
                                actualPercent != null && actualPercent > 100;
                              const overageMiB =
                                actualTotal != null
                                  ? Math.max(
                                      0,
                                      actualTotal - allocation.memoryMiB,
                                    )
                                  : null;
                              const weights = allocation.modelWeightsMiB;
                              const kv = allocation.kvCacheCapacityMiB;
                              const hasComposition = weights != null;
                              const other =
                                weights != null
                                  ? Math.max(
                                      0,
                                      allocation.memoryMiB -
                                        weights -
                                        (kv ?? 0),
                                    )
                                  : null;
                              const pct = (value: number | null) =>
                                value != null && allocation.memoryMiB > 0
                                  ? Math.min(
                                      100,
                                      (value / allocation.memoryMiB) * 100,
                                    )
                                  : 0;
                              return (
                                <>
                                  {/* usage answers "how full", the bar shows the
                                      same numbers, the legend names what the bar
                                      is made of, and only then per-replica
                                      detail — each fact once, in reading order. */}
                                  <div className="flex items-baseline justify-between gap-3 text-[13px]">
                                    <span className="tabular-nums">
                                      <strong className="font-semibold">
                                        {gib(actualTotal)}
                                      </strong>
                                      <span className="text-muted-foreground">
                                        {" "}
                                        / {gib(allocation.memoryMiB)}
                                      </span>
                                    </span>
                                    <span
                                      className={cn(
                                        "text-[11px] whitespace-nowrap tabular-nums",
                                        exceedsReserved
                                          ? "text-[var(--nt-text-colorful-serious)]"
                                          : "text-muted-foreground",
                                      )}
                                    >
                                      {actualPercent != null
                                        ? exceedsReserved
                                          ? t(
                                              "observations.exceedsReservedBy",
                                              {
                                                memory: gib(overageMiB),
                                              },
                                            )
                                          : t("observations.usedShare", {
                                              percent:
                                                Math.round(actualPercent),
                                            })
                                        : t("observations.noMeasurement")}
                                    </span>
                                  </div>
                                  <div
                                    className={cn("h-2.5", GPU_BAR_TRACK_CLASS)}
                                  >
                                    <div className="absolute inset-0 flex overflow-hidden rounded-full">
                                      {hasComposition ? (
                                        <>
                                          {weights > 0 && (
                                            <span
                                              className="h-full"
                                              style={{
                                                width: `${pct(weights)}%`,
                                                backgroundColor: ownerTone(
                                                  mark.color,
                                                  OWNER_WEIGHTS_TONE,
                                                ),
                                              }}
                                            />
                                          )}
                                          {kv != null && kv > 0 && (
                                            <span
                                              className="h-full"
                                              style={{
                                                width: `${pct(kv)}%`,
                                                backgroundColor:
                                                  "var(--nt-fill-neutral-white)",
                                                backgroundImage: l0Pattern(
                                                  mark.color,
                                                ),
                                              }}
                                            />
                                          )}
                                          {other != null && other > 0 && (
                                            <span
                                              className="h-full"
                                              style={{
                                                width: `${pct(other)}%`,
                                                backgroundColor: ownerTone(
                                                  mark.color,
                                                  OWNER_SECONDARY_TONE,
                                                ),
                                              }}
                                            />
                                          )}
                                        </>
                                      ) : (
                                        <span
                                          className="h-full rounded-full"
                                          data-testid="expanded-endpoint-usage-bar"
                                          style={{
                                            width: `${fillPercent ?? 0}%`,
                                            backgroundColor: exceedsReserved
                                              ? "var(--nt-fill-serious-base)"
                                              : mark.color,
                                          }}
                                        />
                                      )}
                                    </div>
                                    {hasComposition && fillPercent != null && (
                                      <span
                                        data-testid="expanded-endpoint-actual-marker"
                                        className="pointer-events-none absolute inset-y-px z-10 w-0.5 -translate-x-1/2 rounded-full [box-shadow:0_0_0_1px_var(--nt-fill-neutral-opaque-1)]"
                                        style={{
                                          left: `${fillPercent}%`,
                                          backgroundColor: exceedsReserved
                                            ? "var(--nt-fill-serious-base)"
                                            : "var(--nt-text-neutral-super)",
                                        }}
                                      />
                                    )}
                                  </div>
                                  {hasComposition && (
                                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
                                      <span className="flex items-center gap-1.5">
                                        <span
                                          aria-hidden
                                          className="h-1.5 w-3 shrink-0 rounded-sm"
                                          style={{
                                            backgroundColor: ownerTone(
                                              mark.color,
                                              OWNER_WEIGHTS_TONE,
                                            ),
                                          }}
                                        />
                                        {t("observations.modelWeights")}
                                        <strong className="text-xs text-foreground tabular-nums">
                                          {gib(weights)}
                                        </strong>
                                      </span>
                                      {kv != null && (
                                        <span className="flex items-center gap-1.5">
                                          <span
                                            aria-hidden
                                            className="h-1.5 w-3 shrink-0 rounded-sm"
                                            style={{
                                              backgroundColor:
                                                "var(--nt-fill-neutral-white)",
                                              backgroundImage: l0Pattern(
                                                mark.color,
                                              ),
                                            }}
                                          />
                                          {t("observations.l0KvCache")}
                                          <strong className="text-xs text-foreground tabular-nums">
                                            {gib(kv)}
                                          </strong>
                                        </span>
                                      )}
                                      <span className="flex items-center gap-1.5">
                                        <span
                                          aria-hidden
                                          className="h-1.5 w-3 shrink-0 rounded-sm"
                                          style={{
                                            backgroundColor: ownerTone(
                                              mark.color,
                                              OWNER_SECONDARY_TONE,
                                            ),
                                          }}
                                        />
                                        {t("observations.otherReservation")}
                                        <strong className="text-xs text-foreground tabular-nums">
                                          {gib(other)}
                                        </strong>
                                      </span>
                                    </div>
                                  )}
                                  {rows.length > 1 && (
                                    <table className="w-full table-fixed border-collapse text-xs">
                                      <thead>
                                        <tr className="text-[10px] tracking-wide text-muted-foreground uppercase">
                                          <th className="w-[40%] pb-1 text-left font-semibold">
                                            {t("observations.replicaLabel")}
                                          </th>
                                          <th className="w-[30%] pb-1 text-right font-semibold">
                                            {t("observations.actual")}
                                          </th>
                                          <th className="w-[30%] pb-1 text-right font-semibold">
                                            {t(
                                              "observations.requestedCapacity",
                                            )}
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {rows.map(
                                          ({ item, usedMiB }, index) => (
                                            <tr
                                              key={`${item.replica}:${item.instance}`}
                                            >
                                              <td className="py-0.5 text-left text-[11px] text-muted-foreground">
                                                {index + 1}
                                                {item.vdevice
                                                  ? ` · vGPU ${item.vdevice}`
                                                  : ""}
                                              </td>
                                              <td className="py-0.5 text-right tabular-nums">
                                                {gib(usedMiB)}
                                              </td>
                                              <td className="py-0.5 text-right tabular-nums">
                                                {gib(item.memoryMiB)}
                                              </td>
                                            </tr>
                                          ),
                                        )}
                                      </tbody>
                                    </table>
                                  )}
                                </>
                              );
                            })()}
                          </div>
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

          <section className="rounded-md border border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-white)]">
            <header className="flex items-center justify-between gap-2 border-b border-[var(--nt-stroke-neutral-trans-2)] px-3 py-2">
              <h3 className="text-sm font-medium">
                {t("observations.hardware")}
              </h3>
            </header>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 px-3 py-3 text-sm sm:grid-cols-3">
              {hardwareFields.map((key) => (
                <div key={key} className="min-w-0">
                  <dt className="text-[11px] text-muted-foreground">
                    {hardwareLabel(key)}
                  </dt>
                  <dd className="break-all">{hardwareLabelValue(key)}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Copies a GPU's UUID without triggering the row or card it sits in. */
export function CopyUuidButton({
  uuid,
  index,
  size = "md",
}: {
  uuid: string;
  index: number;
  size?: "sm" | "md";
}) {
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
          className={cn(
            "shrink-0",
            size === "sm"
              ? "h-6 w-6 text-[var(--nt-text-neutral-quaternary)] hover:text-[var(--nt-text-neutral-secondary)]"
              : "h-7 w-7 text-muted-foreground",
          )}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            copy(uuid, {
              successMessage: t("clusters.messages.copyUuidSuccess"),
              errorMessage: t("clusters.messages.copyUuidFailed"),
            });
          }}
        >
          <Copy className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t("clusters.actions.copyUuid")}</TooltipContent>
    </Tooltip>
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
  const [open, setOpenState] = useState(false);
  // The sheet derives its own readings, hardware and per-Endpoint rows, so it
  // mounts on first open instead of doing that work for every closed card.
  const [sheetMounted, setSheetMounted] = useState(false);
  const setOpen = (next: boolean) => {
    if (next) setSheetMounted(true);
    setOpenState(next);
  };
  const assigned = allocations.filter(
    (allocation) =>
      allocation.node === device.node && allocation.uuid === device.uuid,
  );
  const readings = deviceReadings(device, samples, replica, assigned);
  const hasComputeAllocation =
    coreAllocation(device.coreUnits, device.availableCoreUnits) != null;
  const sheet = sheetMounted && (
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
            "relative min-w-0 cursor-pointer rounded-md border border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-opaque-1)] p-3 transition-colors hover:border-[var(--nt-stroke-outstanding-light)] hover:bg-[var(--nt-fill-outstanding-thin)]",
            device.healthy === false &&
              "bg-[var(--nt-fill-neutral-trans-3)] text-[var(--nt-text-neutral-tertiary)]",
          )}
          onClick={() => setOpen(true)}
        >
          <button
            type="button"
            aria-label={t("observations.detailsForGpu", {
              index: device.index,
            })}
            className="pointer-events-none absolute inset-0 rounded-[inherit] outline-none focus-visible:[box-shadow:inset_0_0_0_2px_var(--nt-stroke-outstanding-base)]"
            onClick={() => setOpen(true)}
          />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1">
                <span className="min-w-0 truncate text-sm font-semibold leading-5 text-foreground">
                  {t("clusters.fields.gpuNumber")} {device.index}
                </span>
                <CopyUuidButton uuid={device.uuid} index={device.index} />
              </div>
              {showProduct && <DeviceProduct device={device} />}
            </div>
            <DeviceHealth device={device} />
          </div>
          <div className="mt-3 space-y-2.5">
            <div>
              <VramAllocationReading
                allocated={device.allocatedMiB}
                total={readings.total}
                className="mb-1"
              />
              <InventoryAllocationBar
                device={device}
                allocations={assigned}
                samples={samples}
                cardUsedMiB={readings.actual}
                total={readings.total}
                showActualLegend
              />
            </div>
            <div
              className={cn(
                "grid grid-cols-1 gap-x-4 gap-y-2 border-t border-[var(--nt-stroke-neutral-trans-2)] pt-2",
                hasComputeAllocation && "sm:grid-cols-2",
              )}
            >
              <CompactComputeAllocation device={device} />
              <CompactUtilization reading={readings.utilization} />
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
          "relative cursor-pointer border-b border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-opaque-1)] py-1.5 transition-colors last:border-b-0 hover:bg-[var(--nt-fill-neutral-trans-2)]",
          device.healthy === false &&
            "bg-[var(--nt-fill-neutral-trans-3)] text-[var(--nt-text-neutral-tertiary)]",
        )}
        onClick={() => setOpen(true)}
      >
        <button
          type="button"
          aria-label={t("observations.detailsForGpu", {
            index: device.index,
          })}
          className="pointer-events-none absolute inset-0 outline-none focus-visible:[box-shadow:inset_0_0_0_2px_var(--nt-stroke-outstanding-base)]"
          onClick={() => setOpen(true)}
        />
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
                  showActualLegend
                />
              </div>
              <VramAllocationReading
                allocated={device.allocatedMiB}
                total={readings.total}
                showLabel={false}
                className="shrink-0"
              />
            </div>
            <CompactComputeAllocation device={device} showLabel={false} />
            <CompactUtilization
              reading={readings.utilization}
              showLabel={false}
            />
          </>
        ) : (
          <>
            <AllocationVram
              device={device}
              replica={replica}
              actual={readings.actual}
              total={readings.total}
            />
            <Utilization reading={readings.utilization} />
            <div className="min-w-0 text-xs">
              <div className="font-semibold tabular-nums">
                {device.coreUnits != null ? (
                  device.coreUnits === 0 ? (
                    t("observations.sharedNoLimit")
                  ) : (
                    t("observations.coreAllocation", {
                      count: device.coreUnits,
                    })
                  )
                ) : (
                  <EmptyValue />
                )}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {t("observations.computeAllocation")}
              </div>
            </div>
          </>
        )}
      </div>
      {sheet}
    </TooltipProvider>
  );
}
