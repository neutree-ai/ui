const compactFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 2,
});

/** Format a token count with compact notation (K, M, B). */
export const formatTokens = (
  value: number | null | undefined,
): string | null => {
  if (value == null) return null;
  return compactFormatter.format(value);
};

export const formatToDecimal = (
  num: string | number | undefined | null,
  precision = 1,
): string | null => {
  const n = num == null || num === "" ? Number.NaN : Number(num);
  return Number.isNaN(n) ? null : n.toFixed(precision);
};

const BYTE_UNITS = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];

/** Format a raw byte count in binary units. Returns null for a missing value —
 * callers decide how to say "unknown", which is not the same as "0 B". */
export const formatBytes = (
  value: number | null | undefined,
  precision = 1,
): string | null => {
  if (value == null || Number.isNaN(value)) return null;

  let size = value;
  let unit = 0;

  while (size >= 1024 && unit < BYTE_UNITS.length - 1) {
    size /= 1024;
    unit += 1;
  }

  // Bytes are whole things; a fractional one reads as a rounding artefact.
  const digits = unit === 0 ? 0 : precision;

  return `${size.toFixed(digits)} ${BYTE_UNITS[unit]}`;
};

export const formatMiBAsGiBValue = (
  valueMiB: string | number | undefined | null,
  precision = 1,
): string | null => {
  if (valueMiB == null || valueMiB === "") return null;
  return formatToDecimal(Number(valueMiB) / 1024, precision);
};

export const formatMiBAsGiB = (
  valueMiB: string | number | undefined | null,
  precision = 1,
): string | null => {
  const valueGiB = formatMiBAsGiBValue(valueMiB, precision);
  return valueGiB === null ? null : `${valueGiB} GiB`;
};
