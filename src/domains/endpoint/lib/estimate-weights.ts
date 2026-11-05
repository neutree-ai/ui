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

const bytesPerParameter = (info: ModelInfo): number | null => {
  if (
    typeof info.quantization_bits === "number" &&
    Number.isFinite(info.quantization_bits) &&
    info.quantization_bits > 0
  ) {
    return info.quantization_bits / 8;
  }

  const dtype = `${info.parameter_dtype ?? ""} ${info.quantization ?? ""}`
    .toLowerCase()
    .replaceAll("_", "");
  const bitMatch = dtype.match(/(?:fp|int|bit)?\s*(4|8|16|32)\s*bit?/);
  if (bitMatch) return Number(bitMatch[1]) / 8;
  if (/\b(?:fp?32|float32)\b/.test(dtype)) return 4;
  if (/\b(?:fp?16|float16|bfloat16|bf16|half)\b/.test(dtype)) return 2;
  if (/\b(?:fp?8|float8)\b/.test(dtype)) return 1;
  if (/\b(?:int4|nf4|q4)\b/.test(dtype)) return 0.5;

  return null;
};

/**
 * Estimates checkpoint weights from the model metadata Neutree already reads.
 * This is a deployment-sizing estimate, not a replacement for a catalog's
 * measured `vram_minimum_gb` when that number is available.
 */
export function estimateModelWeightsGb(info: ModelInfo | null | undefined) {
  if (!info) return null;

  const parameters = parameterCount(info.parameter_count);
  const bytes = bytesPerParameter(info);
  if (parameters == null || bytes == null) return null;

  return (parameters * bytes) / 1e9;
}
