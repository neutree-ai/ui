import {
  type AcceleratorProductResourceRow,
  getAcceleratorProductResourceRows,
} from "@/domains/cluster/lib/accelerator-virtualization";
import { calcResourceUsage } from "@/domains/cluster/lib/calc-resource-usage";
import {
  METRIC_BAR_SERIES_FILL_CLASSES,
  MetricBar,
  type MetricBarSeries,
} from "@/foundation/components/MetricBar";
import { formatToDecimal } from "@/foundation/lib/unit";
import type { ClusterResourceInfo } from "@/foundation/types/resource-types";

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Stands in for a number the cluster never reported. */
const UNKNOWN_VALUE = "-";

type UsageMetricProps = {
  label: string;
  total: number;
  /** `null` when the cluster reported no availability for this pool. Unknown
   * usage is not zero usage, so the metric says so rather than reading as
   * fully consumed. */
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

type ResourcePool = { total: number | null; available: number | null };

/** Sum one allocatable/available pair across product rows.
 *
 * The two sides are summed together rather than independently: a product that
 * reports a total but no availability would otherwise land in `total` alone and
 * inflate `used` by its entire capacity. Once any contributing product is
 * missing its available side the pool reports `available: null` — unknown —
 * because a partial sum cannot be subtracted from a whole-cluster total. */
const sumProductPool = (
  rows: AcceleratorProductResourceRow[],
  allocatableKey: "allocatableMemoryMiB" | "allocatableCoreUnits",
  availableKey: "availableMemoryMiB" | "availableCoreUnits",
): ResourcePool => {
  let total: number | null = null;
  let available: number | null = null;
  let availableIsKnown = true;

  for (const row of rows) {
    const allocatableValue = row[allocatableKey];
    if (allocatableValue == null) continue;

    total = (total ?? 0) + allocatableValue;

    const availableValue = row[availableKey];
    if (availableValue == null) {
      availableIsKnown = false;
      continue;
    }
    available = (available ?? 0) + availableValue;
  }

  return { total, available: availableIsKnown ? available : null };
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
  const usageIsKnown = available != null;
  const { used, percent } = usageIsKnown
    ? calcResourceUsage(total, available)
    : { used: 0, percent: 0 };
  const free = Math.max(total - used, 0);
  const usedLabel = allocationLabels
    ? t("clusters.options.allocated")
    : t("clusters.options.used");
  const freeLabel = t("clusters.options.free");
  const usageLabel = usedLabel.toLowerCase();
  const totalText = formatValue(total, valueScale, precision);
  const usedText = usageIsKnown
    ? formatValue(used, valueScale, precision)
    : UNKNOWN_VALUE;
  const freeText = usageIsKnown
    ? formatValue(free, valueScale, precision)
    : UNKNOWN_VALUE;
  const filledSegments = usageIsKnown ? Math.round(used) : 0;

  return (
    <div className="min-w-0 border-r pr-5 last:border-r-0 last:pr-0">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <div className="min-w-0 whitespace-nowrap text-2xl font-semibold leading-8 tabular-nums text-foreground">
          {usedText} / {totalText}
          {unit && (
            <span className="ml-1.5 text-base font-medium text-muted-foreground">
              {unit}
            </span>
          )}
        </div>
        <span className="shrink-0 text-sm text-muted-foreground">
          {usageIsKnown ? `${percent}%` : UNKNOWN_VALUE} {usageLabel}
        </span>
      </div>
      {discrete ? (
        <div
          className="mt-3 grid h-1.5 gap-px"
          style={{
            gridTemplateColumns: `repeat(${Math.round(total)}, minmax(0, 1fr))`,
          }}
          role="img"
          aria-label={`${label}: ${usedText} / ${totalText}`}
        >
          {Array.from({ length: Math.round(total) }, (_, index) => (
            <span
              key={index}
              className={`${
                index < filledSegments
                  ? METRIC_BAR_SERIES_FILL_CLASSES[series]
                  : "bg-muted"
              } ${index === 0 ? "rounded-l-full" : ""} ${
                index === Math.round(total) - 1 ? "rounded-r-full" : ""
              }`}
            />
          ))}
        </div>
      ) : (
        <MetricBar
          value={percent}
          size="sm"
          series={series}
          track={usageIsKnown ? "subtle" : "unavailable"}
          className="mt-3"
        />
      )}
      <div className="mt-1.5 flex items-baseline justify-between gap-3 text-sm text-muted-foreground">
        <span className="min-w-0 truncate">
          {usedLabel}{" "}
          <strong className="font-medium tabular-nums text-foreground">
            {usedText}
            {unit && usageIsKnown && ` ${unit}`}
          </strong>
        </span>
        <span className="min-w-0 truncate text-right">
          {freeLabel}{" "}
          <strong className="font-medium tabular-nums text-foreground">
            {freeText}
            {unit && usageIsKnown && ` ${unit}`}
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
  const availableGroups = resourceInfo.available?.accelerator_groups;
  const totalCards = Object.values(acceleratorGroups).reduce(
    (sum, group) => sum + group.quantity,
    0,
  );
  // An accelerator type with no availability entry leaves the card count
  // unknown rather than fully free — the same rule the VRAM and Core pools
  // follow, so one card cannot read as idle in one metric and busy in another.
  const availableCards = Object.keys(acceleratorGroups).reduce<number | null>(
    (sum, type) => {
      const quantity = availableGroups?.[type]?.quantity;
      return sum == null || quantity == null ? null : sum + quantity;
    },
    0,
  );
  const vram = sumProductPool(
    productRows,
    "allocatableMemoryMiB",
    "availableMemoryMiB",
  );
  const core = sumProductPool(
    productRows,
    "allocatableCoreUnits",
    "availableCoreUnits",
  );

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
            {vram.total != null && (
              <UsageMetric
                label={t("clusters.fields.memoryUsage")}
                total={vram.total}
                available={vram.available}
                unit="GiB"
                valueScale={1 / 1024}
                // VRAM and Core repeat per device in the Nodes table below, so
                // they hold their series colour across both scales.
                series="blue"
                t={t}
              />
            )}
            {core.total != null && (
              <UsageMetric
                label={t("clusters.fields.coreUsage")}
                total={core.total}
                available={core.available}
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
