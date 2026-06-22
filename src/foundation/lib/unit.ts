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
