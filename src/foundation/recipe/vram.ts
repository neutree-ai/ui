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
  // NVIDIA Ada / Ampere (legacy convenience)
  L40S: 48,
  A100: 80,
  A100_80GB: 80,
  A100_40GB: 40,
  // AMD CDNA
  MI300X: 192,
  MI325X: 256,
  MI355X: 288,
};

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
  gpuCount?: number | string | null;
  requiredGb?: number | null;
}): VRAMCheck {
  if (!opts.requiredGb || opts.requiredGb <= 0) {
    return { kind: "unknown", reason: "variant has no vram_minimum_gb" };
  }
  if (!opts.acceleratorProduct) {
    return { kind: "unknown", reason: "no accelerator selected yet" };
  }
  const perGpu = PER_GPU_VRAM_GB[opts.acceleratorProduct];
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
  return {
    kind: totalGb >= opts.requiredGb ? "sufficient" : "insufficient",
    perGpuGb: perGpu,
    gpuCount: count,
    totalGb,
    requiredGb: opts.requiredGb,
  };
}
