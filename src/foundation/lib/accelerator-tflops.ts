import type { ClusterResourceInfo } from "@/foundation/types/resource-types";
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
