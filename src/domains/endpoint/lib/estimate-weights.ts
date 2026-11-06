import {
  BYTES_PER_GB,
  precisionBytes,
  precisionIdForDtype,
} from "@/foundation/lib/kv-cache";
import type { ModelInfo } from "@/foundation/types/serving-types";

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
 * Estimates checkpoint weights from the model metadata Neutree already reads,
 * in the same 1024³-byte GB as the KV cache estimate it is added to. This is a
 * deployment-sizing estimate, not a replacement for a catalog's measured
 * `vram_minimum_gb` when that number is available.
 */
export function estimateModelWeightsGb(info: ModelInfo | null | undefined) {
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
