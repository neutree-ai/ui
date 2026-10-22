import { ArrowUpRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { peakTflops } from "@/foundation/lib/accelerator-tflops";
import { Link } from "react-router";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  type AcceleratorSample,
  allocationColor,
  type GpuAllocation,
  reading,
  replicaReading,
} from "@/foundation/lib/accelerator-observations";
import { MetricBar } from "./MetricBar";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useTranslation } from "@/foundation/lib/i18n";

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
  const weightsText = (a?: GpuAllocation) =>
    a?.modelWeightsMiB != null ? gib(a.modelWeightsMiB) : null;
  const l0KvText = (a?: GpuAllocation) => {
    if (!a) return null;
    if (a.kvCacheCapacityMiB != null) {
      return gib(a.kvCacheCapacityMiB);
    }
    const kvUsage = replicaReading(samples, "vllm:kv_cache_usage_perc", a);
    if (kvUsage != null) {
      return `${(kvUsage.value * 100).toFixed(1)}%`;
    }
    return null;
  };
  const activeAllocation =
    replica ?? (assigned.length === 1 ? assigned[0] : undefined);
  const activeWeights = weightsText(activeAllocation);
  const activeL0Kv = l0KvText(activeAllocation);
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
        {assigned.length > 0 &&
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
          )) ? (
          <div className="flex h-full">
            {assigned.map((a, index) => {
              const measured = reading(
                samples,
                "neutree_endpoint_replica_accelerator_memory_used_bytes",
                device.node,
                device.uuid,
                a,
              );
              const usedMiB = measured ? measured.value / 1024 ** 2 : null;
              const fallbackMiB =
                usedMiB ?? (assigned.length === 1 ? actual : null);
              const segmentWidth =
                a.memoryMiB > 0
                  ? ratio(a.memoryMiB, total)
                  : assigned.length > 0
                    ? 100 / assigned.length
                    : 0;
              const color = allocationColor(a.endpoint, index);
              return (
                <Tooltip key={`${a.endpoint}:${a.instance}:${a.vdevice}`}>
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
                            width: `${ratio(fallbackMiB, a.memoryMiB || total)}%`,
                          }}
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
                    {weightsText(a) && (
                      <p>
                        {t("observations.modelWeights")} {weightsText(a)}
                      </p>
                    )}
                    {l0KvText(a) && (
                      <p>
                        {t("observations.l0KvCache")} {l0KvText(a)}
                      </p>
                    )}
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
      {(activeWeights || activeL0Kv) && (
        <div
          className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
          data-testid="gpu-kv-weights-breakdown"
        >
          {activeWeights && (
            <span>
              {t("observations.modelWeights")} {activeWeights}
            </span>
          )}
          {activeWeights && activeL0Kv && <span aria-hidden="true">·</span>}
          {activeL0Kv && (
            <span>
              {t("observations.l0KvCache")} {activeL0Kv}
            </span>
          )}
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
                {assigned.map((a) => {
                  const measurement = reading(
                    samples,
                    "neutree_endpoint_replica_accelerator_memory_used_bytes",
                    device.node,
                    device.uuid,
                    a,
                  );
                  return (
                    <div
                      key={`${a.endpoint}:${a.instance}:${a.vdevice}`}
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
                      {(weightsText(a) || l0KvText(a)) && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {weightsText(a) && (
                            <>
                              {t("observations.modelWeights")} {weightsText(a)}
                            </>
                          )}
                          {weightsText(a) && l0KvText(a) && " · "}
                          {l0KvText(a) && (
                            <>
                              {t("observations.l0KvCache")} {l0KvText(a)}
                            </>
                          )}
                        </p>
                      )}
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
