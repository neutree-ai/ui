import { useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EmptyValue } from "@/foundation/components/EmptyValue";
import { GpuAllocationBar } from "@/foundation/components/GpuAllocationBar";
import { GpuDetailsSheet } from "@/foundation/components/GpuDetailsSheet";
import {
  CopyUuidButton,
  DeviceHealth,
  DeviceProduct,
  formatUtilization,
  GiB,
  GiBValue,
  GPU_BAR_TRACK_CLASS,
  OTHER_MASK,
  SEGMENT_DIVIDER,
} from "@/foundation/components/GpuObservationParts";
import { MetricBar } from "@/foundation/components/MetricBar";
import {
  type AcceleratorSample,
  allocationComposition,
  deviceReadings,
  type GpuAllocation,
  type ObservedGpu,
  percentOf,
} from "@/foundation/lib/accelerator-observations";
import { CHART_STRIPES_BACKGROUND } from "@/foundation/lib/chart-palette";
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
  "grid min-w-[784px] grid-cols-[minmax(180px,1.15fr)_86px_minmax(280px,1.8fr)_minmax(190px,1.3fr)] items-center gap-3 px-4";
const ALLOCATION_GRID =
  "grid min-w-[644px] grid-cols-[minmax(150px,1.1fr)_minmax(230px,1.9fr)_120px_90px] items-center gap-3 px-4";

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
        <CopyUuidButton device={device} />
        {showHealth && device.healthy != null && (
          <DeviceHealth device={device} className="shrink-0" />
        )}
      </div>
      {showProduct && <DeviceProduct device={device} />}
    </div>
  );
}

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
          className="pointer-events-none absolute inset-y-0 left-0 border-r"
          style={{
            width: `${weights}%`,
            borderRightColor: SEGMENT_DIVIDER,
          }}
        />
      )}
      {kv > 0 && (
        <div
          className="pointer-events-none absolute inset-y-0 border-r"
          style={{
            left: `${weights}%`,
            width: `${kv}%`,
            backgroundImage: CHART_STRIPES_BACKGROUND,
            borderRightColor: SEGMENT_DIVIDER,
          }}
        />
      )}
      {other > 0 && (
        <div
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
  const hasComposition =
    replica?.modelWeightsMiB != null && replica.kvCacheCapacityMiB != null;
  const share = allocationComposition(
    { memoryMiB: reserved ?? 0 },
    actual,
  ).actualPct;
  const unused =
    actual != null && reserved != null ? Math.max(0, reserved - actual) : null;

  return (
    <div className="min-w-0 space-y-1.5">
      {/* One bar, one set of numbers: the composition is drawn inside the same
          measured bar it belongs to, instead of a second chart beside it. */}
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="whitespace-nowrap font-semibold tabular-nums text-foreground">
          <GiBValue mib={actual} />
          <span className="font-normal text-muted-foreground">
            {" "}
            / <GiBValue mib={reserved} /> GiB
          </span>
        </span>
        <span className="shrink-0 truncate text-[11px] text-muted-foreground">
          {share != null
            ? t("observations.actualOfReserved", {
                percent: Math.round(share),
              })
            : t("observations.noMeasurement")}
        </span>
      </div>
      <div className={cn("h-2.5", GPU_BAR_TRACK_CLASS)}>
        <div className="absolute inset-0 overflow-hidden rounded-full">
          <div
            className="absolute inset-y-0 left-0 bg-[var(--nt-chart-cat-1)] opacity-30"
            style={{ width: `${percentOf(reserved, total)}%` }}
          />
          {actual != null && (
            <div
              className="absolute inset-y-0 left-0 bg-[var(--nt-chart-cat-1)]"
              style={{ width: `${percentOf(actual, total)}%` }}
            />
          )}
          {actual != null && replica && hasComposition && (
            <CompositionSegments
              measuredPct={percentOf(actual, total)}
              weightsPct={percentOf(replica.modelWeightsMiB, total)}
              kvPct={percentOf(replica.kvCacheCapacityMiB, total)}
            />
          )}
        </div>
      </div>
      {hasComposition && (
        <p className="break-words text-[11px] leading-4 text-muted-foreground">
          {t("observations.modelWeights")} <GiB mib={replica.modelWeightsMiB} />{" "}
          · {t("observations.l0KvCache")}{" "}
          <GiB mib={replica.kvCacheCapacityMiB} />
          {unused != null && (
            <>
              {" · "}
              {t("observations.allocatedUnused")} <GiB mib={unused} />
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
        {reading ? formatUtilization(reading.value) : <EmptyValue />}
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
  const readings = deviceReadings(device, samples, replica);
  const assigned = allocations.filter(
    (allocation) =>
      allocation.node === device.node && allocation.uuid === device.uuid,
  );
  const allocationBar = (
    <GpuAllocationBar
      device={device}
      assigned={assigned}
      samples={samples}
      cardUsedMiB={readings.actual}
      total={readings.total}
    />
  );
  const reservedOfTotal = (
    <>
      <GiBValue mib={device.allocatedMiB} />
      <span className="font-normal text-muted-foreground">
        {" "}
        / <GiBValue mib={readings.total} /> GiB
      </span>
    </>
  );
  const sheet = (
    <GpuDetailsSheet
      open={open}
      onOpenChange={setOpen}
      device={device}
      samples={samples}
      assigned={assigned}
      replica={replica}
      tflopsOverrides={tflopsOverrides}
      observationStatus={observationStatus}
      onRetry={onRetry}
    />
  );
  const detailsButton = (className: string) => (
    <button
      type="button"
      aria-label={t("observations.detailsForGpu", { index: device.index })}
      className={cn(
        "pointer-events-none absolute inset-0 outline-none focus-visible:[box-shadow:inset_0_0_0_2px_var(--nt-stroke-outstanding-base)]",
        className,
      )}
      onClick={() => setOpen(true)}
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
          {detailsButton("rounded-[inherit]")}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1">
                <span className="min-w-0 truncate text-sm font-semibold leading-5 text-foreground">
                  {t("clusters.fields.gpuNumber")} {device.index}
                </span>
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
                  {reservedOfTotal}
                </span>
              </div>
              {allocationBar}
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
          "relative cursor-pointer border-b border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-opaque-1)] py-1.5 transition-colors last:border-b-0 hover:bg-[var(--nt-fill-neutral-trans-2)]",
          device.healthy === false &&
            "bg-[var(--nt-fill-neutral-trans-3)] text-[var(--nt-text-neutral-tertiary)]",
        )}
        onClick={() => setOpen(true)}
      >
        {detailsButton("")}
        <DeviceIdentity
          device={device}
          showHealth={variant !== "inventory"}
          showProduct={variant !== "inventory" || showProduct}
        />

        {variant === "inventory" ? (
          <>
            <DeviceHealth device={device} />
            <div className="flex min-w-0 items-center gap-3">
              <div className="min-w-0 flex-1">{allocationBar}</div>
              <span className="shrink-0 whitespace-nowrap text-xs font-semibold tabular-nums text-foreground">
                {reservedOfTotal}
              </span>
            </div>
            <Utilization reading={readings.utilization} inline />
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
      </div>
      {sheet}
    </TooltipProvider>
  );
}
