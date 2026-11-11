import {
  BYTES_PER_GB,
  precisionBytes,
  precisionIdForDtype,
} from "@/foundation/lib/kv-cache";
import type { ModelInfo } from "@/foundation/types/serving-types";

const SIZE_UNIT_BYTES: Record<string, number> = {
  b: 1,
  byte: 1,
  bytes: 1,
  kb: 1e3,
  kib: 1024,
  mb: 1e6,
  mib: 1024 ** 2,
  gb: 1e9,
  gib: 1024 ** 3,
  tb: 1e12,
  tib: 1024 ** 4,
};

const parameterCount = (value: string | undefined): number | null => {
  if (!value) return null;
  const match = value
    .replaceAll(",", "")
    .trim()
    .match(/^(\d+(?:\.\d+)?)\s*([BMT])?$/i);
  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const multiplier =
    match[2]?.toUpperCase() === "T"
      ? 1e12
      : match[2]?.toUpperCase() === "M"
        ? 1e6
        : match[2]?.toUpperCase() === "B"
          ? 1e9
          : 1;
  return amount * multiplier;
};

/** Explicit quantization bits win; otherwise the dtype is read the same way
 * the KV cache estimate reads it, falling back to the quantization label. */
const bytesPerParameter = (info: ModelInfo): number | null => {
  if (
    typeof info.quantization_bits === "number" &&
    Number.isFinite(info.quantization_bits) &&
    info.quantization_bits > 0
  ) {
    return info.quantization_bits / 8;
  }

  return precisionBytes(
    precisionIdForDtype(info.parameter_dtype) ??
      precisionIdForDtype(info.quantization),
  );
};

/**
 * Converts the registry's human-readable model size to the same 1024³-byte GB
 * the KV cache estimate uses. Private registries report the model version's
 * folder size; public registries may report no size at all.
 */
export function estimateModelWeightsGb(size: string | null | undefined) {
  const match = size?.trim().match(/^(\d+(?:\.\d+)?)\s+([kmgt]?i?b|bytes?)$/i);
  if (!match) return null;

  const amount = Number(match[1]);
  const bytesPerUnit = SIZE_UNIT_BYTES[match[2].toLowerCase()];
  if (!Number.isFinite(amount) || amount <= 0 || bytesPerUnit == null) {
    return null;
  }

  return (amount * bytesPerUnit) / BYTES_PER_GB;
}

/**
 * Catalog variants usually declare a measured VRAM minimum. When one omits
 * that field, retain the checkpoint-based fallback that predates model-size
 * estimation. Direct registry selections use their reported folder size
 * instead, because mixed-precision checkpoints cannot be sized reliably from
 * parameter count and one nominal quantization width.
 */
export function estimateCheckpointWeightsGb(
  info: ModelInfo | null | undefined,
) {
  if (!info) return null;

  const parameters = parameterCount(info.parameter_count);
  const bytes = bytesPerParameter(info);
  if (parameters == null || bytes == null) return null;

  return (parameters * bytes) / BYTES_PER_GB;
}

/**
 * What one replica needs in VRAM: the weights and the KV cache are held at
 * once, so it is their sum. Either half may still be unknown; the other is
 * then the best figure there is. Null only when neither is known.
 */
export function perReplicaRequiredGb(
  weightsGb: number | null,
  kvCacheGb: number | null,
): number | null {
  if (weightsGb == null && kvCacheGb == null) return null;
  return (weightsGb ?? 0) + (kvCacheGb ?? 0);
}
