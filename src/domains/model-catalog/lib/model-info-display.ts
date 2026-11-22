const compactFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumSignificantDigits: 3,
});

/** Keeps registry-provided labels intact and abbreviates plain numeric values. */
export function formatModelInfoNumber(value: string): string {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return value;

  const number = Number(normalized);
  if (!Number.isFinite(number)) return value;
  if (number < 1000) return normalized;

  return compactFormatter.format(number);
}
