const COMPACT_UNITS = [
  { threshold: 1_000_000_000_000, suffix: "T" },
  { threshold: 1_000_000_000, suffix: "B" },
  { threshold: 1_000_000, suffix: "M" },
  { threshold: 1_000, suffix: "K" },
] as const;

/** Keeps registry-provided labels intact and abbreviates plain numeric values. */
export function formatModelInfoNumber(value: string): string {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return value;

  const number = Number(normalized);
  if (!Number.isFinite(number)) return value;

  const unit = COMPACT_UNITS.find(({ threshold }) => number >= threshold);
  if (!unit) return normalized;

  const compact = number / unit.threshold;
  const digits = compact >= 100 || Number.isInteger(compact) ? 0 : 1;
  return `${compact.toFixed(digits).replace(/\.0$/, "")}${unit.suffix}`;
}
