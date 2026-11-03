import type { ObservedGpu } from "@/foundation/components/GpuObservationCard";
import type { ClusterResourceInfo } from "@/foundation/types/resource-types";
import type { AcceleratorSample } from "./accelerator-observations";
import { reading } from "./accelerator-observations";
export const TFLOPS_ANNOTATION = "neutree.ai/accelerator-tflops";
export function parseTflops(raw?: string): Record<string, number> {
  try {
    const value = JSON.parse(raw || "{}");
    if (!value || Array.isArray(value) || typeof value !== "object") return {};
    return Object.fromEntries(
      Object.entries(value).filter(
        ([, v]) => typeof v === "number" && Number.isFinite(v) && v > 0,
      ),
    ) as Record<string, number>;
  } catch {
    return {};
  }
}
export function peakTflops(
  product: string,
  overrides: Record<string, number> = {},
  specification?: number | null,
): number | null {
  if (Object.hasOwn(overrides, product)) return overrides[product];
  return specification != null &&
    Number.isFinite(specification) &&
    specification > 0
    ? specification
    : null;
}

export function productPeakTflops(
  info: ClusterResourceInfo | null | undefined,
  product: string,
): number | null {
  let peak: number | null = null;
  for (const metadata of Object.values(info?.accelerator_metadata ?? {})) {
    const value = metadata.products?.[product]?.peak_fp16_tflops;
    if (value == null || !Number.isFinite(value) || value <= 0) continue;
    if (peak != null && peak !== value) return null;
    peak = value;
  }
  return peak;
}
export function formatFlops(value: number | null): string {
  return value == null
    ? "—"
    : value >= 1000
      ? `${(value / 1000).toFixed(2)} PFLOPS`
      : `${value.toFixed(2)} TFLOPS`;
}
export function observedDevices(
  info?: ClusterResourceInfo | null,
): ObservedGpu[] {
  return Object.entries(info?.node_resources ?? {}).flatMap(
    ([node, resource]) =>
      (resource.devices ?? []).map((d, i) => ({
        node,
        uuid: d.uuid,
        index: d.order ?? i + 1,
        product: d.product,
        peakFP16TFLOPS: productPeakTflops(info, d.product),
        healthy: d.health,
        totalMiB: d.allocatable?.memory_mib ?? null,
        allocatedMiB:
          d.allocatable && d.available
            ? d.allocatable.memory_mib - d.available.memory_mib
            : null,
      })),
  );
}
export function flopsTotals(
  devices: ObservedGpu[],
  samples: AcceleratorSample[],
  overrides: Record<string, number>,
) {
  const healthy = devices.filter((d) => d.healthy);
  let total: number | null = healthy.length ? null : 0,
    used: number | null = healthy.length ? null : 0;
  for (const device of healthy) {
    const peak = peakTflops(device.product, overrides, device.peakFP16TFLOPS);
    if (peak == null) continue;
    total = (total ?? 0) + peak;
    const ratio = reading(
      samples,
      "neutree_accelerator_utilization_ratio",
      device.node,
      device.uuid,
    )?.value;
    if (ratio != null && Number.isFinite(ratio) && ratio >= 0 && ratio <= 1)
      used = (used ?? 0) + peak * ratio;
  }
  return { total, used };
}

export type FlopsPoint = { time: number; value: number | null };

// Each historical sample is valued by its own card's product, rather than
// multiplying today's card count by yesterday's cluster-average utilization.
// A point stays unknown until at least one card in it has a known peak and a
// valid utilization.
export function flopsHistory(
  samples: AcceleratorSample[],
  devices: ObservedGpu[],
  overrides: Record<string, number>,
  info?: ClusterResourceInfo | null,
): FlopsPoint[] {
  const byTime = new Map<number, Map<string, AcceleratorSample>>();
  for (const sample of samples) {
    const cards = byTime.get(sample.observed_at) ?? new Map();
    cards.set(
      `${sample.labels.node}/${sample.labels.accelerator_uuid}`,
      sample,
    );
    byTime.set(sample.observed_at, cards);
  }
  return [...byTime.entries()]
    .sort(([a], [b]) => a - b)
    .map(([time, cards]) => {
      let value: number | null = null;
      for (const s of cards.values()) {
        const device = devices.find(
          (d) =>
            d.node === s.labels.node && d.uuid === s.labels.accelerator_uuid,
        );
        const product = device?.product || s.labels.product || "";
        const peak = peakTflops(
          product,
          overrides,
          productPeakTflops(info, product),
        );
        if (
          peak != null &&
          Number.isFinite(s.value) &&
          s.value >= 0 &&
          s.value <= 1
        )
          value = (value ?? 0) + peak * s.value;
      }
      return { time, value };
    });
}

// A blank entry clears the product's calibration; anything else must be a
// positive number.
export function isValidTflopsDraft(draft: Record<string, string>): boolean {
  return Object.values(draft).every(
    (v) => v.trim() === "" || (Number.isFinite(Number(v)) && Number(v) > 0),
  );
}

// Applies the draft for the cluster's products onto the stored calibration,
// keeping entries for products the dialog did not show.
export function mergeTflopsDraft(
  stored: Record<string, number>,
  draft: Record<string, string>,
  products: string[],
): Record<string, number> {
  const next = { ...stored };
  for (const product of products) {
    if (draft[product]?.trim()) next[product] = Number(draft[product]);
    else delete next[product];
  }
  return next;
}
