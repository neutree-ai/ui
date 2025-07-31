export const formatToDecimal = (
  num: string | number | undefined | null,
  precision = 1,
): string | null => {
  const n = num == null || num === "" ? Number.NaN : Number(num);
  return Number.isNaN(n) ? null : n.toFixed(precision);
};
