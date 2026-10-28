import type { ObservedGpu } from "@/foundation/components/GpuObservationCard";
import type { ClusterResourceInfo } from "@/foundation/types/resource-types";
import { extraPeakTflops } from "./accelerator-extra-info";
import type { AcceleratorSample } from "./accelerator-observations";
import { reading } from "./accelerator-observations";
export const TFLOPS_ANNOTATION = "neutree.ai/accelerator-tflops";
// Defaults are FP16 peak estimates, not measured arithmetic throughput.
const defaults: Record<string, number> = {
  T4: 65,
  L4: 121,
  A10: 125,
  L20: 119.5,
  L40S: 362,
  A100: 312,
  A800: 312,
  H100: 989,
  H800: 989,
  H20: 148,
  "4090": 165,
  ...extraPeakTflops,
};
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
): number | null {
  if (Object.hasOwn(overrides, product)) return overrides[product];
  const name = product.toUpperCase();
  const key = Object.keys(defaults)
    .sort((a, b) => b.length - a.length)
    .find((k) => name.includes(k));
  return key ? defaults[key] : null;
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
    const peak = peakTflops(device.product, overrides);
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
