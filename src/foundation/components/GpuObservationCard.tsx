import { ArrowUpRight, Cpu } from "lucide-react";
import { useState } from "react";
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
} from "@/foundation/lib/accelerator-observations";
import { GPU_GRID_CELL_CLASS } from "@/foundation/lib/gpu-device-resources";
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
      "neutree_node_accelerator_ascend_info",
      "neutree_node_accelerator_hygon_info",
    ].map((name) => get(name)?.labels ?? {}),
  ) as Record<string, string>;
  const assigned = allocations.filter(
    (a) => a.node === device.node && a.uuid === device.uuid,
  );
  const label = (value?: string) =>
    !value || value === "unknown" || value === "-1" ? "—" : value;
  const utilizationText = utilization
    ? `${(utilization.value * 100).toFixed(0)}%`
    : "—";
  const hardwareFields = [
    "architecture",
    "cuda_capability",
    "driver_version",
    "cuda_driver_version",
    "pcie_bus_id",
    "pcie_generation",
    "pcie_width",
    "numa_node",
  ];
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
        role="img"
        aria-label={`${t("observations.actual")}: ${gib(actual)}, ${t("observations.allocated")}: ${gib(device.allocatedMiB)}, ${t("observations.physical")}: ${gib(total)}`}
      >
        <div
          className="absolute inset-y-0 left-0 bg-blue-200 dark:bg-blue-950"
          style={{ width: `${ratio(device.allocatedMiB, total)}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 bg-blue-600"
          style={{ width: `${ratio(actual, total)}%` }}
        />
        {device.allocatedMiB != null && !!total && (
          <span
            className="absolute inset-y-0 w-0.5 bg-slate-700 dark:bg-slate-200"
            style={{
              left: `calc(${ratio(device.allocatedMiB, total)}% - 2px)`,
            }}
          />
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
      {actual == null && (
        <p className="text-xs text-muted-foreground">
          {t("observations.noMeasurement")}
        </p>
      )}
    </div>
  );
  return (
    <div
      className={`min-w-0 space-y-3 p-3 ${GPU_GRID_CELL_CLASS}`}
      data-testid="gpu-observation-card"
    >
      <div>
        <button
          type="button"
          className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          onClick={() => setOpen(true)}
        >
          <Cpu className="h-4 w-4" />
          GPU {device.index}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
        <div
          className="mt-1 truncate text-xs text-muted-foreground"
          title={device.product}
        >
          {device.product}
        </div>
        {device.healthy === false && (
          <p className="text-xs text-destructive">
            {t("observations.unhealthy")}
          </p>
        )}
      </div>
      {memory}
      <div className="flex flex-wrap justify-between gap-2 text-xs">
        <span className="text-muted-foreground">
          {t("observations.utilization")}
        </span>
        <span className="tabular-nums">{utilizationText}</span>
      </div>
      <div className="h-1 rounded bg-muted">
        <div
          className="h-1 rounded bg-emerald-500"
          style={{ width: `${ratio(utilization?.value, 1)}%` }}
        />
      </div>
      {!replica && assigned.length > 0 && (
        <div className="space-y-2 border-t pt-2">
          <div className="text-xs text-muted-foreground">
            {t("observations.assignments")}
          </div>
          <div className="flex h-2 overflow-hidden rounded bg-muted">
            {assigned.map((a) => (
              <Link
                key={`${a.endpoint}:${a.instance}:${a.vdevice}`}
                to={`/${encodeURIComponent(a.workspace)}/endpoints/show/${encodeURIComponent(a.endpoint)}`}
                title={`${a.endpoint} · ${a.model} · ${gib(a.memoryMiB)}`}
                aria-label={a.endpoint}
                style={{
                  width: `${ratio(a.memoryMiB, total)}%`,
                  backgroundColor: allocationColor(a.endpoint),
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
          {[...new Map(assigned.map((a) => [a.endpoint, a])).values()].map(
            (a) => (
              <Link
                className="flex items-center gap-1.5 truncate text-xs hover:underline"
                key={a.endpoint}
                to={`/${encodeURIComponent(a.workspace)}/endpoints/show/${encodeURIComponent(a.endpoint)}`}
                title={`${a.endpoint} · ${a.model}`}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-sm"
                  style={{ backgroundColor: allocationColor(a.endpoint) }}
                />
                <span className="truncate">{a.endpoint}</span>
              </Link>
            ),
          )}
        </div>
      )}
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
              <div className="grid grid-cols-3 gap-3 rounded-md bg-muted/50 p-3 text-sm">
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
                    <dd className="break-all">{label(hardware[key])}</dd>
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
