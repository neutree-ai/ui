import { ArrowUpRight, ChevronRight } from "lucide-react";
import { type CSSProperties, type ReactNode, useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { EMPTY_VALUE, EmptyValue } from "@/foundation/components/EmptyValue";
import { GpuAllocationBar } from "@/foundation/components/GpuAllocationBar";
import {
  ACTUAL_MARKER_CLASS,
  CopyUuidButton,
  DeviceHealth,
  formatUtilization,
  GiB,
  GiBValue,
  GPU_BAR_TRACK_CLASS,
} from "@/foundation/components/GpuObservationParts";
import { MetricBar } from "@/foundation/components/MetricBar";
import { extraHardwareFields } from "@/foundation/lib/accelerator-extra-info";
import {
  type AcceleratorSample,
  allocationColor,
  allocationComposition,
  allocationFallbackReadings,
  allocationKey,
  type DeviceReadings,
  deviceReadings,
  type EndpointGpuAllocation,
  endpointHref,
  type GpuAllocation,
  hardwareValue,
  type ObservedGpu,
  replicaSummary,
  replicaUsage,
  sampleAge,
  splitGpuEndpointAllocations,
} from "@/foundation/lib/accelerator-observations";
import { peakTflops } from "@/foundation/lib/accelerator-tflops";
import { CHART_STRIPES_BACKGROUND } from "@/foundation/lib/chart-palette";
import { useTranslation } from "@/foundation/lib/i18n";
import { formatMiBAsGiB } from "@/foundation/lib/unit";
import { cn } from "@/foundation/lib/utils";

type DetailsProps = {
  device: ObservedGpu;
  samples: AcceleratorSample[];
  /** Allocations on this device only. */
  assigned: GpuAllocation[];
  replica?: GpuAllocation;
  tflopsOverrides?: Record<string, number>;
  observationStatus?: string;
  onRetry?: () => void;
};

type Selection = { device: string; key: string | null } | null;

const SECTION_CLASS =
  "rounded-md border border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-white)]";
const SECTION_HEADER_CLASS =
  "flex items-center justify-between gap-2 border-b border-[var(--nt-stroke-neutral-trans-2)] px-3 py-2";

const BASE_HARDWARE_FIELDS = [
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

/** The details sheet of one GPU. Its content is only built while it is open. */
export function GpuDetailsSheet({
  open,
  onOpenChange,
  ...props
}: DetailsProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // Kept outside the content so a reopened sheet shows the same Endpoint.
  const [selection, setSelection] = useState<Selection>(null);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-[680px]">
        <GpuDetails
          {...props}
          selection={selection}
          onSelectionChange={setSelection}
        />
      </SheetContent>
    </Sheet>
  );
}

function GpuDetails({
  device,
  samples,
  assigned,
  replica,
  tflopsOverrides,
  observationStatus,
  onRetry,
  selection,
  onSelectionChange,
}: DetailsProps & {
  selection: Selection;
  onSelectionChange: (selection: Selection) => void;
}) {
  const { t } = useTranslation();
  const directReadings = deviceReadings(device, samples, replica);
  const allocationReadings = allocationFallbackReadings(samples, assigned);
  const readings = {
    ...directReadings,
    actual: directReadings.actual ?? allocationReadings.memoryUsedMiB,
    utilization:
      directReadings.utilization ??
      (allocationReadings.utilization
        ? { ...allocationReadings.utilization }
        : undefined),
  };
  const { sorted, hidden } = splitGpuEndpointAllocations(assigned);

  // One Endpoint at a time, and only one: the bar establishes the relationship
  // between allocations, the list opens one object. A single Endpoint opens by
  // default because there is nothing to disambiguate; several start collapsed.
  // The choice is scoped to the device so opening another GPU never inherits it.
  const selectedKey =
    selection?.device === device.uuid
      ? selection.key
      : sorted.length === 1
        ? allocationKey(sorted[0])
        : null;
  const toggle = (key: string) =>
    onSelectionChange({
      device: device.uuid,
      key: selectedKey === key ? null : key,
    });

  return (
    <>
      <SheetHeader className="space-y-1.5 text-left">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {t("observations.deviceEyebrow")}
        </p>
        <SheetTitle className="flex flex-wrap items-center gap-2">
          <span className="rounded border border-[var(--nt-stroke-neutral-trans-3)] bg-[var(--nt-fill-neutral-opaque-2)] px-1.5 py-0.5 text-xs font-semibold tabular-nums">
            {t("clusters.fields.gpuNumber")} {device.index}
          </span>
          <CopyUuidButton device={device} />
          <span className="break-all">{device.product || <EmptyValue />}</span>
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
        <LiveStateSection
          device={device}
          readings={readings}
          nominalTflops={peakTflops(
            device.product,
            tflopsOverrides,
            device.peakFP16TFLOPS,
          )}
          observationStatus={observationStatus}
          onRetry={onRetry}
        />
        <section className={SECTION_CLASS}>
          <header className={SECTION_HEADER_CLASS}>
            <h3 className="text-sm font-medium">
              {t("observations.vramAllocation")}
            </h3>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {t("observations.allocated")}{" "}
              <GiBValue mib={device.allocatedMiB} /> /{" "}
              <GiBValue mib={readings.total} /> GiB
            </span>
          </header>
          <div className="space-y-3 px-3 py-3">
            <GpuAllocationBar
              device={device}
              assigned={assigned}
              samples={samples}
              cardUsedMiB={readings.actual}
              total={readings.total}
              mode="select"
              selectedKey={selectedKey}
              onSelect={toggle}
              showLegend
            />
            {sorted.length > 0 && (
              <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>
                  {t("observations.endpointCount", { count: sorted.length })}
                </span>
                <span>
                  {t("observations.reservedTotal", {
                    memory: formatMiBAsGiB(device.allocatedMiB) ?? EMPTY_VALUE,
                  })}
                </span>
              </p>
            )}
            {/* Cards sit flush: a divider separates rows inside one surface
                instead of each row floating as its own bordered block. */}
            <ul className="divide-y divide-[var(--nt-stroke-neutral-trans-2)]">
              {sorted.map((allocation, position) => (
                <EndpointAllocationRow
                  key={allocationKey(allocation)}
                  allocation={allocation}
                  position={position}
                  showIndex={hidden.length > 0}
                  isOpen={selectedKey === allocationKey(allocation)}
                  onToggle={toggle}
                  samples={samples}
                />
              ))}
            </ul>
            {sorted.length === 0 &&
              device.allocatedMiB != null &&
              device.allocatedMiB > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t("observations.endpointAllocationUnavailable")}
                </p>
              )}
          </div>
        </section>
        <HardwareSection hardware={readings.hardware} />

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span>
            {t("observations.endpointCount", { count: sorted.length })} ·{" "}
            {t("observations.replicaAllocations", { count: assigned.length })}
          </span>
          <span className="font-mono">{device.uuid}</span>
        </div>
      </div>
    </>
  );
}

function LiveStateSection({
  device,
  readings,
  nominalTflops,
  observationStatus,
  onRetry,
}: {
  device: ObservedGpu;
  readings: DeviceReadings;
  nominalTflops: number | null;
  observationStatus?: string;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  const { utilization, temperature, power } = readings;
  const age = sampleAge(Date.now(), [utilization, temperature, power]);
  const ageLabel = (seconds: number) => {
    if (seconds < 60) return t("observations.ageSeconds", { count: seconds });
    if (seconds < 3600)
      return t("observations.ageMinutes", { count: Math.floor(seconds / 60) });
    return t("observations.ageHours", { count: Math.floor(seconds / 3600) });
  };
  const estimatedTflops =
    nominalTflops != null && utilization
      ? nominalTflops * utilization.value
      : null;
  const stat = (label: string, value: ReactNode) => (
    <div>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );

  let body: ReactNode;
  if (observationStatus === "loading") {
    body = (
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
    );
  } else if (utilization || temperature || power) {
    body = (
      <>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">
              {t("observations.utilization")}
            </span>
            <span className="text-sm font-semibold tabular-nums">
              {utilization ? (
                formatUtilization(utilization.value)
              ) : (
                <EmptyValue />
              )}
            </span>
          </div>
          <MetricBar
            size="sm"
            series="teal"
            value={utilization ? utilization.value * 100 : null}
            track={utilization ? "outlined" : "unavailable"}
            aria-label={t("observations.utilization")}
          />
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {stat(
            t("observations.vramActualOfTotal"),
            <>
              <GiBValue mib={readings.actual} />{" "}
              <span className="text-muted-foreground">
                / <GiBValue mib={readings.total} /> GiB
              </span>
            </>,
          )}
          {stat(
            t("observations.acceleratorCore"),
            device.coreUnits != null ? `${device.coreUnits}%` : <EmptyValue />,
          )}
          {stat(
            t("observations.deviceTemperature"),
            temperature ? `${temperature.value.toFixed(0)} °C` : <EmptyValue />,
          )}
          {stat(
            t("observations.devicePower"),
            power ? `${power.value.toFixed(0)} W` : <EmptyValue />,
          )}
        </dl>
        <div>
          <p className="text-[11px] text-muted-foreground">
            {t("observations.fp16Estimate")}
          </p>
          <p className="text-sm tabular-nums">
            {estimatedTflops != null ? (
              estimatedTflops.toFixed(1)
            ) : (
              <EmptyValue />
            )}{" "}
            /{" "}
            {nominalTflops != null ? nominalTflops.toFixed(1) : <EmptyValue />}{" "}
            {t("observations.tflopsPeak")}
          </p>
        </div>
      </>
    );
  } else {
    body = (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          {t(
            observationStatus === "unavailable" ||
              observationStatus === "not_configured"
              ? `observations.status.${observationStatus}`
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
    );
  }

  return (
    <section className={SECTION_CLASS}>
      <header className={SECTION_HEADER_CLASS}>
        <h3 className="text-sm font-medium">
          {t("observations.liveResourceState")}
        </h3>
        {age && (
          <span className="flex items-center gap-1.5 text-[11px] whitespace-nowrap text-muted-foreground">
            {t("observations.updatedAgo", { age: ageLabel(age.seconds) })}
            {age.stale && (
              <span className="rounded-sm border border-[var(--nt-stroke-neutral-trans-3)] px-1 text-[10px] font-medium">
                {t("observations.staleSample")}
              </span>
            )}
          </span>
        )}
      </header>
      <div className="space-y-3 px-3 py-3">{body}</div>
    </section>
  );
}

function EndpointAllocationRow({
  allocation,
  position,
  showIndex,
  isOpen,
  onToggle,
  samples,
}: {
  allocation: EndpointGpuAllocation;
  position: number;
  showIndex: boolean;
  isOpen: boolean;
  onToggle: (key: string) => void;
  samples: AcceleratorSample[];
}) {
  const { t } = useTranslation();
  const color = allocationColor(position);
  const summary = replicaSummary(allocation);
  const summaryText =
    summary?.kind === "ofTotal"
      ? t("observations.replicaCountOfTotal", {
          onCard: summary.onCard,
          total: summary.total,
        })
      : summary?.kind === "count"
        ? t("observations.replicaCountLabel", { count: summary.count })
        : summary?.kind === "vgpu"
          ? `${t("observations.vgpuLabel")} ${summary.vdevice}`
          : null;

  return (
    <li className="bg-[var(--nt-fill-neutral-white)]">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-label={t(
            isOpen
              ? "observations.collapseAllocation"
              : "observations.expandAllocation",
            { endpoint: allocation.endpoint },
          )}
          onClick={() => onToggle(allocationKey(allocation))}
          className="-mx-1 flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-0.5 text-left outline-none transition-colors hover:bg-[var(--nt-fill-neutral-trans-1)] focus-visible:[box-shadow:var(--nt-outline-active-focus)]"
        >
          <ChevronRight
            aria-hidden
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground transition-transform",
              isOpen && "rotate-90",
            )}
          />
          <span aria-hidden className="flex shrink-0 items-center gap-1">
            <span
              className="size-4 rounded-sm"
              style={{ backgroundColor: color }}
            />
            {showIndex && (
              <span className="text-[9px] font-semibold text-muted-foreground tabular-nums">
                {position + 1}
              </span>
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {allocation.endpoint}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {allocation.model || <EmptyValue />} · {allocation.workspace}
              {summaryText && ` · ${summaryText}`}
            </p>
          </div>
          {!isOpen && (
            <span className="shrink-0 text-[11px] whitespace-nowrap tabular-nums text-muted-foreground">
              {t("observations.reservedAmount", {
                memory: formatMiBAsGiB(allocation.memoryMiB),
              })}
            </span>
          )}
        </button>
        {/* The name is not a link: a stray click on a row that also expands
            must not navigate. The arrow is the single, deliberate way out. */}
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
        <ExpandedAllocation
          allocation={allocation}
          color={color}
          samples={samples}
        />
      )}
    </li>
  );
}

function ExpandedAllocation({
  allocation,
  color,
  samples,
}: {
  allocation: EndpointGpuAllocation;
  color: string;
  samples: AcceleratorSample[];
}) {
  const { t } = useTranslation();
  const { rows, usedMiB } = replicaUsage(samples, allocation);
  const { weightsPct, kvPct, otherPct, otherMiB, actualPct } =
    allocationComposition(allocation, usedMiB);
  const swatch = (style: CSSProperties, className?: string) => (
    <span
      aria-hidden
      className={cn("h-1.5 w-3 shrink-0 rounded-sm", className)}
      style={style}
    />
  );
  const legendItem = (marker: ReactNode, label: string, mib: number | null) => (
    <span className="flex items-center gap-1.5">
      {marker}
      {label}
      <strong className="text-xs text-foreground tabular-nums">
        <GiB mib={mib} />
      </strong>
    </span>
  );

  return (
    <div className="border-t border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-white)] py-2 pr-3 pl-[44px]">
      {/* usage answers "how full", the bar shows the same numbers, the legend
          names what the bar is made of, and only then per-replica detail —
          each fact once, in reading order. */}
      <div className="grid gap-2">
        <div className="flex items-baseline justify-between gap-3 text-[13px]">
          <span className="tabular-nums">
            <strong className="font-semibold">
              <GiB mib={usedMiB} />
            </strong>
            <span className="text-muted-foreground">
              {" "}
              / {formatMiBAsGiB(allocation.memoryMiB)}
            </span>
          </span>
          <span className="text-[11px] whitespace-nowrap text-muted-foreground tabular-nums">
            {actualPct != null
              ? t("observations.usedShare", { percent: Math.round(actualPct) })
              : t("observations.noMeasurement")}
          </span>
        </div>
        <div className={cn("h-2.5", GPU_BAR_TRACK_CLASS)}>
          <div className="absolute inset-0 flex overflow-hidden rounded-full">
            {weightsPct > 0 && (
              <span
                className="h-full"
                style={{ width: `${weightsPct}%`, backgroundColor: color }}
              />
            )}
            {kvPct > 0 && (
              <span
                className="h-full"
                style={{
                  width: `${kvPct}%`,
                  backgroundColor: color,
                  backgroundImage: CHART_STRIPES_BACKGROUND,
                }}
              />
            )}
            {otherPct > 0 && (
              <span
                className="h-full bg-[var(--nt-fill-neutral-trans-5)]"
                style={{ width: `${otherPct}%` }}
              />
            )}
          </div>
          {actualPct != null && (
            <span
              className={cn(
                "pointer-events-none absolute inset-y-px z-10 w-0.5 -translate-x-1/2",
                ACTUAL_MARKER_CLASS,
              )}
              style={{ left: `${actualPct}%` }}
            />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
          {legendItem(
            swatch({ backgroundColor: color }),
            t("observations.modelWeights"),
            allocation.modelWeightsMiB,
          )}
          {legendItem(
            swatch({
              backgroundColor: color,
              backgroundImage: CHART_STRIPES_BACKGROUND,
            }),
            t("observations.l0KvCache"),
            allocation.kvCacheCapacityMiB,
          )}
          {legendItem(
            swatch({}, "bg-[var(--nt-fill-neutral-trans-5)]"),
            t("observations.otherReservation"),
            otherMiB,
          )}
        </div>
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
                  {t("observations.requestedCapacity")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ item, usedMiB: replicaMiB }, index) => (
                <tr key={`${item.replica}:${item.instance}`}>
                  <td className="py-0.5 text-left text-[11px] text-muted-foreground">
                    {index + 1}
                    {item.vdevice ? ` · vGPU ${item.vdevice}` : ""}
                  </td>
                  <td className="py-0.5 text-right tabular-nums">
                    <GiB mib={replicaMiB} />
                  </td>
                  <td className="py-0.5 text-right tabular-nums">
                    {formatMiBAsGiB(item.memoryMiB)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function HardwareSection({ hardware }: { hardware: Record<string, string> }) {
  const { t } = useTranslation();
  const fields = [
    ...BASE_HARDWARE_FIELDS.map((key) => ({
      key,
      label: `observations.hardwareFields.${key}`,
    })),
    ...extraHardwareFields,
  ];
  const shown = (key: string) => {
    const value = hardwareValue(hardware, key);
    if (typeof value === "boolean")
      return t(value ? "observations.present" : "observations.absent");
    return value ?? <EmptyValue />;
  };

  return (
    <section className={SECTION_CLASS}>
      <header className={SECTION_HEADER_CLASS}>
        <h3 className="text-sm font-medium">{t("observations.hardware")}</h3>
      </header>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 px-3 py-3 text-sm sm:grid-cols-3">
        {fields.map(({ key, label }) => (
          <div key={key} className="min-w-0">
            <dt className="text-[11px] text-muted-foreground">{t(label)}</dt>
            <dd className="break-all">{shown(key)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
