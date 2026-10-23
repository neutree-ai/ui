import { ArrowUpRight } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Link } from "react-router";
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
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  type AcceleratorSample,
  allocationColor,
  type GpuAllocation,
  reading,
} from "@/foundation/lib/accelerator-observations";
import { peakTflops } from "@/foundation/lib/accelerator-tflops";
import { useTranslation } from "@/foundation/lib/i18n";
import { MetricBar } from "./MetricBar";

export type ObservedGpu = {
  node: string;
  uuid: string;
  index: number;
  product: string;
  totalMiB: number | null;
  allocatedMiB: number | null;
  healthy?: boolean;
};
type Props = {
  device: ObservedGpu;
  samples: AcceleratorSample[];
  allocations: GpuAllocation[];
  replica?: GpuAllocation;
  tflopsOverrides?: Record<string, number>;
  detailsTrigger?: ReactNode;
};
const gib = (mib: number | null | undefined) =>
  mib == null ? "—" : `${(mib / 1024).toFixed(1)} GiB`;
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

export function GpuObservationCard({
  device,
  samples,
  allocations,
  replica,
  tflopsOverrides = {},
  detailsTrigger,
}: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const get = (name: string) =>
    reading(
      samples,
      name,
      device.node,
      device.uuid,
      name.startsWith("neutree_endpoint_") ? replica : undefined,
    );
  const used = get(
    replica
      ? "neutree_endpoint_replica_accelerator_memory_used_bytes"
      : "neutree_accelerator_memory_used_bytes",
  );
  const utilization = get(
    replica
      ? "neutree_endpoint_replica_accelerator_utilization_ratio"
      : "neutree_accelerator_utilization_ratio",
  );
  const nominalTflops = peakTflops(device.product, tflopsOverrides);
  const physical = get("neutree_accelerator_memory_total_bytes");
  const total = physical ? physical.value / 1024 ** 2 : device.totalMiB;
  const actual = used ? used.value / 1024 ** 2 : null;
  const temperature = get("neutree_accelerator_temperature_celsius");
  const power = get("neutree_accelerator_power_usage_watts");
  const hardware = Object.assign(
    {},
    ...[
      "neutree_node_accelerator_hardware_info",
      "neutree_node_accelerator_nvidia_info",
      "neutree_node_accelerator_npu_info",
      "neutree_node_accelerator_hcu_info",
    ].map((name) => get(name)?.labels ?? {}),
  ) as Record<string, string>;
  const assigned = allocations.filter(
    (a) => a.node === device.node && a.uuid === device.uuid,
  );
  // Both values come from the engine's startup log. The L0 KV-Cache is the
  // pool vLLM pre-allocates at startup; its live usage ratio only counts
  // in-flight requests, so it is deliberately not used as a fallback here.
  const weightsText = (a: GpuAllocation) => gib(a.modelWeightsMiB);
  const l0KvText = (a: GpuAllocation) => gib(a.kvCacheCapacityMiB);
  const hasComposition = (a?: GpuAllocation) =>
    a?.modelWeightsMiB != null && a.kvCacheCapacityMiB != null;
  const activeAllocation =
    replica ?? (assigned.length === 1 ? assigned[0] : undefined);
  const multiBar =
    assigned.length > 0 &&
    !replica &&
    (assigned.length === 1 ||
      assigned.some((a) =>
        Boolean(
          reading(
            samples,
            "neutree_endpoint_replica_accelerator_memory_used_bytes",
            device.node,
            device.uuid,
            a,
          ),
        ),
      ));
  const assignedUsedMiB = (a: GpuAllocation) => {
    const measured = reading(
      samples,
      "neutree_endpoint_replica_accelerator_memory_used_bytes",
      device.node,
      device.uuid,
      a,
    );
    return measured
      ? measured.value / 1024 ** 2
      : assigned.length === 1
        ? actual
        : null;
  };
  // Segments are only drawn on top of a real measurement, never on their own.
  const showLegend = multiBar
    ? assigned.some((a) => hasComposition(a) && assignedUsedMiB(a) != null)
    : actual != null && hasComposition(activeAllocation);
  const label = (value?: string) =>
    !value || value === "unknown" || value === "-1" ? "—" : value;
  const utilizationText = utilization
    ? `${(utilization.value * 100).toFixed(0)}%`
    : "—";
  const hardwareFields = [
    ...(get("neutree_node_accelerator_nvidia_info")
      ? [
          "architecture",
          "cuda_capability",
          "cuda_driver_version",
          "nvlink",
          "nvswitch",
        ]
      : []),
    ...(get("neutree_node_accelerator_npu_info") ? ["hccs_capable"] : []),
    "driver_version",
    "pcie_bus_id",
    "pcie_generation",
    "pcie_width",
    "numa_node",
  ];
  const hardwareLabel = (key: string) => {
    const value = hardware[key];
    if (["nvlink", "nvswitch", "hccs_capable"].includes(key)) {
      return value === "1"
        ? t(
            key === "hccs_capable"
              ? "observations.supported"
              : "observations.present",
          )
        : value === "0"
          ? t(
              key === "hccs_capable"
                ? "observations.unsupported"
                : "observations.absent",
            )
          : "—";
    }
    return label(value);
  };
  const memory = (
    <div className="space-y-2">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">
          {t("observations.actualMemory")}
        </span>
        <strong className="tabular-nums">{gib(actual)}</strong>
      </div>
      <div
        className="relative h-2.5 overflow-hidden rounded-full bg-muted"
        role="group"
        aria-label={`${t("observations.actual")}: ${gib(actual)}, ${t("observations.allocated")}: ${gib(device.allocatedMiB)}, ${t("observations.physical")}: ${gib(total)}`}
      >
        {multiBar ? (
          <div className="flex h-full">
            {assigned.map((a, index) => {
              const fallbackMiB = assignedUsedMiB(a);
              const segmentWidth =
                a.memoryMiB > 0
                  ? ratio(a.memoryMiB, total)
                  : assigned.length > 0
                    ? 100 / assigned.length
                    : 0;
              const denom = a.memoryMiB || total;
              const color = allocationColor(a.endpoint, index);
              return (
                <Tooltip
                  key={`${a.endpoint}:${a.replica}:${a.instance}:${a.vdevice ?? index}`}
                >
                  <TooltipTrigger asChild>
                    <Link
                      className="relative block h-full shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                      to={`/${encodeURIComponent(a.workspace)}/endpoints/show/${encodeURIComponent(a.endpoint)}`}
                      aria-label={`${a.endpoint}: ${t("observations.actual")} ${gib(fallbackMiB)}, ${t("observations.allocated")} ${gib(a.memoryMiB)}`}
                      style={{ width: `${segmentWidth}%` }}
                    >
                      <span
                        className="absolute inset-0 opacity-30"
                        style={{ backgroundColor: color }}
                      />
                      {fallbackMiB != null && (
                        <span
                          className="absolute inset-y-0 left-0"
                          style={{
                            backgroundColor: color,
                            width: `${ratio(fallbackMiB, denom)}%`,
                          }}
                        />
                      )}
                      {fallbackMiB != null && hasComposition(a) && (
                        <CompositionSegments
                          measuredPct={ratio(fallbackMiB, denom)}
                          weightsPct={ratio(a.modelWeightsMiB, denom)}
                          kvPct={ratio(a.kvCacheCapacityMiB, denom)}
                        />
                      )}
                      {fallbackMiB == null && (
                        <span className="absolute inset-0 border border-dashed border-[var(--nt-stroke-neutral-trans-3)]" />
                      )}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{a.endpoint} ↗</p>
                    <p>{a.model}</p>
                    <p>
                      {t("observations.actual")} {gib(fallbackMiB)} /{" "}
                      {t("observations.allocated")} {gib(a.memoryMiB)}
                    </p>
                    <p>
                      {t("observations.modelWeights")} {weightsText(a)}
                    </p>
                    <p>
                      {t("observations.l0KvCache")} {l0KvText(a)}
                    </p>
                    {fallbackMiB != null && fallbackMiB > a.memoryMiB && (
                      <p>{t("observations.overAllocation")}</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        ) : (
          <>
            <div
              className="absolute inset-y-0 left-0 bg-[var(--nt-chart-series-1)] opacity-30"
              style={{ width: `${ratio(device.allocatedMiB, total)}%` }}
            />
            {actual != null && (
              <div
                className="absolute inset-y-0 left-0 bg-[var(--nt-chart-series-1)]"
                style={{ width: `${ratio(actual, total)}%` }}
              />
            )}
            {actual != null &&
              activeAllocation &&
              hasComposition(activeAllocation) && (
                <CompositionSegments
                  measuredPct={ratio(actual, total)}
                  weightsPct={ratio(activeAllocation.modelWeightsMiB, total)}
                  kvPct={ratio(activeAllocation.kvCacheCapacityMiB, total)}
                />
              )}
          </>
        )}
      </div>
      <div className="flex flex-wrap justify-between gap-1 text-xs text-muted-foreground">
        <span>
          {t("observations.allocated")} {gib(device.allocatedMiB)}
        </span>
        <span>
          {t("observations.physical")} {gib(total)}
        </span>
      </div>
      {showLegend && <CompositionLegend />}
      {replica && (
        <div
          className="text-xs text-muted-foreground"
          data-testid="gpu-kv-weights-breakdown"
        >
          {t("observations.modelWeights")} {weightsText(replica)} ·{" "}
          {t("observations.l0KvCache")} {l0KvText(replica)}
        </div>
      )}
      {!replica && assigned.length > 0 && (
        <div
          className="space-y-1 text-xs text-muted-foreground"
          data-testid="gpu-kv-weights-breakdown"
        >
          {assigned.map((a, index) => {
            const duplicateEndpoint =
              assigned.filter((item) => item.endpoint === a.endpoint).length >
              1;
            const instanceLabel =
              duplicateEndpoint && (a.replica || a.instance)
                ? `${a.endpoint} (${a.replica || a.instance})`
                : a.endpoint;
            return (
              <div
                key={`${a.endpoint}:${a.replica}:${a.instance}:${a.vdevice ?? index}`}
                className="flex flex-wrap items-center gap-x-2 gap-y-0.5"
              >
                <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full bg-muted-foreground/50"
                    style={
                      multiBar
                        ? {
                            backgroundColor: allocationColor(a.endpoint, index),
                          }
                        : undefined
                    }
                  />
                  <span className="break-all">{instanceLabel}</span>
                </span>{" "}
                <span>
                  {t("observations.modelWeights")} {weightsText(a)} ·{" "}
                  {t("observations.l0KvCache")} {l0KvText(a)}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {actual == null && (
        <p className="text-xs text-muted-foreground">
          {t("observations.noMeasurement")}
        </p>
      )}
    </div>
  );
  return (
    <div className="mt-2 space-y-2" data-testid="gpu-observation-card">
      {!detailsTrigger && (
        <>
          {memory}
          <div className="flex flex-wrap justify-between gap-2 text-xs">
            <span className="text-muted-foreground">
              {t("observations.utilization")}
            </span>
            <span className="tabular-nums">{utilizationText}</span>
          </div>
          <MetricBar
            size="sm"
            series="green"
            value={utilization ? utilization.value * 100 : null}
            track={utilization ? "subtle" : "unavailable"}
          />
        </>
      )}
      <div className="flex justify-end">
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-primary hover:underline"
          onClick={() => setOpen(true)}
        >
          {detailsTrigger ?? (
            <>
              {t("observations.details")}{" "}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>
              GPU {device.index} · {device.product}
            </SheetTitle>
            <SheetDescription className="break-all">
              {device.node}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <div>
              <p className="mb-2 text-xs text-muted-foreground">UUID</p>
              <p className="select-all break-all font-mono text-xs">
                {device.uuid}
              </p>
            </div>
            <section className="space-y-3">
              <h3 className="font-medium">
                {t(
                  replica
                    ? "observations.replicaUsage"
                    : "observations.deviceUsage",
                )}
              </h3>
              {memory}
              <div className="grid grid-cols-2 gap-3 rounded-md bg-muted/50 p-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("observations.utilization")}
                  </p>
                  {utilizationText}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("observations.deviceTemperature")}
                  </p>
                  {temperature ? `${temperature.value.toFixed(0)} °C` : "—"}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("observations.devicePower")}
                  </p>
                  {power ? `${power.value.toFixed(0)} W` : "—"}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("observations.fp16")}
                  </p>
                  <span className="tabular-nums">
                    {nominalTflops != null && utilization
                      ? (nominalTflops * utilization.value).toFixed(1)
                      : "—"}{" "}
                    / {nominalTflops?.toFixed(1) ?? "—"} TFLOPS
                  </span>
                </div>
              </div>
              {used && (
                <p className="text-xs text-muted-foreground">
                  {t("observations.sampleTime")}{" "}
                  {new Date(used.observed_at * 1000).toLocaleTimeString()}
                </p>
              )}
            </section>
            <section>
              <h3 className="mb-3 font-medium">{t("observations.hardware")}</h3>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                {hardwareFields.map((key) => (
                  <div key={key}>
                    <dt className="text-xs text-muted-foreground">
                      {t(`observations.hardwareFields.${key}`)}
                    </dt>
                    <dd className="break-all">{hardwareLabel(key)}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section>
              <h3 className="mb-3 font-medium">
                {t("observations.assignments")}
              </h3>
              <div className="space-y-3">
                {assigned.map((a, index) => {
                  const measurement = reading(
                    samples,
                    "neutree_endpoint_replica_accelerator_memory_used_bytes",
                    device.node,
                    device.uuid,
                    a,
                  );
                  return (
                    <div
                      key={`${a.endpoint}:${a.replica}:${a.instance}:${a.vdevice ?? index}`}
                      className="rounded-md border p-3 text-sm"
                    >
                      <Link
                        className="font-medium text-primary hover:underline"
                        to={`/${encodeURIComponent(a.workspace)}/endpoints/show/${encodeURIComponent(a.endpoint)}`}
                      >
                        {a.endpoint}
                      </Link>
                      <p className="break-all text-xs text-muted-foreground">
                        {a.model}
                      </p>
                      <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                        {a.replica || a.instance}
                      </p>
                      <p className="mt-2 text-xs">
                        {t("observations.actual")}{" "}
                        {gib(
                          measurement ? measurement.value / 1024 ** 2 : null,
                        )}{" "}
                        · {t("observations.allocated")} {gib(a.memoryMiB)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("observations.modelWeights")} {weightsText(a)} ·{" "}
                        {t("observations.l0KvCache")} {l0KvText(a)}
                      </p>
                    </div>
                  );
                })}
                {assigned.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {t("observations.noAssignments")}
                  </p>
                )}
              </div>
            </section>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Light stripes mark the L0 KV-Cache pool; a dark shade marks the rest of the
// measured memory (CUDA context, activations, graphs) so it stays deeper than
// the 30%-opacity allocated-unused track in both light and dark themes.
const KV_STRIPES =
  "repeating-linear-gradient(135deg, rgba(255,255,255,0.6) 0 2px, transparent 2px 4px)";
const OTHER_SHADE = "rgba(0,0,0,0.28)";

function CompositionSegments({
  measuredPct,
  weightsPct,
  kvPct,
}: {
  measuredPct: number;
  weightsPct: number;
  kvPct: number;
}) {
  // Never draw past the measured usage: the composition explains the
  // measurement, it does not replace it.
  const weights = Math.min(weightsPct, measuredPct);
  const kv = Math.min(kvPct, measuredPct - weights);
  const other = Math.max(0, measuredPct - weights - kv);
  return (
    <>
      {weights > 0 && (
        <div
          data-testid="gpu-bar-weights-segment"
          className="pointer-events-none absolute inset-y-0 left-0 border-r border-white/80"
          style={{ width: `${weights}%` }}
        />
      )}
      {kv > 0 && (
        <div
          data-testid="gpu-bar-kv-segment"
          className="pointer-events-none absolute inset-y-0 border-r border-white/80"
          style={{
            left: `${weights}%`,
            width: `${kv}%`,
            backgroundImage: KV_STRIPES,
          }}
        />
      )}
      {other > 0 && (
        <div
          data-testid="gpu-bar-other-segment"
          className="pointer-events-none absolute inset-y-0 border-r border-white/80"
          style={{
            left: `${weights + kv}%`,
            width: `${other}%`,
            backgroundColor: OTHER_SHADE,
          }}
        />
      )}
    </>
  );
}

function CompositionLegend() {
  const { t } = useTranslation();
  const swatch = "inline-block h-2 w-3 shrink-0 rounded-sm";
  const base = "currentColor";
  const items = [
    { key: "modelWeights", style: { backgroundColor: base } },
    {
      key: "l0KvCache",
      style: { backgroundColor: base, backgroundImage: KV_STRIPES },
    },
    {
      key: "otherMemory",
      style: {
        backgroundColor: base,
        boxShadow: `inset 0 0 0 999px ${OTHER_SHADE}`,
      },
    },
    {
      key: "allocatedUnused",
      style: { backgroundColor: base, opacity: 0.3 },
    },
  ];
  return (
    <div
      className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground"
      data-testid="gpu-bar-legend"
    >
      {items.map((item) => (
        <span key={item.key} className="inline-flex items-center gap-1">
          <i className={swatch} style={item.style} />
          {t(`observations.${item.key}`)}
        </span>
      ))}
    </div>
  );
}
