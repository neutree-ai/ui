// Token counts are stored and sent to the backend as a plain integer, but are
// entered and displayed as "amount + unit" (200 M rather than 200000000).
// This module owns both directions of that mapping so the form, the list usage
// column and the detail consumption bar all agree on how a given integer reads.

export const TOKEN_QUOTA_UNITS = ["tokens", "K", "M", "B"] as const;
export type TokenQuotaUnit = (typeof TOKEN_QUOTA_UNITS)[number];

const TOKEN_QUOTA_FACTORS: Record<TokenQuotaUnit, number> = {
  tokens: 1,
  K: 1_000,
  M: 1_000_000,
  B: 1_000_000_000,
};

// The unit a fresh quota field starts on — most quotas are written in millions.
export const DEFAULT_TOKEN_QUOTA_UNIT: TokenQuotaUnit = "M";

const groupFormatter = new Intl.NumberFormat("en-US");

// Group the integer part with thousands separators while leaving whatever the
// user is mid-way through typing intact: a trailing "." and any decimals are
// passed through untouched, so typing "1.5" never gets rewritten under the
// cursor. Non-numeric input is returned as-is for the validator to reject.
export const formatThousands = (input: string): string => {
  const raw = String(input ?? "").replace(/,/g, "");
  if (raw === "") return "";
  const match = raw.match(/^(\d*)(\.\d*)?$/);
  if (!match) return input;
  const [, intPart = "", decimalPart = ""] = match;
  const grouped = intPart === "" ? "" : groupFormatter.format(Number(intPart));
  return `${grouped}${decimalPart}`;
};

// Parse a possibly comma-grouped amount. Returns null for empty or non-numeric
// input; the caller decides whether empty means "unset" or "invalid".
export const parseTokenAmount = (input: string): number | null => {
  const raw = String(input ?? "")
    .replace(/,/g, "")
    .trim();
  if (raw === "" || !/^\d*(\.\d+)?$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

// Multiply amount × unit back into a token count. Returns null unless the
// product is a positive integer — 1.5 M is fine (1,500,000) but 1.5 tokens is
// not. Floating-point drift from e.g. 1.1 × 1000 is snapped to the nearest
// integer before the check.
export const toTokenCount = (
  amount: string,
  unit: TokenQuotaUnit,
): number | null => {
  const n = parseTokenAmount(amount);
  if (n === null || n <= 0) return null;
  const product = n * TOKEN_QUOTA_FACTORS[unit];
  const rounded = Math.round(product);
  if (Math.abs(product - rounded) > 1e-6) return null;
  return Number.isSafeInteger(rounded) ? rounded : null;
};

// Validate the quota input. Empty = no quota (valid); anything else must
// resolve to a positive integer token count.
export const isValidTokenQuota = (
  amount: string,
  unit: TokenQuotaUnit,
): boolean => {
  if (String(amount ?? "").trim() === "") return true;
  return toTokenCount(amount, unit) !== null;
};

// Split a stored token count into the largest unit that divides it exactly, so
// a round-trip through the edit form never loses precision: 200000000 → 200 M,
// 12345 → 12345 tokens.
export const splitTokenQuota = (
  value: number,
): { amount: number; unit: TokenQuotaUnit } => {
  if (!Number.isFinite(value) || value <= 0) {
    return { amount: value, unit: "tokens" };
  }
  for (const unit of ["B", "M", "K"] as const) {
    const factor = TOKEN_QUOTA_FACTORS[unit];
    if (value % factor === 0) return { amount: value / factor, unit };
  }
  return { amount: value, unit: "tokens" };
};

// Render a token count the way it would have been entered: an exact multiple of
// a unit shows as "200M", anything else as a grouped integer "1,234,123".
export const formatTokenQuota = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return "";
  if (value <= 0) return groupFormatter.format(value);
  const { amount, unit } = splitTokenQuota(value);
  const grouped = groupFormatter.format(amount);
  return unit === "tokens" ? grouped : `${grouped}${unit}`;
};
