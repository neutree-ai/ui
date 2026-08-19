// Per-GPU VRAM (GB) for common accelerator products. Used to estimate total
// cluster VRAM against a variant's `vram_minimum_gb`. Numbers come from the
// upstream vLLM recipes `taxonomy.yaml` (gpu_count vs vram_gb).
//
// When a product isn't listed, the OOM-risk check returns "unknown" instead
// of false-positive warnings — we'd rather under-warn than scare on a missing
// entry.
const PER_GPU_VRAM_GB: Record<string, number> = {
  // NVIDIA Hopper
  H100: 80,
  H200: 141,
  // NVIDIA Blackwell
  B200: 180,
  B300: 268,
  GB200: 192,
  GB300: 288,
  // NVIDIA Ada / Ampere / Turing (legacy convenience)
  L40S: 48,
  L4: 24,
  A100: 80,
  A100_80GB: 80,
  A100_40GB: 40,
  A10G: 24,
  T4: 16,
  V100: 16,
  // AMD CDNA
  MI300X: 192,
  MI325X: 256,
  MI355X: 288,
};

// Accelerator product strings reported by a cluster are vendor-prefixed and
// decorated (e.g. "NVIDIA-H100-80GB-HBM3", "Tesla-V100-SXM2-16GB"), while
// recipe annotations and PER_GPU_VRAM_GB keys use bare model names ("H100",
// "V100"). matchesAcceleratorName lines the two schemes up by comparing the
// product's alphanumeric tokens against the bare names — so "H100" matches a
// product token of "H100" without an exact-string equality that never holds.
export function matchesAcceleratorName(
  product: string,
  names: Iterable<string>,
): boolean {
  const tokens = new Set(
    product
      .toUpperCase()
      .split(/[^A-Z0-9]+/)
      .filter(Boolean),
  );
  for (const name of names) {
    const n = name.trim().toUpperCase();
    if (n && tokens.has(n)) {
      return true;
    }
  }
  return false;
}

// resolvePerGpuGb prefers the live per-GPU memory the cluster reports (passed
// in from accelerator_metadata) and only falls back to the static table when
// that is absent — and the fallback is token-matched so a vendor-prefixed
// product still resolves.
function resolvePerGpuGb(
  livePerGpuGb: number | null | undefined,
  product: string,
): number | undefined {
  if (livePerGpuGb && livePerGpuGb > 0) {
    return livePerGpuGb;
  }
  if (PER_GPU_VRAM_GB[product]) {
    return PER_GPU_VRAM_GB[product];
  }
  for (const [key, gb] of Object.entries(PER_GPU_VRAM_GB)) {
    if (matchesAcceleratorName(product, [key])) {
      return gb;
    }
  }
  return undefined;
}

type VRAMCheck =
  | { kind: "unknown"; reason: string }
  | {
      kind: "sufficient" | "insufficient";
      perGpuGb: number;
      gpuCount: number;
      totalGb: number;
      requiredGb: number;
    };

export function checkVRAM(opts: {
  acceleratorProduct?: string | null;
  // Live per-GPU memory (GiB) from the selected cluster's accelerator metadata;
  // preferred over the static PER_GPU_VRAM_GB table when available.
  perGpuGb?: number | null;
  gpuCount?: number | string | null;
  requiredGb?: number | null;
}): VRAMCheck {
  if (!opts.requiredGb || opts.requiredGb <= 0) {
    return { kind: "unknown", reason: "variant has no vram_minimum_gb" };
  }
  if (!opts.acceleratorProduct && !(opts.perGpuGb && opts.perGpuGb > 0)) {
    return { kind: "unknown", reason: "no accelerator selected yet" };
  }
  const perGpu = resolvePerGpuGb(opts.perGpuGb, opts.acceleratorProduct ?? "");
  if (!perGpu) {
    return {
      kind: "unknown",
      reason: `unknown accelerator: ${opts.acceleratorProduct}`,
    };
  }
  const count = Number(opts.gpuCount ?? 0);
  if (!count || count <= 0) {
    return { kind: "unknown", reason: "no GPUs selected yet" };
  }
  const totalGb = perGpu * count;
  // The badge renders the same value it judges on: formatGb rounds the
  // available total to one decimal (the UI's rule for available resources,
  // e.g. cluster panels use toFixed(1)), and the check compares that rounded
  // total against the requirement so the verdict always matches what the user
  // sees. Rounding the available total to display precision means 2 ×
  // 23.98828125 GiB = 47.9765625 GiB counts as meeting a 48 GB requirement —
  // a pair of 24 GB cards genuinely provides that much, and showing a false
  // "insufficient" was the bug. The requirement is compared as declared, not
  // rounded; recipe vram_minimum_gb values are integers, so rounding it would
  // be a no-op anyway.
  const roundedTotalGb = Math.round(totalGb * 10) / 10;
  return {
    kind: roundedTotalGb >= opts.requiredGb ? "sufficient" : "insufficient",
    perGpuGb: perGpu,
    gpuCount: count,
    totalGb,
    requiredGb: opts.requiredGb,
  };
}

// Format a VRAM amount (GB) for display. Live per-GPU memory reported by a
// cluster is often fractional (e.g. 44.988 GiB × 2 = 89.9765625), which reads
// as noise in the badge. Round to one decimal and drop a trailing ".0" so whole
// numbers stay clean. Rounding matches how the rest of the UI shows available
// resources (cluster panels use toFixed(1)). Display-only — checkVRAM rounds
// the available total the same way before comparing, so the verdict can never
// contradict what the badge renders.
export function formatGb(gb: number): string {
  const rounded = Math.round(gb * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
