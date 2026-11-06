import { Fragment, useState } from "react";
import { Link } from "react-router";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { EmptyValue } from "@/foundation/components/EmptyValue";
import {
  ACTUAL_MARKER_CLASS,
  GiB,
  GPU_BAR_TRACK_CLASS,
  OTHER_MASK,
  SEGMENT_DIVIDER,
} from "@/foundation/components/GpuObservationParts";
import {
  type AcceleratorSample,
  allocationColor,
  allocationComposition,
  allocationKey,
  type EndpointGpuAllocation,
  endpointAllocationUsedMiB,
  endpointHref,
  type GpuAllocation,
  type ObservedGpu,
  percentOf,
  splitGpuEndpointAllocations,
} from "@/foundation/lib/accelerator-observations";
import {
  CHART_STRIPES_BACKGROUND,
  chartOutlineStyle,
} from "@/foundation/lib/chart-palette";
import { useTranslation } from "@/foundation/lib/i18n";
import { formatMiBAsGiB } from "@/foundation/lib/unit";
import { cn } from "@/foundation/lib/utils";

/** Measured usage of one Endpoint on the card; only read while it is shown. */
type MeasureUsage = (allocation: EndpointGpuAllocation) => number | null;

/** Hover card body; rendered only while the card is open. */
function EndpointAllocationPreview({
  allocation,
  color,
  measure,
}: {
  allocation: EndpointGpuAllocation;
  color: string;
  measure: MeasureUsage;
}) {
  const { t } = useTranslation();
  const actualUsedMiB = measure(allocation);
  const { otherMiB, actualPct } = allocationComposition(
    allocation,
    actualUsedMiB,
  );
  const metric = (
    label: string,
    value: number | null,
    marker: { backgroundColor: string } & Record<string, string>,
    wide = false,
  ) => (
    <div className={cn("min-w-0", wide && "col-span-2")}>
      <div className="flex min-w-0 items-center gap-1.5 text-[10px] leading-4 text-muted-foreground">
        <i
          aria-hidden="true"
          className="inline-block h-1.5 w-3 shrink-0 rounded-sm"
          style={marker}
        />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-0.5 whitespace-nowrap text-xs font-semibold tabular-nums text-foreground">
        <GiB mib={value} />
      </div>
    </div>
  );

  return (
    <>
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
            <GiB mib={allocation.memoryMiB} />
          </strong>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
          {metric(t("observations.modelWeights"), allocation.modelWeightsMiB, {
            backgroundColor: color,
          })}
          {metric(
            t("observations.l0KvCacheCapacity"),
            allocation.kvCacheCapacityMiB,
            {
              backgroundColor: color,
              backgroundImage: CHART_STRIPES_BACKGROUND,
            },
          )}
          {metric(
            t("observations.otherReservation"),
            otherMiB,
            {
              backgroundColor: color,
              boxShadow: `inset 0 0 0 999px ${OTHER_MASK}`,
            },
            true,
          )}
        </div>
      </div>
      <div className="mt-2.5 border-t border-[var(--nt-stroke-neutral-trans-2)] pt-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1.5 pt-0.5">
            <span
              aria-hidden="true"
              className={cn("h-3 w-0.5 shrink-0", ACTUAL_MARKER_CLASS)}
            />
            <span className="text-[10px] leading-4 text-muted-foreground">
              {t("observations.actualVramUsage")}
            </span>
          </div>
          <div className="flex shrink-0 flex-col items-end text-right">
            <strong className="whitespace-nowrap text-sm leading-5 tabular-nums">
              <GiB mib={actualUsedMiB} />
            </strong>
            <span className="mt-0.5 whitespace-nowrap text-[10px] leading-4 text-muted-foreground">
              {actualPct == null
                ? t("observations.noMeasurement")
                : t("observations.actualOfReserved", {
                    percent: Math.round(actualPct),
                  })}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

function EndpointSegmentPattern({
  allocation,
  color,
  measure,
}: {
  allocation: EndpointGpuAllocation;
  color: string;
  measure: MeasureUsage;
}) {
  const { weightsPct, kvPct, otherPct, actualPct } = allocationComposition(
    allocation,
    measure(allocation),
  );

  return (
    <>
      {otherPct > 0 && (
        <span
          className="pointer-events-none absolute inset-y-0 right-0"
          style={{
            width: `${otherPct}%`,
            backgroundColor: color,
            boxShadow: `inset 0 0 0 999px ${OTHER_MASK}`,
          }}
        />
      )}
      {kvPct > 0 && (
        <span
          className="pointer-events-none absolute inset-y-0"
          style={{
            left: `${weightsPct}%`,
            width: `${kvPct}%`,
            backgroundColor: color,
            backgroundImage: CHART_STRIPES_BACKGROUND,
          }}
        />
      )}
      {weightsPct > 0 && (
        <span
          className="pointer-events-none absolute inset-y-0 left-0"
          style={{ width: `${weightsPct}%`, backgroundColor: color }}
        />
      )}
      {[weightsPct, weightsPct + kvPct].map((left, index) =>
        left > 0 && left < 100 ? (
          <span
            key={index}
            className="pointer-events-none absolute inset-y-0 w-px"
            style={{ left: `${left}%`, backgroundColor: SEGMENT_DIVIDER }}
          />
        ) : null,
      )}
      {actualPct != null && (
        <span
          className={cn(
            "pointer-events-none absolute inset-y-px z-10 w-0.5 -translate-x-1/2",
            ACTUAL_MARKER_CLASS,
          )}
          style={{ left: `${actualPct}%` }}
        />
      )}
    </>
  );
}

function MoreAllocations({
  hidden,
  hiddenMemoryMiB,
  widthPct,
  onActivate,
}: {
  hidden: EndpointGpuAllocation[];
  hiddenMemoryMiB: number;
  widthPct: number;
  onActivate: () => void;
}) {
  const { t } = useTranslation();
  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="h-full shrink-0 border-0 bg-[var(--nt-chart-more)] p-0 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--nt-stroke-outstanding-base)] focus-visible:outline-offset-1"
          style={{ width: `${widthPct}%` }}
          aria-label={t("observations.moreAllocationsLabel", {
            count: hidden.length,
            memory: formatMiBAsGiB(hiddenMemoryMiB),
          })}
          onMouseEnter={onActivate}
          onFocus={onActivate}
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
          {formatMiBAsGiB(hiddenMemoryMiB)} {t("observations.reservedLower")}
        </p>
        <div className="space-y-1.5">
          {hidden.map((allocation) => (
            <div key={allocationKey(allocation)} className="grid gap-0.5">
              <Link
                className="break-all font-medium text-primary hover:underline"
                to={endpointHref(allocation)}
              >
                {allocation.endpoint}
              </Link>
              <span className="break-all text-[11px] text-muted-foreground">
                {allocation.model} · {formatMiBAsGiB(allocation.memoryMiB)}
              </span>
            </div>
          ))}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

/** One GPU's reservation split by Endpoint.
 *
 * "preview" opens a hover card per segment; "select" (inside the details
 * sheet) makes each segment a toggle for the matching list row.
 */
export function GpuAllocationBar({
  device,
  assigned,
  samples,
  cardUsedMiB,
  total,
  mode = "preview",
  selectedKey = null,
  onSelect,
  showLegend = false,
}: {
  device: ObservedGpu;
  /** Allocations on this device only. */
  assigned: GpuAllocation[];
  samples: AcceleratorSample[];
  cardUsedMiB: number | null;
  total: number | null;
  mode?: "preview" | "select";
  selectedKey?: string | null;
  onSelect?: (key: string) => void;
  showLegend?: boolean;
}) {
  const { t } = useTranslation();
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const { visible, hidden, hiddenMemoryMiB } =
    splitGpuEndpointAllocations(assigned);
  const measure: MeasureUsage = (allocation) =>
    endpointAllocationUsedMiB(
      samples,
      allocation,
      assigned.length,
      cardUsedMiB,
    );
  const reserved =
    device.allocatedMiB ??
    visible.reduce((sum, allocation) => sum + allocation.memoryMiB, 0) +
      hiddenMemoryMiB;

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

  const widthOf = (memoryMiB: number) =>
    total && total > 0
      ? percentOf(memoryMiB, total)
      : 100 / (visible.length + Number(hidden.length > 0));
  const numbered = hidden.length > 0 || visible.length > 6;

  const bar = (
    <div
      role="group"
      aria-label={t("observations.allocationByEndpoint")}
      className={cn("h-2.5", GPU_BAR_TRACK_CLASS)}
    >
      <div className="absolute inset-0 flex overflow-hidden rounded-full">
        {visible.map((allocation, position) => {
          const key = allocationKey(allocation);
          const color = allocationColor(allocation.endpoint, position);
          const isSelected = mode === "select" && selectedKey === key;
          const button = (
            <button
              type="button"
              aria-pressed={mode === "select" ? isSelected : undefined}
              className={cn(
                "relative h-full shrink-0 overflow-hidden border-0 p-0 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--nt-stroke-outstanding-base)] focus-visible:outline-offset-1",
                mode === "select" && "cursor-pointer",
              )}
              style={{
                width: `${widthOf(allocation.memoryMiB)}%`,
                backgroundColor: color,
                // The gap belongs between two colours, not around the bar:
                // the first segment's left edge is the track itself.
                ...(position > 0 ? chartOutlineStyle() : {}),
              }}
              aria-label={`${allocation.endpoint}, ${formatMiBAsGiB(allocation.memoryMiB)} ${t("observations.reservedLower")}`}
              onMouseEnter={() => setActiveKey(key)}
              onMouseLeave={() => setActiveKey(null)}
              onFocus={() => setActiveKey(key)}
              onBlur={() => setActiveKey(null)}
              onClick={() => {
                if (mode === "select") onSelect?.(key);
                else setActiveKey(key);
              }}
            >
              {numbered && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 flex items-center justify-center text-[9px] font-semibold text-white tabular-nums"
                >
                  {position + 1}
                </span>
              )}
              {(isSelected || activeKey === key) && (
                <EndpointSegmentPattern
                  allocation={allocation}
                  color={color}
                  measure={measure}
                />
              )}
              {isSelected && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-[inherit] [box-shadow:inset_0_0_0_1px_var(--nt-fill-neutral-white)]"
                />
              )}
            </button>
          );

          if (mode === "select") return <Fragment key={key}>{button}</Fragment>;

          return (
            <HoverCard key={key} openDelay={120} closeDelay={80}>
              <HoverCardTrigger asChild>{button}</HoverCardTrigger>
              <HoverCardContent
                side="top"
                className="w-[300px] max-w-[calc(100vw-32px)] p-3"
                data-testid="endpoint-allocation-preview"
              >
                <EndpointAllocationPreview
                  allocation={allocation}
                  color={color}
                  measure={measure}
                />
              </HoverCardContent>
            </HoverCard>
          );
        })}
        {hidden.length > 0 && (
          <MoreAllocations
            hidden={hidden}
            hiddenMemoryMiB={hiddenMemoryMiB}
            widthPct={widthOf(hiddenMemoryMiB)}
            onActivate={() => setActiveKey(null)}
          />
        )}
      </div>
    </div>
  );

  if (!showLegend) return bar;

  const active = visible.find(
    (allocation) => allocationKey(allocation) === activeKey,
  );
  const activeMeasured = active != null && measure(active) != null;

  return (
    <div className="space-y-1.5">
      {bar}
      <div
        role="list"
        aria-label={t("observations.vramAllocation")}
        data-testid="vram-allocation-legend"
        className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground"
      >
        {visible.map((allocation, position) => (
          <span
            key={allocationKey(allocation)}
            role="listitem"
            className="flex min-w-0 items-center gap-1.5"
            title={`${allocation.workspace} / ${allocation.endpoint}`}
          >
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-sm"
              style={{
                backgroundColor: allocationColor(allocation.endpoint, position),
              }}
            />
            <span className="truncate">{allocation.endpoint}</span>
          </span>
        ))}
        {hidden.length > 0 && (
          <span role="listitem" className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2 rounded-sm bg-[var(--nt-chart-more)]"
            />
            {t("observations.moreAllocations", { count: hidden.length })}
          </span>
        )}
        {activeMeasured && (
          <span role="listitem" className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn("h-3 w-0.5 shrink-0", ACTUAL_MARKER_CLASS)}
            />
            {t("observations.actualVramUsage")}
          </span>
        )}
      </div>
    </div>
  );
}
