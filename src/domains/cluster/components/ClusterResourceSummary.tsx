import {
  type AcceleratorProductResourceRow,
  getAcceleratorProductResourceRows,
} from "@/domains/cluster/lib/accelerator-virtualization";
import { calcResourceUsage } from "@/domains/cluster/lib/calc-resource-usage";
import {
  MetricBar,
  type MetricBarSeries,
} from "@/foundation/components/MetricBar";
import { formatToDecimal } from "@/foundation/lib/unit";
import type { ClusterResourceInfo } from "@/foundation/types/resource-types";

type Translate = (key: string, options?: Record<string, unknown>) => string;

type UsageMetricProps = {
  label: string;
  total: number;
  available?: number | null;
  unit?: string;
  series?: MetricBarSeries;
  allocationLabels?: boolean;
  valueScale?: number;
  valuePrecision?: number;
  discrete?: boolean;
  t: Translate;
};

const formatValue = (value: number, valueScale: number, precision: number) =>
  formatToDecimal(value * valueScale, precision) ?? "-";

const sumDefined = (
  rows: AcceleratorProductResourceRow[],
  key:
    | "allocatableMemoryMiB"
    | "availableMemoryMiB"
    | "allocatableCoreUnits"
    | "availableCoreUnits",
) => {
  const values = rows
    .map((row) => row[key])
    .filter((value): value is number => value != null);
  return values.length > 0
    ? values.reduce((sum, value) => sum + value, 0)
    : null;
};

const UsageMetric = ({
  label,
  total,
  available,
  unit,
  series = "blue",
  allocationLabels = false,
  valueScale = 1,
  valuePrecision = 1,
  discrete = false,
  t,
}: UsageMetricProps) => {
  const precision = discrete ? 0 : valuePrecision;
  const { used, percent } = calcResourceUsage(total, available ?? undefined);
  const free = Math.max(total - used, 0);
  const usedLabel = allocationLabels
    ? t("clusters.options.allocated")
    : t("clusters.options.used");
  const freeLabel = allocationLabels
    ? t("clusters.options.free")
    : t("clusters.options.free");
  const usageLabel = allocationLabels
    ? t("clusters.options.allocated").toLowerCase()
    : t("clusters.options.used").toLowerCase();

  return (
    <div className="min-w-0 border-r pr-5 last:border-r-0 last:pr-0">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <div className="min-w-0 whitespace-nowrap text-2xl font-semibold leading-8 tabular-nums text-foreground">
          {formatValue(used, valueScale, precision)} /{" "}
          {formatValue(total, valueScale, precision)}
          {unit && (
            <span className="ml-1.5 text-base font-medium text-muted-foreground">
              {unit}
            </span>
          )}
        </div>
        <span className="shrink-0 text-sm text-muted-foreground">
          {percent}% {usageLabel}
        </span>
      </div>
      {discrete ? (
        <div
          className="mt-3 grid h-1.5 gap-px"
          style={{
            gridTemplateColumns: `repeat(${Math.round(total)}, minmax(0, 1fr))`,
          }}
          role="img"
          aria-label={`${label}: ${formatValue(used, valueScale, precision)} / ${formatValue(total, valueScale, precision)}`}
        >
          {Array.from({ length: Math.round(total) }, (_, index) => (
            <span
              key={index}
              className={`${
                index < Math.round(used)
                  ? "bg-[var(--nt-chart-series-5)]"
                  : "bg-muted"
              } ${index === 0 ? "rounded-l-full" : ""} ${
                index === Math.round(total) - 1 ? "rounded-r-full" : ""
              }`}
            />
          ))}
        </div>
      ) : (
        <MetricBar value={percent} size="sm" series={series} className="mt-3" />
      )}
      <div className="mt-1.5 flex items-baseline justify-between gap-3 text-sm text-muted-foreground">
        <span className="min-w-0 truncate">
          {usedLabel}{" "}
          <strong className="font-medium tabular-nums text-foreground">
            {formatValue(used, valueScale, precision)}
            {unit && ` ${unit}`}
          </strong>
        </span>
        <span className="min-w-0 truncate text-right">
          {freeLabel}{" "}
          <strong className="font-medium tabular-nums text-foreground">
            {formatValue(free, valueScale, precision)}
            {unit && ` ${unit}`}
          </strong>
        </span>
      </div>
    </div>
  );
};

export function ClusterResourceSummary({
  resourceInfo,
  t,
}: {
  resourceInfo: ClusterResourceInfo;
  t: Translate;
}) {
  const allocatable = resourceInfo.allocatable;
  if (!allocatable) return null;

  const productRows = getAcceleratorProductResourceRows(resourceInfo);
  const acceleratorGroups = allocatable.accelerator_groups ?? {};
  const totalCards = Object.values(acceleratorGroups).reduce(
    (sum, group) => sum + group.quantity,
    0,
  );
  const availableCards = Object.entries(acceleratorGroups).reduce(
    (sum, [type, group]) =>
      sum +
      (resourceInfo.available?.accelerator_groups?.[type]?.quantity ??
        group.quantity),
    0,
  );
  const totalVram = sumDefined(productRows, "allocatableMemoryMiB");
  const availableVram = sumDefined(productRows, "availableMemoryMiB");
  const totalCore = sumDefined(productRows, "allocatableCoreUnits");
  const availableCore = sumDefined(productRows, "availableCoreUnits");

  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <UsageMetric
          label={t("common.fields.cpu")}
          total={allocatable.cpu}
          available={resourceInfo.available?.cpu}
          unit="cores"
          series="green"
          t={t}
        />
        <UsageMetric
          label={t("common.fields.memory")}
          total={allocatable.memory}
          available={resourceInfo.available?.memory}
          unit="GiB"
          series="purple"
          t={t}
        />
      </div>

      {/* No heading row here: the three metrics below label themselves, and the
          total that row used to carry is already the denominator of Card Count.
          The rule is enough to separate them from CPU and memory. */}
      {totalCards > 0 && (
        <div className="border-t pt-4">
          <div className="grid gap-5 md:grid-cols-3">
            <UsageMetric
              label={t("clusters.fields.physicalGpu")}
              total={totalCards}
              available={availableCards}
              unit="cards"
              allocationLabels
              discrete
              series="amber"
              t={t}
            />
            {totalVram != null && (
              <UsageMetric
                label={t("clusters.fields.memoryUsage")}
                total={totalVram}
                available={availableVram}
                unit="GiB"
                valueScale={1 / 1024}
                // VRAM and Core repeat per device in the Nodes table below, so
                // they hold their series colour across both scales.
                series="blue"
                t={t}
              />
            )}
            {totalCore != null && (
              <UsageMetric
                label={t("clusters.fields.coreUsage")}
                total={totalCore}
                available={availableCore}
                valuePrecision={0}
                series="cyan"
                t={t}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
