import { useCustom, useUpdate, useDataProvider } from "@refinedev/core";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { MetricBar } from "@/foundation/components/MetricBar";
import { useTranslation } from "@/foundation/lib/i18n";
import {
  TFLOPS_ANNOTATION,
  parseTflops,
  peakTflops,
  formatFlops,
  observedDevices,
  flopsTotals,
} from "@/foundation/lib/accelerator-tflops";
import type {
  AcceleratorSample,
  AcceleratorSnapshot,
} from "@/foundation/lib/accelerator-observations";
import type { Cluster } from "../types";

export function ClusterFlops({
  cluster,
  samples,
}: {
  cluster: Cluster;
  samples: AcceleratorSample[];
}) {
  const { t } = useTranslation();
  const gradient = useId();
  const devices = observedDevices(cluster.status?.resource_info);
  const overrides = parseTflops(
    cluster.metadata.annotations?.[TFLOPS_ANNOTATION],
  );
  const { total, used } = flopsTotals(devices, samples, overrides);
  const products = [...new Set(devices.map((d) => d.product))].sort();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const provider = useDataProvider();
  const update = useUpdate<Cluster>();
  const history = useCustom<
    AcceleratorSnapshot & { start: number; end: number }
  >({
    url: `/clusters/${encodeURIComponent(cluster.metadata.workspace ?? "")}/${encodeURIComponent(cluster.metadata.name)}/accelerator-utilization-trend`,
    method: "get",
    queryOptions: { retry: false, staleTime: 300000, refetchInterval: 300000 },
  });
  const byTime = new Map<number, AcceleratorSample[]>();
  for (const sample of history.error ? [] : (history.data?.data.samples ?? []))
    byTime.set(sample.observed_at, [
      ...(byTime.get(sample.observed_at) ?? []),
      sample,
    ]);
  // Use each historical device identity/product, rather than multiplying today's
  // card count by yesterday's cluster-average utilization.
  const points = [...byTime.entries()]
    .sort(([a], [b]) => a - b)
    .map(([time, values]) => {
      const distinct = new Map(
        values.map((s) => [`${s.labels.node}/${s.labels.accelerator_uuid}`, s]),
      );
      let value: number | null = 0;
      for (const s of distinct.values()) {
        const product =
          s.labels.product ||
          devices.find(
            (d) =>
              d.node === s.labels.node && d.uuid === s.labels.accelerator_uuid,
          )?.product ||
          "";
        const peak = peakTflops(product, overrides);
        value = value == null || peak == null ? null : value + peak * s.value;
      }
      return { time, value };
    });
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...points.map((p) => p.value ?? 0));
  const start = history.data?.data.start ?? points[0]?.time ?? 0,
    end = history.data?.data.end ?? points.at(-1)?.time ?? start;
  const x = (time: number) =>
    ((time - start) / Math.max(21600, end - start)) * 400;
  const y = (value: number) => 72 - (value / max) * 64;
  const segments: (typeof points)[] = [];
  for (const point of points) {
    if (point.value == null) continue;
    const last = segments.at(-1);
    if (!last || point.time - last.at(-1)!.time > 21600) segments.push([point]);
    else last.push(point);
  }
  const path = (segment: typeof points) =>
    segment
      .map((p, i) => {
        if (i === 0) return `M ${x(p.time)} ${y(p.value!)}`;
        const prev = segment[i - 1],
          mid = (x(prev.time) + x(p.time)) / 2;
        return `C ${mid} ${y(prev.value!)} ${mid} ${y(p.value!)} ${x(p.time)} ${y(p.value!)}`;
      })
      .join(" ");
  const save = async () => {
    setError("");
    if (
      Object.values(draft).some(
        (v) =>
          v.trim() !== "" && (!Number.isFinite(Number(v)) || Number(v) <= 0),
      )
    ) {
      setError(t("observations.invalidTflops"));
      return;
    }
    try {
      const current = await provider().getOne<Cluster>({
        resource: "clusters",
        id: cluster.id,
      });
      const next = parseTflops(
        current.data.metadata.annotations?.[TFLOPS_ANNOTATION],
      );
      for (const product of products) {
        if (draft[product]?.trim()) next[product] = Number(draft[product]);
        else delete next[product];
      }
      await update.mutateAsync({
        resource: "clusters",
        id: cluster.id,
        values: {
          metadata: {
            ...current.data.metadata,
            annotations: {
              ...current.data.metadata.annotations,
              [TFLOPS_ANNOTATION]: JSON.stringify(next),
            },
          },
        },
        mutationMode: "pessimistic",
      });
      setOpen(false);
    } catch {
      setError(t("observations.calibrationFailed"));
    }
  };
  return (
    <div className="border-t pt-4">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium">{t("observations.flops")}</h3>
            {
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDraft(
                    Object.fromEntries(
                      products.map((p) => [p, overrides[p]?.toString() ?? ""]),
                    ),
                  );
                  setError("");
                  setOpen(true);
                }}
              >
                {t("observations.calibrate")}
              </Button>
            }
          </div>
          <div className="text-xl font-semibold tabular-nums">
            {formatFlops(used)} / {formatFlops(total)}
          </div>
          <MetricBar
            value={used != null && total ? (used / total) * 100 : null}
            series="blue"
            size="sm"
          />
          <p className="text-xs text-muted-foreground">
            {t("observations.flopsEstimate")}
          </p>
        </div>
        <div className="min-w-0">
          <p className="mb-2 text-xs text-muted-foreground">
            {t("observations.flopsTrend")}
          </p>
          {segments.length ? (
            <>
              <svg
                viewBox="0 0 400 80"
                className="h-20 w-full"
                role="img"
                aria-label={t("observations.flopsTrend")}
                onMouseLeave={() => setHover(null)}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const at =
                    start +
                    ((e.clientX - rect.left) / rect.width) * (end - start);
                  setHover(
                    points.reduce(
                      (best, p, i) =>
                        Math.abs(p.time - at) < Math.abs(points[best].time - at)
                          ? i
                          : best,
                      0,
                    ),
                  );
                }}
              >
                <defs>
                  <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="var(--nt-chart-series-1)"
                      stopOpacity="0.25"
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--nt-chart-series-1)"
                      stopOpacity="0.02"
                    />
                  </linearGradient>
                </defs>
                {segments.map((segment, i) => (
                  <g key={i}>
                    <path
                      d={`${path(segment)} L ${x(segment.at(-1)!.time)} 80 L ${x(segment[0].time)} 80 Z`}
                      fill={`url(#${gradient})`}
                    />
                    <path
                      d={path(segment)}
                      fill="none"
                      stroke="var(--nt-chart-series-1)"
                      strokeWidth="2"
                    />
                    {segment.map((p) => (
                      <circle
                        key={p.time}
                        cx={x(p.time)}
                        cy={y(p.value!)}
                        r="3"
                        fill="var(--nt-chart-series-1)"
                      >
                        <title>
                          {new Date(p.time * 1000).toLocaleString()} ·{" "}
                          {formatFlops(p.value)}
                        </title>
                      </circle>
                    ))}
                  </g>
                ))}
              </svg>
              <p className="h-4 text-xs tabular-nums text-muted-foreground">
                {hover != null
                  ? `${new Date(points[hover].time * 1000).toLocaleString()} · ${formatFlops(points[hover].value)}`
                  : t("observations.trendEstimate")}
              </p>
            </>
          ) : (
            <div className="flex h-20 items-center justify-center text-xs text-muted-foreground">
              {history.error
                ? t("observations.status.unavailable")
                : t("observations.noTrend")}
            </div>
          )}
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("observations.calibrate")}</DialogTitle>
            <DialogDescription>
              {t("observations.calibrationHelp")}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-3 overflow-y-auto">
            {products.map((product) => (
              <label
                key={product}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span>{product}</span>
                <Input
                  className="w-36"
                  type="number"
                  min="0.01"
                  step="any"
                  placeholder={peakTflops(product)?.toString() ?? "—"}
                  value={draft[product] ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, [product]: e.target.value })
                  }
                />
              </label>
            ))}
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button disabled={update.isLoading} onClick={save}>
            {t("buttons.save")}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
